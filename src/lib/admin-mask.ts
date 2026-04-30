/**
 * Утилиты для маскирования PII при показе админу Staffix.
 *
 * Цель — снизить риск случайного утечки персональных данных конечных
 * клиентов наших пользователей (бизнесов). Маскирование применяется
 * на стороне API при отдаче, чтобы никакая UI-ошибка не открыла
 * полные данные. Если нужна полная информация для конкретной задачи —
 * читать напрямую из Prisma в скрипте.
 */

/**
 * Маскирует телефон: оставляет первые 4 и последние 2 цифры.
 *   "+998901234567" → "+998 90 *** 67"
 *   "+77017654321"  → "+770 1 *** 21"
 *   "8901234567"    → "8901 *** 67"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 6) return phone;
  const head = digits.slice(0, 4);
  const tail = digits.slice(-2);
  const prefix = phone.startsWith("+") ? "+" : "";
  return `${prefix}${head} *** ${tail}`;
}

/**
 * Маскирует email: первые 3 буквы локальной части видны, остальное скрыто.
 *   "anton@gmail.com" → "ant***@gmail.com"
 *   "ab@x.com"        → "***@x.com"
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at < 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 3) return `***${domain}`;
  return `${local.slice(0, 3)}***${domain}`;
}

/**
 * Маскирует длинные числовые ID (telegramId, chat IDs):
 *   "1234567890" → "1234***890"
 */
export function maskNumericId(id: string | null | undefined): string {
  if (!id) return "";
  if (id.length <= 6) return id;
  return `${id.slice(0, 4)}***${id.slice(-3)}`;
}

/**
 * Маскирует имя клиента: оставляет первую букву + первую букву фамилии.
 *   "Farrukh Kamolov" → "F. K."
 *   "Иван"            → "И."
 *   ""                → "(без имени)"
 */
export function maskName(name: string | null | undefined): string {
  if (!name || !name.trim()) return "(без имени)";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return `${parts[0][0]}.`;
  return `${parts[0][0]}. ${parts[1][0]}.`;
}

/**
 * Поверхностная попытка убрать PII из текста сообщения.
 * Не идеальная — для случайного скрытия достаточно,
 * для серьёзной анонимизации нужен NER.
 */
export function maskPiiInText(text: string): string {
  if (!text) return "";
  return text
    // телефоны: +998 90 123 45 67, 8 (901) 234-56-78 и т.п.
    .replace(/(?<!\d)(\+?\d[\d\s\-()]{8,}\d)(?!\d)/g, (m) => maskPhone(m))
    // email
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, (m) => maskEmail(m));
}
