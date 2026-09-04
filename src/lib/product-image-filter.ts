/**
 * Фильтр фото товаров под то что бот **реально написал в тексте** (4 сентября
 * 2026, OLLEE-fb #3).
 *
 * Проблема: раньше в webhook уходили ВСЕ imageUrl из последней пачки tool_results
 * (например, search_products вернул 5 товаров — все 5 фото). Но в тексте бот
 * обычно рекомендует только 2-3 из них. Клиент видит текст про 2 продукта и
 * 5 фото — путается: «что верить, тексту или картинкам?».
 *
 * Решение: после генерации текста извлекаем список названий/SKU каждого товара
 * из tool_results (стало ProductCandidate), потом оставляем только те чьё имя
 * (или SKU) реально упомянуто в тексте бота. Максимум N (по умолчанию 3) —
 * даже если бот перечислил 10 товаров, отправляем не больше 3 фото, иначе
 * клиента засыплет.
 *
 * Полностью чистая функция — без БД, без сетевых вызовов. Тестируется в изоляции.
 */

export interface ProductCandidate {
  /** Название товара как в каталоге / tool_result */
  name?: string | null;
  /** SKU / штрихкод / артикул */
  sku?: string | null;
  imageUrl: string;
}

const DEFAULT_MAX_IMAGES = 3;
const MIN_WORD_LEN = 4;
const MIN_SKU_LEN = 5;
/**
 * Длина префикса для stem-match. Русские склонения меняют 1-3 последних
 * символа («мицеллярнАЯ» / «мицеллярнУЮ» / «мицеллярнОЙ»), поэтому вместо
 * строгого substring по всему слову используем префикс. 6 — эмпирический
 * компромисс: длиннее → пропустим склонения, короче → false positive на
 * общих корнях («крем-*» может встретиться в двух товарах).
 */
const STEM_LEN = 6;

/**
 * Извлекает ProductCandidate[] из массива tool_results — те что вернул
 * search_products / get_product_details / etc. Формат tool_result.content:
 *   `{ products: [{name, sku, imageUrl}] }` или
 *   `{ product: {name, sku, imageUrl} }`
 * Контент может быть либо уже объект, либо JSON-строка.
 *
 * Дедуплицируем по imageUrl — один и тот же товар может попасть в несколько
 * tool_results (search + get_details), не хотим слать одно фото дважды.
 */
export function collectProductCandidates(
  toolResults: Array<{ content: unknown }>
): ProductCandidate[] {
  const out: ProductCandidate[] = [];
  const seenUrls = new Set<string>();

  const addOne = (raw: unknown) => {
    if (!raw || typeof raw !== "object") return;
    const p = raw as Record<string, unknown>;
    const imageUrl = typeof p.imageUrl === "string" ? p.imageUrl : null;
    if (!imageUrl || seenUrls.has(imageUrl)) return;
    const name = typeof p.name === "string" ? p.name : null;
    const sku = typeof p.sku === "string" ? p.sku : null;
    seenUrls.add(imageUrl);
    out.push({ name, sku, imageUrl });
  };

  for (const tr of toolResults) {
    let content: unknown = tr.content;
    if (typeof content === "string") {
      try {
        content = JSON.parse(content);
      } catch {
        continue;
      }
    }
    if (!content || typeof content !== "object") continue;
    const c = content as Record<string, unknown>;
    if (Array.isArray(c.products)) {
      for (const p of c.products) addOne(p);
    }
    if (c.product) {
      addOne(c.product);
    }
  }

  return out;
}

/**
 * Нормализует текст для fuzzy-сравнения:
 *  - lowercase
 *  - убираем эмодзи и небуквенные символы кроме пробелов и дефиса
 *  - схлопываем пробелы
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Возвращает «стемы» (первые STEM_LEN символов) значимых слов из имени
 * товара — то что мы будем искать в тексте бота. Значимое = длина ≥
 * MIN_WORD_LEN в нормализованной форме. Более короткие слова («SPF», «BB»)
 * пропускаем как слишком общие для стем-матча.
 *
 * Пример: name = "Мицеллярная вода" → tokens ["мицеллярная", "вода"] →
 * стемы ["мицелл", "вода"] (первый обрезан до 6, второй короче 6 — берётся
 * целиком). В тексте «советую мицеллярнУЮ водУ» стемы найдутся как
 * подстроки: «мицелл» ∈ «мицеллярную», «вода»... тут не сработает потому
 * что «воду» ≠ «вода» — но первого совпадения по «мицелл» уже достаточно.
 */
function significantStems(name: string): string[] {
  const norm = normalize(name);
  const tokens = norm.split(/[\s-]+/);
  return tokens
    .filter((t) => t.length >= MIN_WORD_LEN)
    .map((t) => (t.length > STEM_LEN ? t.slice(0, STEM_LEN) : t));
}

/**
 * True если товар (по имени или SKU) упомянут в тексте.
 * Правила:
 *  1. SKU (штрихкод/артикул, длина ≥ MIN_SKU_LEN) точной подстрокой в тексте
 *     → match. Это самое строгое: если бот написал «8809722156116» в тексте,
 *     значит явно ссылается на этот товар.
 *  2. Иначе хотя бы одно значимое слово (≥ MIN_WORD_LEN символов) из имени
 *     товара должно встретиться в тексте как подстрока. Например name =
 *     "BB-крем Matte Skin SPF50+" даёт значимые слова: bb-крем, matte, skin,
 *     spf50 → любое одно в тексте достаточно.
 *
 * Если у товара нет ни name, ни sku — считаем НЕ упомянутым (нельзя проверить).
 */
function isMentioned(candidate: ProductCandidate, textLower: string): boolean {
  if (candidate.sku && candidate.sku.length >= MIN_SKU_LEN) {
    if (textLower.includes(candidate.sku.toLowerCase())) return true;
  }
  if (candidate.name) {
    const stems = significantStems(candidate.name);
    if (stems.some((stem) => textLower.includes(stem))) return true;
  }
  return false;
}

/**
 * Из списка candidate'ов оставляет только те, чьё название/SKU реально
 * упомянуто в `text`, максимум `maxImages` штук. Порядок сохраняется —
 * первым идёт первый упомянутый (обычно порядок tool_results).
 *
 * Пустой text или пустой candidates → пустой массив (не гадаем).
 */
export function filterImagesByMention(
  text: string,
  candidates: ProductCandidate[],
  maxImages: number = DEFAULT_MAX_IMAGES
): string[] {
  if (!text || candidates.length === 0) return [];
  const textLower = normalize(text);
  if (!textLower) return [];

  const matched: string[] = [];
  for (const c of candidates) {
    if (matched.length >= maxImages) break;
    if (isMentioned(c, textLower)) {
      // Дедуп на всякий (collectProductCandidates уже дедуплит по URL, но
      // filterImagesByMention может вызываться и с внешним списком).
      if (!matched.includes(c.imageUrl)) matched.push(c.imageUrl);
    }
  }
  return matched;
}
