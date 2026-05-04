/**
 * AI-нормализация запроса при поиске товара.
 *
 * Зачем: substring-поиск находит точные совпадения, а пользователи делают опечатки
 * («клеопара» вместо «Cleopatra»), пишут латиницу когда товар на кириллице (или наоборот),
 * сокращают, склоняют. Когда searchProducts ничего не нашёл — даём Claude Haiku
 * список реальных названий из каталога и просим нормализовать запрос.
 *
 * Стоимость: ~$0.0005 за вызов, дёргается ТОЛЬКО когда обычный поиск пуст.
 *
 * Контракт:
 *   normalizeQuery("клеопара", businessId) → "Cleopatra"
 *   normalizeQuery("xyz", businessId)      → null
 *
 * Возвращает строку для повторного поиска, либо null если AI ничего похожего не увидел.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
// Не больше N вариантов из БД — иначе промпт пухнет. Топ-150 покрывает обычно весь каталог.
const MAX_CANDIDATES = 150;

export async function normalizeProductQuery(
  query: string,
  businessId: string
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const trimmed = query.trim();
  if (trimmed.length < 2) return null;

  // Собираем кандидатов: уникальные имена + категории
  const products = await prisma.product.findMany({
    where: { businessId, isActive: true },
    select: { name: true, category: true },
    take: MAX_CANDIDATES,
    orderBy: { createdAt: "desc" },
  });

  if (products.length === 0) return null;

  const names = Array.from(new Set(products.map((p) => p.name).filter(Boolean)));
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter((c): c is string => !!c))
  );

  if (names.length === 0 && categories.length === 0) return null;

  const prompt = `Клиент написал в поиске: "${trimmed}"

Возможно это опечатка или транслитерация. Вот реальные названия и категории товаров в нашем каталоге:

Названия товаров: ${names.slice(0, 100).join(", ")}

Категории: ${categories.join(", ")}

Найди что КЛИЕНТ ИМЕЛ В ВИДУ. Учти:
- Транслит: "клеопатра" = "Cleopatra", "марвел" = "Marvel"
- Опечатки: "клеопара" → "Cleopatra"
- Склонение: "клеев" → "Клей"
- Короткие коды: "Д" = изгиб "D"

Верни СТРОГО JSON без пояснений:
- если нашёл совпадение: {"match": "точное название из списка"}
- если ничего похожего: {"match": null}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");

    const cleaned = text.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as { match?: string | null };
    if (typeof parsed.match === "string" && parsed.match.trim()) {
      return parsed.match.trim();
    }
    return null;
  } catch (error) {
    console.error("[product-search-fallback] normalizeQuery failed:", error);
    return null;
  }
}
