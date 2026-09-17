/**
 * Состояние диалога: стадия воронки и что уже выяснено (Этап 4, 17 сент 2026).
 *
 * ПРОБЛЕМА. Семь стадий воронки описаны подробно — 530 строк в
 * `prompts/funnel-rules.ts`, у каждой «что делаешь / чего не делаешь / когда
 * переходить». Но описание это никем не исполняется: весь текст уезжает в
 * промпт, и модель на КАЖДОМ обороте определяет стадию заново, вчитываясь в
 * историю. Одно неудачное сообщение — и бот откатывается на «чем могу помочь».
 * Разница как между инструкцией на стене и CRM, которая не пускает дальше,
 * пока не заполнены поля.
 *
 * РЕШЕНИЕ. Стадия и набор фактов лежат в БД. Модель СООБЩАЕТ о переходе
 * (инструмент advance_stage), а решает код. Назад — только по правилам,
 * вперёд — свободно: «беру, вот телефон» первым сообщением это законный
 * прыжок с 1 на 6, и мешать ему нельзя.
 *
 * ПОЧЕМУ ПЕРЕХОДЫ ВАЛИДИРУЕТ КОД. Ровно та же история, что с телефоном и с
 * эскалацией: правило в промпте модель соблюдает «почти всегда», а «почти» на
 * закрытии сделки стоит денег. Guard про телефон перестаёт быть заплаткой и
 * становится частью модели данных: переход на стадию закрытия невозможен, пока
 * телефона нет.
 */

export const FUNNEL_STAGE_COUNT = 7;

export type FunnelStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * Названия и цели стадий. Один в один с funnel-rules.ts — новых стадий не
 * заводим, иначе промпт и состояние начнут расходиться.
 */
export const FUNNEL_STAGES: Record<
  FunnelStage,
  { name: string; goal: string }
> = {
  1: {
    name: "ПРИВЕТСТВИЕ",
    goal: "поздороваться и одним открытым вопросом понять, зачем клиент пришёл",
  },
  2: {
    name: "ВЫЯСНЕНИЕ ПОТРЕБНОСТИ",
    goal: "уточнить 1-2 деталями, что именно нужно — не больше одного вопроса за раз",
  },
  3: {
    name: "ПРЕДЛОЖЕНИЕ",
    goal: "назвать конкретный товар с ценой и преимуществом, не больше 2-3 вариантов",
  },
  4: {
    name: "ОБРАБОТКА ВОЗРАЖЕНИЙ",
    goal: "снять сомнение по существу и вернуться к предложению",
  },
  5: {
    name: "ЗАКРЫТИЕ",
    goal: "получить согласие на заказ или запись",
  },
  6: {
    name: "ПОЛУЧЕНИЕ КОНТАКТА",
    goal: "собрать имя, телефон и остальные данные, затем оформить заказ",
  },
  7: {
    name: "ПОСЛЕ ЗАКАЗА",
    goal: "проговорить детали заказа и один раз предложить сопутствующее",
  },
};

export function isFunnelStage(n: unknown): n is FunnelStage {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= FUNNEL_STAGE_COUNT;
}

/** Что известно о диалоге. Всё опционально: заполняется по мере разговора. */
export interface FunnelKnownFacts {
  /** Чего хочет клиент — своими словами, коротко */
  intent?: string | null;
  /** Для кого покупает (себе, в подарок, ребёнку) */
  forWhom?: string | null;
  /** Бюджет или ценовые ожидания, если прозвучали */
  budget?: string | null;
  /** Телефон — источник правды всё равно БД, здесь для промпта */
  phone?: string | null;
  /** Что клиент возражал: «дорого», «подумаю», «нашёл дешевле» */
  objections?: string[];
  /** Какие товары уже показывали — чтобы не предлагать по кругу */
  offered?: string[];
}

const MAX_LIST = 10;
const MAX_FIELD_LEN = 200;

function cleanText(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, MAX_FIELD_LEN);
  return t || null;
}

function cleanList(v: unknown, previous: string[] = []): string[] {
  const incoming = Array.isArray(v) ? v : [];
  const seen = new Set<string>();
  const out: string[] = [];
  // Порядок: сначала уже известное, потом новое — список растёт, а не
  // переписывается. Модель присылает только то, что услышала в этом обороте.
  for (const item of [...previous, ...incoming]) {
    const t = cleanText(item);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_LIST) break;
  }
  return out;
}

/** Читает knownFacts из Json-поля, не доверяя его форме. */
export function parseKnownFacts(raw: unknown): FunnelKnownFacts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  return {
    intent: cleanText(r.intent),
    forWhom: cleanText(r.forWhom),
    budget: cleanText(r.budget),
    phone: cleanText(r.phone),
    objections: cleanList(r.objections),
    offered: cleanList(r.offered),
  };
}

/**
 * Слияние: новое перекрывает старое для скалярных полей, списки растут.
 *
 * Пустое значение НЕ затирает known: если в этом обороте модель ничего не
 * сказала про бюджет, это значит «не прозвучало», а не «бюджета больше нет».
 * Иначе бот снова начал бы переспрашивать выясненное — ровно то, что чиним.
 */
export function mergeKnownFacts(
  previous: FunnelKnownFacts,
  incoming: Partial<FunnelKnownFacts>
): FunnelKnownFacts {
  return {
    intent: cleanText(incoming.intent) ?? previous.intent ?? null,
    forWhom: cleanText(incoming.forWhom) ?? previous.forWhom ?? null,
    budget: cleanText(incoming.budget) ?? previous.budget ?? null,
    phone: cleanText(incoming.phone) ?? previous.phone ?? null,
    objections: cleanList(incoming.objections, previous.objections ?? []),
    offered: cleanList(incoming.offered, previous.offered ?? []),
  };
}

export interface StageTransition {
  /** Стадия, которая будет записана */
  stage: FunnelStage;
  /** Принят ли переход как запрошен */
  accepted: boolean;
  /** Для логов и телеметрии */
  reason: string;
}

/**
 * Валидация перехода.
 *
 * Правила намеренно немногочисленные — это не машина состояний, которая
 * ведёт разговор вместо человека, а ограждение от двух конкретных бед:
 * откатов назад без причины и закрытия сделки без контакта.
 *
 *   вперёд           — свободно (клиент может прийти готовым покупать)
 *   на месте         — разрешено (уточняющий вопрос внутри стадии)
 *   назад            — только на стадию 4 (возникло возражение); остальные
 *                      откаты отклоняем и остаёмся где были
 *   переход на 6 и 7 — требует телефона: guard про контакт становится
 *                      частью модели данных, а не заплаткой поверх ответа
 */
export function validateStageTransition(
  current: FunnelStage,
  requested: number,
  facts: FunnelKnownFacts
): StageTransition {
  if (!isFunnelStage(requested)) {
    return { stage: current, accepted: false, reason: "invalid-stage" };
  }

  const hasPhone = !!cleanText(facts.phone);

  if (requested >= 6 && !hasPhone) {
    // Не откат назад, а отказ пустить вперёд: сначала контакт.
    return {
      stage: current < 5 ? current : 5,
      accepted: false,
      reason: "needs-phone",
    };
  }

  if (requested > current) {
    return { stage: requested, accepted: true, reason: "forward" };
  }
  if (requested === current) {
    return { stage: current, accepted: true, reason: "same" };
  }
  // Назад — только «возникло возражение».
  if (requested === 4) {
    return { stage: 4, accepted: true, reason: "objection" };
  }
  return { stage: current, accepted: false, reason: "backward-rejected" };
}

/**
 * Счётчик оборотов на текущей стадии.
 *
 * Лежит в том же Json-поле, что и факты, но под служебным ключом: это
 * бухгалтерия процесса, а не то, что известно о клиенте, и в промпт оно не
 * идёт. Держать ради него отдельную колонку — избыточно.
 */
const STAGE_TURNS_KEY = "__stageTurns";

export function readStageTurns(raw: unknown): number {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const v = (raw as Record<string, unknown>)[STAGE_TURNS_KEY];
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

/** Готовит объект для записи в Json-колонку: факты + служебный счётчик. */
export function serializeKnownFacts(
  facts: FunnelKnownFacts,
  stageTurns: number
): Record<string, unknown> {
  return { ...facts, [STAGE_TURNS_KEY]: Math.max(0, Math.floor(stageTurns)) };
}

/**
 * Стадия для диалога, у которого состояния ещё нет.
 *
 * ЗАЧЕМ. Колонка добавлена со значением по умолчанию 1, то есть после миграции
 * КАЖДЫЙ существующий диалог числится на стадии «приветствие» — включая те,
 * что дошли до закрытия. Без этой функции блок состояния сказал бы боту
 * «поздоровайся и выясни, зачем клиент пришёл» посреди оформления заказа.
 * Эвал `silence-after-offer` поймал ровно это: бот поздоровался заново.
 *
 * Разметить историю задним числом нечем, поэтому берём осторожную оценку по
 * тому, что уже известно. Ошибиться лучше в меньшую сторону: недооценённая
 * стадия сдвинется вперёд на первом же обороте, переоценённая заставит бота
 * закрывать сделку, которой не было.
 */
export function bootstrapStage(
  messageCount: number,
  facts: FunnelKnownFacts
): FunnelStage {
  if (messageCount <= 0) return 1;
  if (cleanText(facts.phone)) return 5;
  if (cleanText(facts.intent) || (facts.offered?.length ?? 0) > 0) return 3;
  return 2;
}
