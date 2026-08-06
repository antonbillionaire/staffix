/**
 * Phone parser (6 августа 2026, OLLEE incident):
 *
 * Расширенный парсер номеров с учётом локальных форматов и обнаружением
 * коротких (неполных) номеров. Заменяет старый extractPhone (ai-memory.ts:
 * 1163) в hard-code guard'ах channel-ai.ts и telegram/ai.ts — старый
 * распознавал только «полные» номера с кодом страны, из-за чего OLLEE
 * теряла лидов: клиент писал «мой номер 99888888» (узб. локальный формат
 * без +998), парсер возвращал null, guard срабатывал 6 раз подряд с
 * идентичной фразой — конверсия ноль.
 *
 * Стратегия:
 *   1. Полные международные форматы (+7, +998, +996, ...) — как раньше
 *   2. Локальные форматы под конкретную country бизнеса (UZ: 9 цифр с 9,
 *      RU: 10 цифр с 9, KZ: 10 с 7, KG: 9 с 5/7/9, UA: 10 с 0)
 *   3. «Неполный номер» (5-11 цифр не подошедших под 1-2) — сигнал
 *      «клиент, вероятно, недописал»; guard просит проверить/уточнить
 *
 * Contextual filter: цифровые последовательности внутри «Цена 145 000 сум»
 * НЕ считаются номерами (даже 6-цифровыми). Смотрим ключевые слова:
 *   - price-context («сум», «стоит», «цена», «рубл») → incomplete=false
 *   - phone-context («телефон», «номер», «свяжитесь») → incomplete=true
 *     даже без явного полного номера в тексте
 *   - если ни то ни другое — incomplete=true только на коротких сообщениях
 *     (≤80 символов, вероятно это просто попытка передать номер)
 */

export type PhoneCountry = "UZ" | "RU" | "KZ" | "KG" | "UA" | "BY" | "GE" | "AM" | "AZ" | "TJ" | "TM" | "MD" | null | undefined;

export interface PhoneDetection {
  /** Нормализованный номер в формате +XXXXXXXXXXXX или null если не найден */
  phone: string | null;
  /**
   * true если в сообщении есть последовательность 5-11 цифр похожая на номер,
   * но парсер не смог её нормализовать (не хватает цифр / неверная страна).
   * Guard должен попросить клиента проверить/дописать.
   */
  incomplete: boolean;
}

// Захватываем последовательности вида «телефон-подобные» с разделителями
// пробелов / скобок / дефисов. От 3 до 21 символа — реально ловит от 3 цифр
// подряд и до +XXX XXX XXX XX XX. Требуется цифра в начале и в конце.
const CANDIDATE_REGEX = /(?:^|[^\d])(\+?[\d][\d\s()\-]{0,20}\d)/g;

// Валидные коды стран для международных номеров
const CC2 = new Set(["7"]);
const CC3 = new Set(["998", "996", "995", "994", "993", "992", "380", "375", "373"]);

/**
 * Локальные форматы: 9-10 цифр без кода страны. Списки первых цифр — по
 * мобильным префиксам операторов.
 */
interface LocalRule {
  length: number;
  startsWith: string[];
  countryCode: string;
  /** Если true — при матче отбрасываем ведущую цифру (например UA `0671234567` → `+38067...`). */
  stripLeading?: boolean;
}
const LOCAL_MOBILE_RULES: Partial<Record<NonNullable<PhoneCountry>, LocalRule[]>> = {
  UZ: [{ length: 9, startsWith: ["9"], countryCode: "998" }],
  RU: [{ length: 10, startsWith: ["9"], countryCode: "7" }],
  KZ: [{ length: 10, startsWith: ["7"], countryCode: "7" }],
  KG: [{ length: 9, startsWith: ["5", "7", "9"], countryCode: "996" }],
  UA: [
    { length: 9, startsWith: ["3", "5", "6", "7", "9"], countryCode: "380" },
    { length: 10, startsWith: ["0"], countryCode: "380", stripLeading: true },
  ],
  BY: [{ length: 9, startsWith: ["2", "3", "4"], countryCode: "375" }],
};

// Контекстные ключевые слова
const PHONE_KEYWORDS = [
  "телефон", "номер", "тел.", "тел ", "тел:", "связь", "свяжит", "позвон",
  "звонит", "звонок", "мобил", "сотов", "whatsapp", "вотсап", "ватсап",
  "phone", "call ", "callback",
];
const PRICE_KEYWORDS = [
  "сум", "руб", "тенге", "тг ", " тг", "сом ", " ₽", "$", "€", "стоит", "стоим",
  "цен", "прайс", "sum ", "рубл", "долл", "евро", "стоимо",
];

function hasKeyword(message: string, list: string[]): boolean {
  const l = message.toLowerCase();
  return list.some((k) => l.includes(k));
}

/**
 * Основная функция: возвращает { phone, incomplete }.
 * country — из Business.country, помогает интерпретировать локальные форматы.
 */
export function detectPhone(message: string, country?: PhoneCountry): PhoneDetection {
  const result: PhoneDetection = { phone: null, incomplete: false };
  if (!message) return result;

  const matches = Array.from(message.matchAll(CANDIDATE_REGEX));
  if (matches.length === 0) return result;

  // Собираем все digit-only последовательности с достаточным количеством цифр
  const candidates = matches
    .map((m) => m[1].replace(/[^\d]/g, ""))
    .filter((d) => d.length >= 5); // короче 5 — точно не номер
  if (candidates.length === 0) return result;

  // Проход 1 — ищем ПОЛНЫЕ международные форматы (приоритетно)
  for (let digits of candidates) {
    // 8XXXXXXXXXX (старый RU/KZ) → 7XXXXXXXXXX
    if (digits.length === 11 && digits.startsWith("8")) digits = "7" + digits.slice(1);
    if (digits.length === 11 && CC2.has(digits[0])) return { phone: "+" + digits, incomplete: false };
    if (digits.length === 12 && CC3.has(digits.slice(0, 3))) return { phone: "+" + digits, incomplete: false };
  }

  // Проход 2 — локальные форматы по country бизнеса
  const rules = country ? LOCAL_MOBILE_RULES[country] : undefined;
  if (rules) {
    for (const digits of candidates) {
      for (const rule of rules) {
        if (digits.length !== rule.length) continue;
        if (!rule.startsWith.some((d) => digits.startsWith(d))) continue;
        const localPart = rule.stripLeading ? digits.slice(1) : digits;
        return { phone: "+" + rule.countryCode + localPart, incomplete: false };
      }
    }
  }

  // Проход 3 — «неполный номер». Контекстный фильтр защищает от ложных
  // срабатываний на ценах и артикулах.
  const isPriceContext = hasKeyword(message, PRICE_KEYWORDS);
  if (isPriceContext) return result; // ничего не помечаем как incomplete

  const isPhoneContext = hasKeyword(message, PHONE_KEYWORDS);
  const isShortMessage = message.length <= 80;

  // Триггерим incomplete если:
  // - есть phone-context слова (клиент явно намекает про номер)
  // - ИЛИ сообщение короткое и есть 5-11 цифр (вероятно попытка дать номер)
  const hasNumericCandidate = candidates.some((d) => d.length >= 5 && d.length <= 11);
  if (hasNumericCandidate && (isPhoneContext || isShortMessage)) {
    result.incomplete = true;
  }

  return result;
}

/**
 * Backwards compatible shortcut — возвращает только phone (для мест где
 * incomplete не нужен).
 */
export function extractPhoneStrict(message: string, country?: PhoneCountry): string | null {
  return detectPhone(message, country).phone;
}
