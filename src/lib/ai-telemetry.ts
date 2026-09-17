/**
 * Телеметрия оборота бота (Этап 1 research-плана, 17 сентября 2026).
 *
 * Одна строка AiTurn на оборот: входящее клиента → исходящее бота, включая
 * весь tool-loop внутри. Заводится в начале обработки, копит данные по ходу,
 * пишется в конце.
 *
 * Зачем: trackClaudeUsage() инкрементит кумулятивные счётчики на Business —
 * по ним нельзя сказать, какая модель отвечала конкретному клиенту, сколько
 * заняла итерация tool-loop и как часто срабатывает recovery. Всё это жило
 * только в эфемерных логах Vercel. AiTurn живёт РЯДОМ с trackClaudeUsage,
 * не вместо: тот используется в биллинге и client-cost-report.mjs.
 *
 * Два правила, которые нельзя нарушать:
 *
 *   1. Запись только fire-and-forget с .catch(). Упавшая аналитика не имеет
 *      права уронить ответ клиенту.
 *   2. finish() вызывается из finally вокруг всего тела обработчика, а не
 *      вручную в каждой ветке. В generateChannelAIResponse 7 точек выхода,
 *      в telegram/ai.ts — 11; ручная расстановка однажды потеряет одну, и
 *      обнаружится это через месяц по несходящимся цифрам.
 *
 * Фоновые вызовы (cache-warmer, суммаризация, cart-extractor) сюда НЕ пишутся:
 * это не обороты диалога, они исказили бы метрики латентности и стоимости.
 */

import { prisma } from "@/lib/prisma";
import { estimateCostUsd } from "@/lib/ai-pricing";

/** Что сработало в safety-net за оборот. null — ничего не срабатывало. */
export type SafetyNetKind = "notify_manager" | "phone_guard" | "handoff_guard";

export interface TurnTrackerInit {
  businessId: string;
  channel: string;
  /**
   * Conversation.id или ChannelConversation.id.
   * Необязателен при создании: трекер заводится ДО загрузки диалога, чтобы
   * латентность считалась от самого начала оборота. Проставляется потом
   * через setConversation().
   */
  conversationKey?: string;
  /** telegramId / ChannelClient.id — для сквозной аналитики */
  clientRef?: string | null;
  salesMode?: boolean;
}

/** Минимальная форма usage от Anthropic SDK — берём только то, что считаем. */
interface AnthropicUsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export interface TurnTracker {
  /** Суммирует токены со всех вызовов оборота: main + tool-loop + recovery. */
  addUsage(usage: AnthropicUsageLike | null | undefined): void;
  /** Диалог и клиент — известны после загрузки conversation, не сразу. */
  setConversation(conversationKey: string, clientRef?: string | null, salesMode?: boolean): void;
  /** Модель главного вызова + вердикт классификатора сложности. */
  setModel(model: string, complexity?: string | null): void;
  /** Имя вызванного инструмента. Дубликаты не схлопываем — важна частота. */
  addTool(name: string): void;
  /** +1 круг tool-loop. */
  addIteration(): void;
  /** Сработал recovery-вызов (пустой ответ основной модели). */
  markRecovery(): void;
  /** Сработала защита: guard перехватил ответ или форсировал notify_manager. */
  markSafetyNet(kind: SafetyNetKind): void;
  /** Бот не смог сформировать текст — клиент получил фолбэк. */
  markEmptyResponse(): void;
  /** Пишет строку. Идемпотентен: повторный вызов игнорируется. */
  finish(): void;
}

/** Трекер, который ничего не делает — для путей, где телеметрия не нужна. */
const NOOP_TRACKER: TurnTracker = {
  addUsage() {},
  setConversation() {},
  setModel() {},
  addTool() {},
  addIteration() {},
  markRecovery() {},
  markSafetyNet() {},
  markEmptyResponse() {},
  finish() {},
};

export function createNoopTurnTracker(): TurnTracker {
  return NOOP_TRACKER;
}

export function createTurnTracker(init: TurnTrackerInit): TurnTracker {
  const startedAt = Date.now();

  let conversationKey = init.conversationKey ?? "";
  let clientRef = init.clientRef ?? null;
  let salesMode = init.salesMode ?? false;
  let model = "";
  let complexity: string | null = null;
  let tokensInput = 0;
  let tokensOutput = 0;
  let tokensCacheRead = 0;
  let tokensCacheCreate = 0;
  let iterations = 0;
  const toolsCalled: string[] = [];
  let recoveryUsed = false;
  let safetyNetFired: SafetyNetKind | null = null;
  let emptyResponse = false;
  let finished = false;

  return {
    addUsage(usage) {
      if (!usage) return;
      tokensInput += usage.input_tokens ?? 0;
      tokensOutput += usage.output_tokens ?? 0;
      tokensCacheRead += usage.cache_read_input_tokens ?? 0;
      tokensCacheCreate += usage.cache_creation_input_tokens ?? 0;
    },

    setConversation(key, ref, sales) {
      conversationKey = key;
      if (ref !== undefined) clientRef = ref;
      if (sales !== undefined) salesMode = sales;
    },

    setModel(m, c) {
      model = m;
      if (c !== undefined) complexity = c;
    },

    addTool(name) {
      if (name) toolsCalled.push(name);
    },

    addIteration() {
      iterations++;
    },

    markRecovery() {
      recoveryUsed = true;
    },

    markSafetyNet(kind) {
      // Первое срабатывание важнее последующих — оно объясняет, что пошло не так.
      if (!safetyNetFired) safetyNetFired = kind;
    },

    markEmptyResponse() {
      emptyResponse = true;
    },

    finish() {
      if (finished) return;
      finished = true;

      // Оборот, где до вызова модели дело не дошло (нет businessId, бот на паузе,
      // human takeover, подписка кончилась) — не оборот. Писать его значит
      // портить среднюю латентность и долю recovery.
      // conversationKey пустой означает то же самое: диалог не загрузился.
      if (!model || !conversationKey) return;

      const latencyMs = Date.now() - startedAt;
      const costUsd = estimateCostUsd(model, {
        tokensInput,
        tokensOutput,
        tokensCacheRead,
        tokensCacheCreate,
      });

      prisma.aiTurn
        .create({
          data: {
            businessId: init.businessId,
            channel: init.channel,
            conversationKey,
            clientRef,
            model,
            complexity,
            salesMode,
            tokensInput,
            tokensOutput,
            tokensCacheRead,
            tokensCacheCreate,
            costUsd,
            latencyMs,
            iterations,
            toolsCalled,
            recoveryUsed,
            safetyNetFired,
            emptyResponse,
          },
        })
        .catch((e) => console.error("[ai-telemetry] failed to write AiTurn:", e));
    },
  };
}
