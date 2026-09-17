/**
 * Детерминированный префетч каталога (Этап 3.5.2 research-плана, 17 сент 2026).
 *
 * ПРОБЛЕМА. Вопрос «есть маска для лица?» стоит двух вызовов модели:
 * первый возвращает tool_use → search_products, второй превращает результат
 * SQL в текст. Первый вызов не решает ничего — он лишь переписывает сообщение
 * клиента в строку запроса. Это самая частая форма оборота в sales-режиме.
 *
 * РЕШЕНИЕ. Поиск по каталогу — это SQL, а не работа для LLM. Прогоняем его
 * заранее (параллельно с остальной подготовкой) и кладём результат в
 * переменный блок промпта. Модель отвечает первым же вызовом.
 *
 * Инструмент search_products остаётся на месте: клиент может спросить о том,
 * чего в его сообщении дословно нет («а что-нибудь подешевле?»), и модель
 * должна уметь искать сама. Префетч — ускорение частого случая, не замена.
 *
 * ЧЕГО ЗДЕСЬ СОЗНАТЕЛЬНО НЕТ:
 * — Haiku-нормализатора запроса. Он живёт внутри searchProducts и дёргается,
 *   когда raw SQL ничего не нашёл. На префетче это был бы вызов Haiku на
 *   каждое «спасибо» — дороже, чем сэкономленная итерация. Передаём
 *   skipAiFallback; модель, вызвав инструмент явно, fallback получает.
 * — Совпадений только по description. «Крем» в описании товара — слабый
 *   сигнал, и подмешивать такое без спроса клиента значит навязывать не то.
 *   Оставляем только попадания в название, теги или категорию.
 */

import { searchProducts } from "@/lib/sales-tools";

/**
 * Слова, по которым искать в каталоге бессмысленно: вежливость, согласие,
 * служебные части речи. Без этого списка «да» уходит в LIKE '%да%' и
 * вытаскивает «Помаду» и «Воду» на ровном месте.
 */
const CHAT_NOISE = new Set([
  "да", "нет", "ок", "окей", "хорошо", "ладно", "понятно", "спасибо",
  "пожалуйста", "привет", "здравствуйте", "добрый", "день", "утро", "вечер",
  "ночи", "прощай", "пока", "жду", "буду", "давайте", "давай", "можно",
  "хочу", "нужно", "надо", "есть", "это", "что", "как", "где", "когда",
  "почему", "сколько", "какой", "какая", "какие", "ваш", "ваша", "ваши",
  "меня", "вас", "нас", "him", "her", "yes", "no", "ok", "okay", "thanks",
  "hello", "hi", "please", "want", "need", "have", "what", "how", "where",
]);

const MIN_TOKEN_LEN = 4;
const MAX_TOKENS = 12;
const MAX_ITEMS = 5;

/** Токены сообщения, по которым имеет смысл искать товар. */
export function queryTokens(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= MIN_TOKEN_LEN && !CHAT_NOISE.has(w) && !/^\d+$/.test(w))
    .slice(0, MAX_TOKENS);
}

type PrefetchProduct = {
  name: string;
  price: number;
  category: string | null;
  stockMessage: string;
};

/**
 * Попадание засчитывается, только если токен запроса нашёлся в названии,
 * тегах или категории. Совпадение по одному описанию отбрасываем —
 * см. комментарий в шапке файла.
 */
export function isStrongMatch(
  tokens: string[],
  p: { name: string; category?: string | null; tags?: string[] }
): boolean {
  const hay = [p.name, p.category || "", ...(p.tags || [])].join(" ").toLowerCase();
  return tokens.some((t) => hay.includes(t));
}

/** Текст блока для промпта. Пустая строка = подмешивать нечего. */
export function renderPrefetchBlock(query: string, items: PrefetchProduct[]): string {
  if (items.length === 0) return "";
  const lines = items.map((p, i) => {
    const cat = p.category ? ` [${p.category}]` : "";
    return `${i + 1}. ${p.name} — ${p.price} (${p.stockMessage})${cat}`;
  });
  return [
    "## НАЙДЕНО В КАТАЛОГЕ ПО ПОСЛЕДНЕМУ СООБЩЕНИЮ КЛИЕНТА",
    `Автоматический поиск по «${query}» (выполнен кодом, не тобой):`,
    ...lines,
    "",
    "Если этого достаточно для ответа — отвечай СРАЗУ, НЕ вызывай search_products повторно.",
    "Если клиент спрашивал о другом или нужны детали (состав, объём, фото) — этот блок игнорируй и работай инструментами.",
  ].join("\n");
}

/**
 * Возвращает готовый блок для переменной части промпта, либо пустую строку.
 * Никогда не бросает: префетч — ускорение, его отказ не должен ронять ответ.
 */
export async function prefetchCatalogBlock(
  businessId: string,
  userMessage: string
): Promise<string> {
  try {
    const tokens = queryTokens(userMessage);
    if (tokens.length === 0) return "";

    const query = tokens.join(" ");
    const res = await searchProducts(businessId, query, undefined, undefined, {
      skipAiFallback: true,
      includeTags: true,
    });
    if (!res.success || !res.found) return "";

    const products = (res.products || []) as Array<
      PrefetchProduct & { tags?: string[] }
    >;
    const strong = products.filter((p) => isStrongMatch(tokens, p)).slice(0, MAX_ITEMS);
    return renderPrefetchBlock(query, strong);
  } catch (e) {
    console.warn("[catalog-prefetch] failed, falling back to tool path:", e);
    return "";
  }
}
