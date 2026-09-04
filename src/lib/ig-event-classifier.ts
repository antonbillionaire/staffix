/**
 * Классификация не-текстовых Instagram-событий (4 сентября 2026, OLLEE-fb #14).
 *
 * До этого фикса любое IG DM без текста ловилось в один общий ответ
 * «Извините, я не распознаю изображения и файлы...». Это раздражало
 * клиентов OLLEE в трёх типовых сценариях:
 *   1. Клиент отметил бренд в своей сторис — приветственный «спасибо»,
 *      а не отказ.
 *   2. Клиент репостнул наш пост / рекламу в свою сторис — короткое
 *      благодарственное сообщение или эмодзи.
 *   3. Клиент поставил реакцию (❤️/👍) на сообщение бота — просто
 *      подтверждение или тишина, не «не понимаю».
 *
 * Классификатор работает на структуре `message` из Instagram Messenger
 * webhook (та же shape что в `messaging.message` от Meta).
 */

export type IGEventType =
  /** Клиент отметил бизнес в своей сторис через swipe-up / @mention */
  | "story_mention"
  /** Клиент репостнул пост/рекламу бизнеса в свою сторис или отдельным share'ом */
  | "share"
  /** Медиа-вложение без текста (image, video, sticker, unknown attachment) */
  | "media"
  /** Обычное текстовое сообщение (или reply на сторис с текстом) */
  | "text"
  /** Сообщение пустое (нет ни текста ни attachments) — вероятно echo/dedup */
  | "empty";

export interface IGMessageShape {
  text?: unknown;
  attachments?: unknown;
}

/**
 * Определяет тип IG-события по структуре `message`. Приоритет:
 *  1. Если есть текст (после trim) → text (даже если reply_to.story — там уже есть смысл)
 *  2. Если в attachments есть story_mention → story_mention
 *  3. Если в attachments есть share → share
 *  4. Если есть любой другой attachment → media
 *  5. Иначе → empty
 */
export function classifyIGMessage(message: IGMessageShape | null | undefined): IGEventType {
  if (!message) return "empty";
  const text = typeof message.text === "string" ? message.text.trim() : "";
  if (text) return "text";

  const attachments = Array.isArray(message.attachments)
    ? (message.attachments as Array<Record<string, unknown>>)
    : null;
  if (!attachments || attachments.length === 0) return "empty";

  const types = new Set(
    attachments
      .map((a) => (typeof a?.type === "string" ? a.type.toLowerCase() : ""))
      .filter(Boolean)
  );

  if (types.has("story_mention")) return "story_mention";
  if (types.has("share")) return "share";
  return "media";
}

/**
 * Шаблонные ответы для каждого типа события. Хардкод пока — в следующей
 * итерации можно вынести на per-business уровень (настройка в дашборде
 * «Реакции на события IG»). Если владельцу не нравится дефолт, он попросит
 * → добавим настройку.
 *
 * Правила формулировок:
 *   - Тёплый короткий тон, не роботизм
 *   - Один эмодзи максимум, только уместный
 *   - Без вопросов в конце (это не начало разговора, а вежливая реакция)
 *   - Без markdown — во всех каналах через stripMarkdown, но лучше сразу чисто
 */
export const IG_EVENT_TEMPLATES: Record<IGEventType, string | null> = {
  story_mention: "Спасибо большое за упоминание! 🌸",
  share: "Спасибо! 🌸",
  media:
    "Извините, я не распознаю изображения и файлы. Опишите вопрос текстом или отправьте голосовое сообщение — я отвечу.",
  text: null, // текст идёт в обычный AI-flow, не через шаблон
  empty: null, // пустое сообщение — тихо игнорируем
};

/**
 * Возвращает шаблонный ответ для события или null если бот должен молчать
 * (или идти по обычному AI-flow). Пустая строка тоже трактуется как null.
 */
export function getIGTemplateReply(type: IGEventType): string | null {
  const t = IG_EVENT_TEMPLATES[type];
  return t && t.trim().length > 0 ? t : null;
}
