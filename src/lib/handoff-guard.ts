/**
 * Handoff Guard (6 августа 2026, OLLEE incident):
 *
 * Общий модуль для hard-code guard'а «бот пообещал менеджера без телефона».
 * Заменяет 2 дублирующиеся реализации в channel-ai.ts и telegram/ai.ts
 * (обе с одинаковой toxic-фразой которая срабатывала до 6 раз подряд в
 * conv-10 у OLLEE).
 *
 * Что делает:
 *   1. Определяет что бот «пообещал» эскалацию через promisedForwardingRegex
 *   2. Если у клиента нет телефона и бот не вызвал notify_manager — перехват
 *   3. Вместо ОДНОЙ фразы каждый раз — три ветки в зависимости от контекста:
 *      a) Клиент прислал неполный номер (incomplete=true) — просим уточнить
 *      b) Guard уже срабатывал 2+ раз в этом диалоге — эскалируем реально
 *         через notify_manager (клиент явно упирается, LLM не помогает)
 *      c) Первое срабатывание — вариативная фраза с именем клиента если есть
 *
 * Правило `feedback_bot_never_escalate_without_phone` сохранено полностью —
 * лид не теряется, менеджер не получает пустых эскалаций. Ветка (b)
 * добавлена как safety net для случаев когда парсинг номера подводит
 * (сообщение слишком нестандартное или клиент отказывается).
 */

import type { PhoneDetection } from "./phone-parser";

export interface HandoffGuardInput {
  /** Ответ бота который может содержать «менеджер свяжется» */
  botReplyText: string;
  /** Результат detectPhone на последнем сообщении клиента */
  phoneDetection: PhoneDetection;
  /** Есть ли у клиента телефон в БД (channelClientPhoneOnRecord или Client.phone) */
  hasPhoneOnRecord: boolean;
  /** Вызывал ли бот tool `notify_manager` в этом turn'e */
  calledNotifyManager: boolean;
  /** Regex «менеджер свяжется» — считает hits в тексте */
  promisedForwardingRegex: RegExp;
  /** Имя клиента (для персонализации фразы) */
  clientName?: string | null;
  /**
   * Сколько раз guard уже перехватывал ответ в этом диалоге (из
   * ChannelConversation.extractedInfo.guardHits или Conversation.extractedInfo).
   * Если ≥ 2 — переключаемся на реальную эскалацию.
   */
  previousGuardHits: number;
}

export interface HandoffGuardResult {
  /** true если guard сработал — вызывающий код должен использовать overrideReply */
  intercepted: boolean;
  /** Новый текст ответа клиенту, если intercepted=true */
  overrideReply?: string;
  /** true если guard решил всё же позвать notify_manager (ветка «b») */
  forceNotifyManager?: boolean;
  /** Для инкремента счётчика в БД (extractedInfo.guardHits) */
  newGuardHits: number;
  /** Строка для логов */
  logReason: string;
}

// 3 варианта дружелюбной формулировки — не одна и та же токсичная фраза.
// Используем %NAME% плейсхолдер: если имя есть — вставляем «, {Имя}», иначе пусто.
const FIRST_HIT_VARIANTS = [
  "Хорошо%NAME%. Оставьте, пожалуйста, номер телефона — тогда сразу оформим всё что нужно.",
  "Понял%NAME%. Ваш номер телефона — и продолжим оформление.",
  "Хорошо%NAME%. Подскажите, пожалуйста, ваш номер — свяжусь с Вами в удобное время.",
];

function personalize(template: string, name?: string | null): string {
  // Имя есть и содержательное — вставляем через запятую
  const clean = (name || "").trim();
  if (clean && clean.length >= 2 && clean.length <= 40 && !/[<>@#]/.test(clean)) {
    return template.replace("%NAME%", ", " + clean);
  }
  return template.replace("%NAME%", "");
}

function pickVariant(previousHits: number): string {
  // Не random — детерминированный выбор по счётчику, чтобы если guard
  // сработает 2 раза подряд (что не должно, но всё же) — фразы отличались.
  return FIRST_HIT_VARIANTS[previousHits % FIRST_HIT_VARIANTS.length];
}

/**
 * Основная функция.
 *
 * Ветки:
 *   - неполный номер → просим проверить/дописать
 *   - 3+ srabotki → forceNotifyManager (реальная эскалация)
 *   - иначе → вариативная фраза
 */
export function evaluateHandoffGuard(input: HandoffGuardInput): HandoffGuardResult {
  const {
    botReplyText,
    phoneDetection,
    hasPhoneOnRecord,
    calledNotifyManager,
    promisedForwardingRegex,
    clientName,
    previousGuardHits,
  } = input;

  const botPromised = promisedForwardingRegex.test(botReplyText);
  const hasPhoneNow = !!(phoneDetection.phone || hasPhoneOnRecord);

  // Не наш кейс — бот ничего не обещал ИЛИ телефон есть ИЛИ notify_manager уже вызван
  if (!botPromised || hasPhoneNow || calledNotifyManager) {
    return {
      intercepted: false,
      newGuardHits: previousGuardHits,
      logReason: "not-triggered",
    };
  }

  const nextHits = previousGuardHits + 1;

  // Ветка «a» — клиент явно попытался дать номер, но неполный
  if (phoneDetection.incomplete) {
    return {
      intercepted: true,
      overrideReply: personalize(
        "Кажется, номер не полный%NAME%. Проверьте, пожалуйста — обычно нужно 9-12 цифр (например +998 90 123 45 67). Отправьте ещё раз?",
        clientName
      ),
      newGuardHits: nextHits,
      logReason: "incomplete-phone",
    };
  }

  // Ветка «b» — 3-й раз подряд guard срабатывает, LLM зациклился.
  // Реально зовём notify_manager с контекстом канала, чтобы менеджер
  // мог связаться сам (в TG по @username, в WA — по chatId).
  if (previousGuardHits >= 2) {
    return {
      intercepted: true,
      overrideReply: personalize(
        "Понял%NAME%. Передал запрос менеджеру — он свяжется с Вами в этом чате в ближайший час. Если удобнее по телефону — оставьте номер, и позвоним.",
        clientName
      ),
      forceNotifyManager: true,
      newGuardHits: nextHits,
      logReason: "loop-detected",
    };
  }

  // Ветка «c» — первое или второе срабатывание, вариативная фраза
  return {
    intercepted: true,
    overrideReply: personalize(pickVariant(previousGuardHits), clientName),
    newGuardHits: nextHits,
    logReason: "first-intercept",
  };
}
