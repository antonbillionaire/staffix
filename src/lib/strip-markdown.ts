/**
 * Strip Markdown / HTML formatting from bot responses before sending to clients.
 *
 * Why: Claude часто отвечает с Markdown (**bold**, ## headers, [link](url) и т.п.).
 * Клиенты видят это как мусор: WhatsApp/Facebook показывают звёздочки буквально,
 * Telegram с parse_mode=HTML тоже не понимает Markdown. Результат — клиенту
 * приходит "**Цена:** 1391 USD" вместо нормального текста.
 *
 * Стратегия: оставляем содержание, убираем разметку. Списки и переносы строк
 * сохраняем — они улучшают читаемость в любом мессенджере.
 */

/**
 * Превращает markdown-форматированный текст в чистый человеческий plain-text.
 * Безопасно для всех каналов (Telegram без parse_mode, WhatsApp, Instagram, FB).
 */
export function stripMarkdown(input: string | null | undefined): string {
  if (!input) return "";
  let text = input;

  // 1. Кодовые блоки ```lang\n…\n``` — сохраняем содержимое, убираем огранки
  text = text.replace(/```[a-zA-Z0-9]*\n?([\s\S]*?)```/g, "$1");

  // 2. Inline-код `text` — оставляем содержимое
  text = text.replace(/`([^`]+)`/g, "$1");

  // 3. Markdown-картинки ![alt](url) — оставляем alt
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // 4. Markdown-ссылки [text](url) — превращаем в "text (url)" если url отличается,
  //    или просто оставляем text если содержание идентично
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, txt: string, url: string) => {
    const cleanText = txt.trim();
    const cleanUrl = url.trim();
    if (!cleanText || cleanText === cleanUrl) return cleanUrl;
    // Не дублируем url если он уже упомянут в тексте
    if (cleanText.includes(cleanUrl)) return cleanText;
    return `${cleanText} (${cleanUrl})`;
  });

  // 5. Жирный/курсив с двойными маркерами: **text**, __text__
  text = text.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  text = text.replace(/__([^_\n]+)__/g, "$1");

  // 6. Курсив с одинарными маркерами: *text*, _text_
  //    Аккуратно — только если маркеры стоят на границах слова и нет пробелов внутри сразу после/перед маркером.
  //    Это убирает Markdown-курсив, но не задевает звёздочки в "5 * 2" или snake_case.
  text = text.replace(/(^|[\s({\[])\*(?!\s)([^*\n]+?)(?<!\s)\*(?=$|[\s,.;:!?)}\]])/g, "$1$2");
  text = text.replace(/(^|[\s({\[])_(?!\s)([^_\n]+?)(?<!\s)_(?=$|[\s,.;:!?)}\]])/g, "$1$2");

  // 7. Зачёркнутый ~~text~~
  text = text.replace(/~~([^~\n]+)~~/g, "$1");

  // 8. Заголовки # / ## / ### — убираем символы решёток в начале строки
  text = text.replace(/^#{1,6}\s+/gm, "");

  // 9. Цитаты "> text" — убираем маркер
  text = text.replace(/^>\s?/gm, "");

  // 10. Горизонтальные линии --- *** ___ — убираем
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, "");

  // 11. Списки с маркерами "- item", "* item", "+ item" — превращаем в "• item"
  //     (Telegram/WhatsApp/IG нормально показывают bullet-символ, читаемее чем пустота.)
  text = text.replace(/^([ \t]*)[-*+]\s+/gm, "$1• ");

  // 12. Убираем простейшие HTML-теги (<b>, <i>, <strong>, <em>, <br>, <p>) — оставляем содержимое
  text = text.replace(/<\s*br\s*\/?\s*>/gi, "\n");
  text = text.replace(/<\/?\s*(b|strong|i|em|u|s|del|p|span|div|code|pre)[^>]*>/gi, "");

  // 13. Декодируем самые частые HTML-сущности на случай если попали из документов
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'");

  // 14. Чистим лишние пустые строки (3+ подряд → 2)
  text = text.replace(/\n{3,}/g, "\n\n");

  // 15. Trim по краям
  return text.trim();
}
