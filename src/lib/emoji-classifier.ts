/**
 * Emoji-only message classifier (июль 2026).
 *
 * Задача: избегать полного вызова AI ($0.008/turn) на клиентские
 * сообщения типа «👍», «❤️», «🙏» — там не требуется рассуждение,
 * достаточно шаблонного ответа.
 *
 * Классификация:
 *   positive        — только позитивные эмодзи (благодарность, одобрение)
 *   negative        — есть хоть один негативный эмодзи (жалоба, недовольство)
 *   neutral         — только незнакомые/экзотические эмодзи
 *   not_emoji_only  — есть текст помимо эмодзи → передаём в AI как обычно
 *
 * Правила приоритета:
 *   - Один негативный переопределяет любое количество позитивных
 *     («❤️😡» — клиент явно недоволен, не благодарит).
 *   - «Неизвестный» эмодзи (не в списке позитивных/негативных) не влияет
 *     на классификацию если есть хотя бы один известный.
 *
 * Использование:
 *   const c = classifyEmojiMessage(userMessage);
 *   if (c === "not_emoji_only") { ... вызываем AI как раньше ... }
 *   else if (c === "positive") { ... отвечаем «Спасибо!» без AI ... }
 *   else if (c === "negative") { ... шаблон + эскалация менеджеру ... }
 *   else { ... skip (не отвечаем) ... }
 */

// Позитивные эмодзи: благодарность, одобрение, симпатия
const POSITIVE_EMOJI = new Set([
  // Сердца
  "❤", "🧡", "💛", "💚", "💙", "💜", "🤎", "🖤", "🤍",
  "💗", "💖", "💕", "💓", "💞", "💘", "💝", "💟", "❣",
  // Смайлы (радость / удовольствие)
  "😀", "😁", "😃", "😄", "😅", "😆", "😊", "🙂", "😇",
  "🥰", "😍", "🤩", "😘", "😗", "😙", "😚",
  "🤗", "🥳", "😌", "😎", "🤠",
  // Жесты (одобрение)
  "👍", "👌", "🤝", "🤞", "🫶", "🙌", "👏", "💪",
  // Молитва / благодарность
  "🙏",
  // Позитивные символы
  "✅", "✔", "☑", "✨", "⭐", "🌟", "💫", "🎉", "🎊", "🔥",
  "🚀", "🏆", "🥇", "💯",
]);

// Негативные эмодзи: злость, разочарование, отвращение, грусть
const NEGATIVE_EMOJI = new Set([
  // Злость
  "😠", "😡", "🤬", "😤", "👿", "💢",
  // Отказ / несогласие
  "👎", "🚫", "⛔", "❌", "🙅",
  // Отвращение
  "🤢", "🤮", "💩",
  // Разочарование / плач
  "😞", "😔", "😟", "😕", "🙁", "☹",
  "😢", "😭", "😩", "😫", "🥺",
  // Раздражение
  "😒", "🙄", "😑", "😐", "😬",
  // Страх / тревога
  "😰", "😨", "😱", "😖", "😣",
  // Скепсис / недоверие
  "🤨", "🤔",
]);

export type EmojiClassification = "positive" | "negative" | "neutral" | "not_emoji_only";

/**
 * Убирает whitespace, ZWJ и variation selectors из текста.
 * Нужно чтобы «❤️ 👍  🙏» превратилось в «❤👍🙏» для проверки isEmojiOnly.
 */
function stripDecorations(text: string): string {
  return text
    .replace(/\s+/g, "")
    .replace(/‍/g, "") // ZWJ (склеивает 👨‍👩‍👧 → 👨👩👧)
    .replace(/️/g, "") // Variation selector 16 (превращает ❤️ в ❤)
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, ""); // Skin tone modifiers (👍🏻 → 👍)
}

/**
 * Проверяет что после снятия «декораций» остались ТОЛЬКО эмодзи
 * (Extended_Pictographic по Unicode).
 */
function isEmojiOnly(text: string): boolean {
  const trimmed = (text || "").trim();
  if (!trimmed) return false;
  const stripped = stripDecorations(trimmed);
  if (!stripped) return false;
  // Node.js поддерживает Unicode property escapes с флагом u
  return /^\p{Extended_Pictographic}+$/u.test(stripped);
}

/**
 * Классифицирует сообщение клиента. См. описание в шапке файла.
 */
export function classifyEmojiMessage(text: string): EmojiClassification {
  if (!isEmojiOnly(text)) return "not_emoji_only";

  // Перебираем codepoints (после стрипа декораций). Surrogate pairs
  // разбираются через spread — [...str] даёт codepoints целиком.
  const codepoints = [...stripDecorations(text.trim())];

  let hasPositive = false;
  let hasNegative = false;

  for (const cp of codepoints) {
    if (NEGATIVE_EMOJI.has(cp)) hasNegative = true;
    else if (POSITIVE_EMOJI.has(cp)) hasPositive = true;
  }

  if (hasNegative) return "negative";
  if (hasPositive) return "positive";
  return "neutral";
}
