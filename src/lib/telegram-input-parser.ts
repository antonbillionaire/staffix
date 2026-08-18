/**
 * Разбор поля "Telegram" на форме сотрудника (Staff).
 *
 * Владелец бизнеса вписывает одно из:
 *  - `@username` (личный чат — старая логика: юзер пишет /start боту, мы
 *    записываем chatId по совпадению username)
 *  - `-5530519186` или `-1001234567890` (общий рабочий чат группы —
 *    новая логика с 18 августа 2026: уведомления летят в группу, где
 *    сидят все менеджеры бизнеса).
 *
 * Оба варианта хранятся в разных полях `Staff` — соответственно
 * `telegramUsername` (строка без @) и `telegramChatId` (BigInt). Одно из
 * них null, оба одновременно быть не должны.
 *
 * Используется с обеих сторон: клиент парсит для превью и валидации,
 * сервер парсит для доверенной записи в БД.
 */

export interface ParsedTelegramInput {
  /** Username без @ или null если введён chat_id */
  username: string | null;
  /**
   * ChatId группы в виде строки (BigInt в БД). Строка потому что клиент
   * держит поле формы как string, а BigInt пересылать через JSON нельзя
   * без глобального toJSON (у нас он есть, но клиент всё равно даёт строку).
   */
  chatId: string | null;
  /** Ошибка валидации или null */
  error: string | null;
}

const EMPTY: ParsedTelegramInput = { username: null, chatId: null, error: null };

/** Разрешённые символы username Telegram — a-z, 0-9, подчёркивание, 5-32 символа */
const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

/**
 * Группа: legacy `-<digits>` (5+ цифр) или supergroup `-100<digits>`
 * (полное значение начинается с -100, потом 10-13 цифр).
 * Общее правило: минус + цифры, минимум 6 символов (5 цифр + минус).
 */
const CHAT_ID_RE = /^-\d{5,}$/;

export function parseTelegramInput(raw: unknown): ParsedTelegramInput {
  if (typeof raw !== "string") return EMPTY;
  const value = raw.trim();
  if (!value) return EMPTY;

  // Chat ID группы: строго `-` + цифры
  if (value.startsWith("-")) {
    if (!CHAT_ID_RE.test(value)) {
      return {
        username: null,
        chatId: null,
        error:
          "ID группы должен состоять из минуса и цифр (например, -5530519186 или -1001234567890)",
      };
    }
    return { username: null, chatId: value, error: null };
  }

  // Username: с @ или без
  const withoutAt = value.startsWith("@") ? value.slice(1) : value;
  if (!withoutAt) {
    return { username: null, chatId: null, error: "Введите username после @" };
  }
  if (!USERNAME_RE.test(withoutAt)) {
    return {
      username: null,
      chatId: null,
      error:
        "Username должен быть 5-32 символа, начинаться с буквы, содержать латиницу, цифры и _",
    };
  }
  return { username: withoutAt, chatId: null, error: null };
}

/**
 * Обратное преобразование: как отобразить в поле формы значение из БД.
 * `staff.telegramUsername` → `"@username"`, `staff.telegramChatId` → `"-5530519186"`.
 */
export function formatTelegramInput(
  username: string | null | undefined,
  chatId: string | bigint | null | undefined
): string {
  if (username) return `@${username}`;
  if (chatId != null && chatId !== "") return String(chatId);
  return "";
}
