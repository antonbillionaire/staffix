/**
 * Human takeover — менеджер вручную отвечает клиенту через дашборд,
 * бот на этот период не отвечает клиенту в конкретном разговоре, но
 * входящие сообщения клиента продолжают сохраняться в history чтобы
 * менеджер их видел.
 *
 * Механика (4 сентября 2026, OLLEE-fb #13):
 *   - Manual reply endpoint ставит `humanTakeoverUntil = now + N min`
 *   - Каждое новое ручное сообщение менеджера ПРОДЛЕВАЕТ окно
 *   - Webhook handlers (TG/WA/IG/FB/widget) проверяют флаг: если активен,
 *     сохраняют incoming в history и молча выходят до вызова AI
 *   - Кнопка «Вернуть боту» в UI досрочно ставит null через отдельный endpoint
 *   - Через N минут без manual reply — бот сам возвращается (флаг протухает)
 *
 * Тайм-аут настраивается через env `HUMAN_TAKEOVER_MINUTES`, дефолт 30.
 * Нижняя граница — 1 минута (защита от опечатки), верхняя — 24 часа
 * (иначе стухшие диалоги могут навсегда остаться без бота).
 */

const DEFAULT_MINUTES = 30;
const MIN_MINUTES = 1;
const MAX_MINUTES = 24 * 60;

/**
 * Читает окно из env с валидацией. Значение вне [1..1440] клампится
 * (мусор в env не должен молча ломать поведение бота).
 */
export function getHumanTakeoverMinutes(): number {
  const raw = process.env.HUMAN_TAKEOVER_MINUTES;
  if (!raw) return DEFAULT_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MINUTES;
  if (n < MIN_MINUTES) return MIN_MINUTES;
  if (n > MAX_MINUTES) return MAX_MINUTES;
  return Math.floor(n);
}

/**
 * Возвращает Date когда истечёт окно takeover, отсчитывая от переданного
 * `from` (по умолчанию — сейчас). Используется в manual reply endpoint при
 * записи `humanTakeoverUntil`.
 */
export function computeTakeoverExpiry(from: Date = new Date()): Date {
  const minutes = getHumanTakeoverMinutes();
  return new Date(from.getTime() + minutes * 60 * 1000);
}

/**
 * True если бот должен молчать — takeover активен (флаг стоит и не истёк).
 * Null / прошедшее время → бот работает как обычно.
 *
 * Экспортируется как чистая функция (без БД) чтобы использоваться и в
 * webhook handlers, и в тестах.
 */
export function isBotSilenced(
  humanTakeoverUntil: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!humanTakeoverUntil) return false;
  return humanTakeoverUntil.getTime() > now.getTime();
}

/**
 * Сколько бот молчит ПОСЛЕ того, как в диалог вошёл человек (29 сент 2026).
 *
 * ЗАЧЕМ ОТДЕЛЬНО ОТ `humanTakeoverUntil`. Окно takeover — 30 минут, и оно
 * решает свою задачу: менеджер печатает, клиент отвечает через минуту, бот
 * не влезает. Но живая поддержка так не выглядит.
 *
 * Реальный диалог OLLEE в Instagram (28 сент, conv cmukymc4d002wjh043wxcpmc1):
 * менеджер разбирался с покраснением лица после SPF-крема, клиент отвечал
 * через 4 ч 53 мин и через 1 ч 20 мин. Окно к тому моменту истекало, и бот
 * вклинивался с ответом поверх менеджера — трижды за диалог. С точки зрения
 * кода всё верно, с точки зрения менеджера бот «встревает в разговор».
 *
 * Поэтому второй, длинный горизонт: в диалог, который ведёт человек,
 * автоматика не лезет сутки. Владелец возвращает бота кнопкой «Вернуть боту»
 * досрочно — она снимает обе отметки.
 *
 * Верхняя граница 30 суток: диалог, забытый менеджером, не должен остаться
 * без бота навсегда.
 */
const DEFAULT_HOLD_HOURS = 24;
const MAX_HOLD_HOURS = 24 * 30;

export function getHumanHoldHours(): number {
  const raw = process.env.HUMAN_HANDOFF_HOLD_HOURS;
  if (!raw) return DEFAULT_HOLD_HOURS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_HOLD_HOURS;
  return Math.min(Math.floor(n), MAX_HOLD_HOURS);
}

/**
 * True если бот должен молчать: либо активно идёт takeover, либо человек
 * отвечал в этом диалоге недавно.
 *
 * Обе отметки проверяются вместе, потому что закрывают разные случаи:
 * короткое окно — «менеджер печатает прямо сейчас», длинный горизонт —
 * «этот разговор ведёт человек, не лезь».
 */
export function isBotOnHold(
  conv: { humanTakeoverUntil?: Date | null; lastHumanReplyAt?: Date | null },
  now: Date = new Date()
): boolean {
  if (isBotSilenced(conv.humanTakeoverUntil, now)) return true;
  if (!conv.lastHumanReplyAt) return false;
  const holdMs = getHumanHoldHours() * 60 * 60 * 1000;
  return now.getTime() - conv.lastHumanReplyAt.getTime() < holdMs;
}
