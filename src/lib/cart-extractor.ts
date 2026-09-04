/**
 * Cart extractor (6 августа 2026, OLLEE conv-9 fix):
 *
 * Держит устойчивую память состава заказа между turn'ами. До этого модуля
 * корзина существовала только «в голове» LLM — в conv-9 у OLLEE суммы
 * прыгали 8 раз (606→454→493→596→693→339→523→559→220 сум) за диалог,
 * товары забывались, ассортимент менялся без запроса клиента.
 *
 * Как работает:
 *   1. После каждого ответа бота — запускается async extractCartFromMessages()
 *   2. Haiku 4.5 читает последние 6 сообщений и возвращает JSON-структуру
 *      { items: [{name, price, quantity, currency}], total, status }
 *   3. Результат сохраняется в Conversation.extractedInfo.cart или
 *      ChannelConversation.extractedInfo.cart
 *   4. При следующем вызове AI — cart подставляется в variable-часть промпта
 *      как «Текущая корзина клиента (Х позиций на Y сум)»
 *
 * Экономно: короткий промпт (~300 input + 100 output tokens), Haiku 4.5
 * — стоит ~$0.001 на turn. Не блокирует ответ клиенту (fire-and-forget).
 *
 * Устойчиво к ошибкам: если Haiku вернёт мусор — сохраняем предыдущее
 * состояние корзины, не портим память.
 */

import Anthropic from "@anthropic-ai/sdk";
import { callClaudeWithRetry, logClaudeUsage } from "@/lib/claude-retry";

export interface CartItem {
  name: string;
  price: number;
  quantity: number;
  currency?: string;
}

export interface CartSnapshot {
  items: CartItem[];
  total: number;
  currency: string;
  /**
   * Стадия корзины:
   *   - "browsing" — клиент просто смотрит, корзина пуста
   *   - "assembling" — клиент выбирает, есть промежуточные позиции
   *   - "confirmed" — заказ подтверждён клиентом (пора звать create_order)
   *   - "ordered" — create_order уже вызван, заказ создан
   */
  status: "browsing" | "assembling" | "confirmed" | "ordered";
  /**
   * Список товаров которые бот УЖЕ УПОМЯНУЛ клиенту в этом диалоге
   * (даже если клиент не добавил их в корзину). Нужен чтобы при
   * «расскажи подробнее» / «а что насчёт Y?» бот помнил ВСЕ ранее
   * названные позиции, а не только те что в корзине. Расширение
   * 4 сентября 2026 после OLLEE-фидбэка (пп. 5, 6): «упоминал
   * гидрофильное масло, потом при уточнении забыл про него».
   *
   * До 30 названий, каждое до 100 символов, дедуплицированы.
   * Обновляется вместе с корзиной (Haiku-экстрактор возвращает оба поля).
   */
  discussedProducts: string[];
  /** ISO timestamp последнего обновления — для дебага и rollback */
  updatedAt: string;
}

export const EMPTY_CART: CartSnapshot = {
  items: [],
  total: 0,
  currency: "сум",
  status: "browsing",
  discussedProducts: [],
  updatedAt: new Date(0).toISOString(),
};

interface HistoryMessage {
  role: string;
  content: string;
}

const EXTRACTOR_SYSTEM = `Ты — парсер состояния диалога магазина. Читаешь последние сообщения между клиентом и ботом-продавцом, возвращаешь (1) ТЕКУЩИЙ актуальный состав корзины клиента И (2) список ВСЕХ товаров которые бот уже упоминал клиенту (обсуждал, рекомендовал, показывал) в этом диалоге — даже если клиент их не выбрал.

Правила по корзине (items/total/status):
- Смотришь ПОСЛЕДНЕЕ состояние корзины. Если клиент менял состав — берёшь финальный вариант.
- Если клиент отказался от товара — исключаешь его из items.
- Если клиент подтвердил заказ («да», «оформляйте», «беру») — status="confirmed".
- Если бот уже вызвал create_order (видно по тексту «Заказ создан», «Заказ №», «оформлен») — status="ordered".
- Если клиент только смотрит / уточняет / не выбрал ничего конкретного — status="browsing", items=[].
- Валюта — как в тексте (сум/руб/тенге/сом). Если не понятно — "сум" по умолчанию.

Правила по discussedProducts:
- Включай КАЖДЫЙ товар который бот назвал клиенту в этом фрагменте диалога, даже если клиент им не заинтересовался.
- Название — так как оно звучало в тексте бота (короткое, без описаний). Например: "Гидрофильное масло", "BB-крем Matte Skin SPF50+", "Пенка с углём".
- Не включай общие категории («крем», «сыворотка»), только конкретные наименования.
- Не дублируй — один товар = одна строка.
- Максимум 30 позиций.
- Если бот в этом фрагменте ничего конкретного не называл — верни пустой массив [].

Верни СТРОГО JSON без markdown/пояснений:
{
  "items": [{"name": "название", "price": число, "quantity": число, "currency": "сум"}],
  "total": число_сумма,
  "currency": "сум",
  "status": "browsing" | "assembling" | "confirmed" | "ordered",
  "discussedProducts": ["Название 1", "Название 2"]
}`;

/**
 * Извлекает текущее состояние корзины из последних сообщений диалога.
 * Fire-and-forget вызов: если что-то пошло не так, возвращаем null и
 * caller оставляет прежнее состояние корзины в БД.
 */
export async function extractCartFromMessages(
  messages: HistoryMessage[],
  businessId: string,
  previousDiscussed: string[] = []
): Promise<CartSnapshot | null> {
  if (messages.length < 2) return null;

  // Берём последние 6 сообщений — этого достаточно для актуального состояния,
  // не раздуваем промпт большими историями (кэш всё равно per-conversation).
  const recent = messages.slice(-6).map((m) => {
    const label = m.role === "assistant" ? "Бот" : "Клиент";
    // Обрезаем длинные сообщения — cart-relevant инфа обычно в начале
    const content = m.content.length > 800 ? m.content.slice(0, 800) + "..." : m.content;
    return `${label}: ${content}`;
  }).join("\n\n");

  try {
    const response = await callClaudeWithRetry({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: EXTRACTOR_SYSTEM,
      messages: [{ role: "user", content: recent }],
    });
    logClaudeUsage("cart-extractor", response.usage, { biz: businessId });

    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) return null;

    // Haiku иногда добавляет ```json ... ``` — стрипаем на всякий
    let jsonText = textBlock.text.trim();
    const fence = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fence) jsonText = fence[1].trim();

    const parsed = JSON.parse(jsonText);
    // previousDiscussed передаётся чтобы за длинный диалог не потерять товары
    // упомянутые в давних turn'ах (окно Haiku всего 6 сообщений).
    return normalizeCartSnapshot(parsed, previousDiscussed);
  } catch (e) {
    // Fallback: не портим существующую корзину, просто возвращаем null.
    // Caller сохранит previous state как есть.
    console.warn(`[cart-extractor] failed for biz=${businessId}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * Санитизация ответа Haiku — защита от мусорных значений (LLM иногда возвращает
 * строки вместо чисел, забывает поля, дублирует позиции).
 *
 * `previousDiscussed` — список товаров которые бот упоминал в ПРЕДЫДУЩИХ turn'ах
 * (не входят в текущее окно из 6 сообщений которое видит Haiku). Мы их
 * сохраняем и мержим с текущим извлечённым списком, чтобы за длинный диалог
 * не потерять товары упомянутые давно (расширение 4 сентября 2026 после
 * OLLEE-фидбэка про потерю гидрофильного масла).
 */
export function normalizeCartSnapshot(
  raw: unknown,
  previousDiscussed: string[] = []
): CartSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  const validStatuses = new Set(["browsing", "assembling", "confirmed", "ordered"]);
  const status = validStatuses.has(String(obj.status))
    ? (obj.status as CartSnapshot["status"])
    : "browsing";

  const currency = typeof obj.currency === "string" && obj.currency.length < 10
    ? obj.currency
    : "сум";

  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  const items: CartItem[] = [];
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const it = rawItem as Record<string, unknown>;
    const name = typeof it.name === "string" ? it.name.trim().slice(0, 200) : "";
    if (!name) continue;
    const price = Number(it.price);
    const quantity = Number(it.quantity) || 1;
    if (!Number.isFinite(price) || price < 0 || price > 100_000_000) continue;
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) continue;
    items.push({
      name,
      price: Math.round(price),
      quantity: Math.round(quantity),
      currency: typeof it.currency === "string" ? it.currency : currency,
    });
    if (items.length >= 30) break; // защита от раздутых корзин
  }

  const totalFromItems = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const totalFromRaw = Number(obj.total);
  // Предпочитаем total от AI если он есть и не сильно отличается от расчёта,
  // иначе — считаем сами (защита от мусорного значения от LLM)
  const total =
    Number.isFinite(totalFromRaw) &&
    totalFromRaw >= 0 &&
    (totalFromItems === 0 || Math.abs(totalFromRaw - totalFromItems) < totalFromItems * 0.3)
      ? Math.round(totalFromRaw)
      : totalFromItems;

  // discussedProducts: merge previous + current (dedup case-insensitive)
  const rawDiscussed = Array.isArray(obj.discussedProducts) ? obj.discussedProducts : [];
  const merged: string[] = [];
  const seenLower = new Set<string>();
  const addName = (raw: unknown) => {
    if (typeof raw !== "string") return;
    const trimmed = raw.trim().slice(0, 100);
    if (!trimmed || trimmed.length < 2) return;
    const key = trimmed.toLowerCase();
    if (seenLower.has(key)) return;
    seenLower.add(key);
    merged.push(trimmed);
  };
  // Сначала предыдущие (сохраняем историческую последовательность),
  // потом свежие из текущего окна — новые попадают в конец.
  for (const name of previousDiscussed) addName(name);
  for (const name of rawDiscussed) addName(name);
  // Также автоматически включаем всё что сейчас в корзине — эти позиции
  // точно обсуждали, даже если Haiku их не вынес в discussedProducts.
  for (const it of items) addName(it.name);
  const discussedProducts = merged.slice(0, 30);

  return {
    items,
    total,
    currency,
    status: items.length === 0 && status !== "ordered" ? "browsing" : status,
    discussedProducts,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Форматирует корзину для системного промпта. Возвращает пустую строку если
 * корзина пуста / устарела (>1 час — вероятно новый диалог) — не хотим
 * подставлять устаревшие данные в промпт.
 */
export function formatCartForPrompt(cart: CartSnapshot | null): string {
  if (!cart) return "";
  const hasCart = cart.items.length > 0;
  const hasDiscussed = (cart.discussedProducts?.length ?? 0) > 0;
  if (!hasCart && !hasDiscussed) return "";

  const ageMs = Date.now() - new Date(cart.updatedAt).getTime();
  if (ageMs > 60 * 60 * 1000) return ""; // старше часа — не показываем

  const parts: string[] = [];

  if (hasCart) {
    const statusLabel = {
      browsing: "клиент только смотрит",
      assembling: "клиент выбирает",
      confirmed: "клиент подтвердил заказ — можно вызвать create_order",
      ordered: "заказ уже создан",
    }[cart.status];

    const itemsList = cart.items
      .map(
        (it) =>
          `- ${it.name} × ${it.quantity} = ${it.price * it.quantity} ${
            it.currency || cart.currency
          }`
      )
      .join("\n");

    parts.push(
      `## 🛒 ТЕКУЩАЯ КОРЗИНА КЛИЕНТА (${statusLabel})
Не выдумывай другие позиции — актуальный состав тут:
${itemsList}
ИТОГО: ${cart.total} ${cart.currency}

Правила работы с корзиной:
- Если клиент попросит добавить/убрать — обновляй эту корзину, не собирай новую с нуля
- Сумма и позиции ниже — источник правды, НЕ пересобирай их произвольно
- Если клиент подтвердил (${
        cart.status === "confirmed" ? "УЖЕ ПОДТВЕРДИЛ" : "скажет «беру»/«оформляй»"
      }) — вызывай create_order`
    );
  }

  if (hasDiscussed) {
    // Показываем список товаров о которых бот уже говорил клиенту в диалоге.
    // Нужен чтобы при «расскажите подробнее» / «а что насчёт Y?» бот
    // раскрывал ВСЕ ранее названные позиции, а не только те что в корзине.
    // OLLEE-фидбэк 4 сентября 2026 (пп. 5, 6): «упомянул гидрофильное масло,
    // потом забыл про него при уточнении».
    const list = cart.discussedProducts
      .slice(0, 30)
      .map((n) => `- ${n}`)
      .join("\n");
    parts.push(
      `## 🗂️ УЖЕ ОБСУЖДАЛИ В ЭТОМ ДИАЛОГЕ
Эти товары ты (бот) уже называл клиенту раньше в разговоре — помни про них:
${list}

Правила:
- На «расскажите подробнее о том что предложили» — раскрой ВСЕ товары из этого списка, не формируй новый набор
- На «а что насчёт X?» — если X есть в списке, значит уже упоминал, продолжай разговор о нём (не начинай как впервые)
- Не забывай товар из этого списка когда клиент задаёт вопрос по нему — например если предлагал гидрофильное масло, а клиент спрашивает про очищение, обязательно упомяни его снова`
    );
  }

  return parts.join("\n\n");
}
