/**
 * Единый словарь исходов диалога (Этап 2 research-плана, 17 сентября 2026).
 *
 * Зачем понадобился: до этого `outcome` был свободной строкой, которую писала
 * модель. На проде это выглядело так — заполнено 71 из 2554 диалогов (2.8 %),
 * и все 71 со значением `answered`. То есть поле было, а данных в нём не было.
 *
 * Отсюда главное правило модуля:
 *
 *   Исход, который можно установить ФАКТОМ, устанавливается фактом.
 *   Модели оставлена только серая зона, где факта не существует.
 *
 * Факт — это вызов инструмента за оборот (`AiTurn.toolsCalled`): заказ либо
 * создан, либо нет; телефон либо получен, либо нет. Спрашивать об этом модель
 * бессмысленно — она отвечает «answered» всегда.
 */

/** Исход диалога. Порядок в типе — от лучшего к худшему. */
export type ConversationOutcome =
  | "booked" // запись создана
  | "ordered" // заказ оформлен
  | "lead_captured" // телефон получен, менеджер уведомлён
  | "answered" // вопрос закрыт, но записи/заказа не было
  | "escalated" // передан менеджеру
  | "abandoned" // клиент замолчал, цели нет ← ПОТЕРЯ
  | "unresolved"; // бот не смог помочь ← ПОТЕРЯ

export const CONVERSATION_OUTCOMES: readonly ConversationOutcome[] = [
  "booked",
  "ordered",
  "lead_captured",
  "answered",
  "escalated",
  "abandoned",
  "unresolved",
] as const;

/** Исходы, которые считаются достижением цели бота. */
export const SUCCESS_OUTCOMES: readonly ConversationOutcome[] = [
  "booked",
  "ordered",
  "lead_captured",
] as const;

/** Исходы, которые считаются потерей клиента. */
export const LOSS_OUTCOMES: readonly ConversationOutcome[] = ["abandoned", "unresolved"] as const;

export function isSuccessOutcome(outcome: string | null | undefined): boolean {
  return !!outcome && (SUCCESS_OUTCOMES as readonly string[]).includes(outcome);
}

export function isLossOutcome(outcome: string | null | undefined): boolean {
  return !!outcome && (LOSS_OUTCOMES as readonly string[]).includes(outcome);
}

/** Нормализует произвольную строку от модели к словарю. Мусор → null. */
export function normalizeOutcome(raw: string | null | undefined): ConversationOutcome | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  return (CONVERSATION_OUTCOMES as readonly string[]).includes(v)
    ? (v as ConversationOutcome)
    : null;
}

/** Приоритет исхода: чем выше, тем «сильнее» факт. Нужен чтобы не затирать
 *  созданный заказ более слабым исходом на следующем обороте. */
const OUTCOME_RANK: Record<ConversationOutcome, number> = {
  booked: 100,
  ordered: 100,
  lead_captured: 80,
  escalated: 60,
  answered: 40,
  unresolved: 20,
  abandoned: 10,
};

/**
 * Новый исход сильнее текущего?
 *
 * Диалог, где заказ уже создан, не должен на следующем обороте стать
 * `answered` только потому, что клиент спросил про доставку.
 */
export function shouldUpgradeOutcome(
  current: string | null | undefined,
  next: ConversationOutcome
): boolean {
  const cur = normalizeOutcome(current);
  if (!cur) return true;
  return OUTCOME_RANK[next] > OUTCOME_RANK[cur];
}

/**
 * Определяет исход по факту вызванных за оборот инструментов.
 *
 * Возвращает null, если факта нет — тогда диалог остаётся в серой зоне
 * (`answered` / `abandoned` / `unresolved`), и её разбирает суммаризация.
 *
 * @param toolsCalled имена инструментов, вызванных за оборот (AiTurn.toolsCalled)
 * @param hasPhone    известен ли телефон клиента на момент оборота
 */
export function outcomeFromTools(
  toolsCalled: readonly string[],
  hasPhone: boolean
): ConversationOutcome | null {
  if (toolsCalled.length === 0) return null;

  // Запись и заказ — самый сильный факт, спорить не о чем.
  if (toolsCalled.includes("create_booking") || toolsCalled.includes("book_package")) {
    return "booked";
  }
  if (toolsCalled.includes("create_order")) {
    return "ordered";
  }

  // Эскалация к человеку. Разница между «лид с контактом» и «просто передали»
  // принципиальная: в первом случае менеджеру есть с чем работать.
  // Именно это различие и потерялось на проде — 206 эскалаций за месяц,
  // из которых контакт до карточки клиента не доходил (см. Этап 0).
  if (toolsCalled.includes("notify_manager") || toolsCalled.includes("route_to_specialist")) {
    return hasPhone ? "lead_captured" : "escalated";
  }

  return null;
}

/**
 * Разбор серой зоны — сюда попадают диалоги без «сильного» факта.
 *
 * Здесь решение принимается по времени и последнему говорящему, а не моделью:
 *   - последним говорил бот и с тех пор тишина дольше порога → клиент ушёл
 *   - в остальном считаем, что на вопрос ответили
 *
 * `unresolved` модель может поставить сама через суммаризацию — это
 * единственный исход, где её мнение действительно нужно.
 */
export function outcomeFromSilence(params: {
  lastRole: "user" | "assistant" | null;
  minutesSinceLastMessage: number;
  /** Порог тишины. По умолчанию сутки — короче ставить опасно: клиент может
   *  вернуться вечером того же дня, и это не потеря. */
  abandonAfterMinutes?: number;
}): ConversationOutcome | null {
  const { lastRole, minutesSinceLastMessage, abandonAfterMinutes = 24 * 60 } = params;
  if (minutesSinceLastMessage < abandonAfterMinutes) return null;
  if (lastRole === "assistant") return "abandoned";
  return "answered";
}
