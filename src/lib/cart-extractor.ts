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
  /** ISO timestamp последнего обновления — для дебага и rollback */
  updatedAt: string;
}

export const EMPTY_CART: CartSnapshot = {
  items: [],
  total: 0,
  currency: "сум",
  status: "browsing",
  updatedAt: new Date(0).toISOString(),
};

interface HistoryMessage {
  role: string;
  content: string;
}

const EXTRACTOR_SYSTEM = `Ты — парсер состава заказа из диалога магазина. Читаешь последние сообщения между клиентом и ботом-продавцом, возвращаешь ТЕКУЩИЙ актуальный состав корзины клиента.

Правила:
- Смотришь ПОСЛЕДНЕЕ состояние корзины. Если клиент менял состав — берёшь финальный вариант.
- Если клиент отказался от товара — исключаешь его.
- Если клиент подтвердил заказ («да», «оформляйте», «беру») — status="confirmed".
- Если бот уже вызвал create_order (видно по тексту «Заказ создан», «Заказ №», «оформлен») — status="ordered".
- Если клиент только смотрит / уточняет / не выбрал ничего конкретного — status="browsing", items=[].
- Валюта — как в тексте (сум/руб/тенге/сом). Если не понятно — "сум" по умолчанию.

Верни СТРОГО JSON:
{
  "items": [{"name": "название", "price": число, "quantity": число, "currency": "сум"}],
  "total": число_сумма,
  "currency": "сум",
  "status": "browsing" | "assembling" | "confirmed" | "ordered"
}

Никаких пояснений, никакого markdown — только JSON.`;

/**
 * Извлекает текущее состояние корзины из последних сообщений диалога.
 * Fire-and-forget вызов: если что-то пошло не так, возвращаем null и
 * caller оставляет прежнее состояние корзины в БД.
 */
export async function extractCartFromMessages(
  messages: HistoryMessage[],
  businessId: string
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
      max_tokens: 500,
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
    return normalizeCartSnapshot(parsed);
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
 */
export function normalizeCartSnapshot(raw: unknown): CartSnapshot | null {
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

  return {
    items,
    total,
    currency,
    status: items.length === 0 && status !== "ordered" ? "browsing" : status,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Форматирует корзину для системного промпта. Возвращает пустую строку если
 * корзина пуста / устарела (>1 час — вероятно новый диалог) — не хотим
 * подставлять устаревшие данные в промпт.
 */
export function formatCartForPrompt(cart: CartSnapshot | null): string {
  if (!cart || cart.items.length === 0) return "";

  const ageMs = Date.now() - new Date(cart.updatedAt).getTime();
  if (ageMs > 60 * 60 * 1000) return ""; // старше часа — не показываем

  const statusLabel = {
    browsing: "клиент только смотрит",
    assembling: "клиент выбирает",
    confirmed: "клиент подтвердил заказ — можно вызвать create_order",
    ordered: "заказ уже создан",
  }[cart.status];

  const itemsList = cart.items
    .map((it) => `- ${it.name} × ${it.quantity} = ${it.price * it.quantity} ${it.currency || cart.currency}`)
    .join("\n");

  return `## 🛒 ТЕКУЩАЯ КОРЗИНА КЛИЕНТА (${statusLabel})
Не выдумывай другие позиции — актуальный состав тут:
${itemsList}
ИТОГО: ${cart.total} ${cart.currency}

Правила работы с корзиной:
- Если клиент попросит добавить/убрать — обновляй эту корзину, не собирай новую с нуля
- Сумма и позиции ниже — источник правды, НЕ пересобирай их произвольно
- Если клиент подтвердил (${cart.status === "confirmed" ? "УЖЕ ПОДТВЕРДИЛ" : "скажет «беру»/«оформляй»"}) — вызывай create_order`;
}
