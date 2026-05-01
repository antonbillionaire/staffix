/**
 * Catalog Enricher — обогащение товаров переводом и поисковыми тегами.
 *
 * Зачем: search_products — буквальный SQL substring-поиск по name + description
 * + category + tags. Если каталог на английском, а клиент пишет на русском,
 * товар не найдётся. Решение — при импорте автоматически:
 *   1) переводим description и category на язык бизнеса (если они не на нём)
 *   2) генерируем 5-10 русских/локальных тегов-синонимов
 *   3) name и бренд оставляем как есть (договорённость с владельцем)
 *
 * Используется при POST /api/products и POST /api/import/products.
 * Также есть batch-функция для разовой обработки уже загруженного каталога.
 *
 * Стоимость: Haiku ≈ $0.001 за товар. Для 500 товаров — около $0.50.
 */

import Anthropic from "@anthropic-ai/sdk";

const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 600;

export interface EnrichInput {
  name: string;
  description?: string | null;
  category?: string | null;
  existingTags?: string[];
}

export interface EnrichOutput {
  description: string | null;
  category: string | null;
  tags: string[];
}

/**
 * Cyrillic-only language detection — простой и достаточный.
 * Если в строке >50% кириллических букв — считаем что русский (или близкий
 * восточно-славянский). Используем для skip'а если текст УЖЕ на нужном языке.
 */
function isCyrillic(text: string): boolean {
  if (!text) return false;
  const letters = text.match(/[a-zA-Zа-яА-ЯёЁ]/g) || [];
  if (letters.length === 0) return false;
  const cyr = letters.filter((ch) => /[а-яА-ЯёЁ]/.test(ch)).length;
  return cyr / letters.length > 0.5;
}

/**
 * Извлекает первый JSON-объект из markdown/plain ответа модели.
 */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```json|```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Обогащает один товар. Если description+category уже на кириллице,
 * не дёргаем Claude — просто докидываем теги из имени, если их нет.
 *
 * Не throw'ит — на ошибке возвращает исходные данные без изменений
 * (чтобы импорт не падал из-за rate limit или сети).
 */
export async function enrichProduct(input: EnrichInput, targetLanguage: string = "ru"): Promise<EnrichOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[catalog-enricher] ANTHROPIC_API_KEY not set — skipping enrichment");
    return {
      description: input.description ?? null,
      category: input.category ?? null,
      tags: input.existingTags ?? [],
    };
  }

  const targetCyrillic = ["ru", "uz", "kz"].includes(targetLanguage);
  const descNeedsTranslate = !!input.description && (targetCyrillic ? !isCyrillic(input.description) : isCyrillic(input.description));
  const catNeedsTranslate = !!input.category && (targetCyrillic ? !isCyrillic(input.category) : isCyrillic(input.category));
  const needsTags = !input.existingTags || input.existingTags.length < 3;

  // Если ничего обогащать не нужно — выходим без вызова Claude
  if (!descNeedsTranslate && !catNeedsTranslate && !needsTags) {
    return {
      description: input.description ?? null,
      category: input.category ?? null,
      tags: input.existingTags ?? [],
    };
  }

  const langName: Record<string, string> = {
    ru: "русский",
    uz: "узбекский",
    kz: "казахский",
    en: "английский",
  };
  const lang = langName[targetLanguage] || "русский";

  const prompt = `Ты помощник для каталога интернет-магазина. Обогащаешь карточку товара для поиска ботом.

Правила:
1. Название и бренд НЕ переводи — оставь как есть.
2. Description (описание для клиента) переведи на ${lang}, если он не на ${lang}. Если уже на ${lang} — улучши/оставь.
3. Category переведи на ${lang}, если она на другом языке.
4. Сгенерируй 5-10 поисковых тегов на ${lang}: синонимы, обиходные названия, какими словами клиент может спросить этот товар. Включай и общие термины и специфичные. Бренд можно НЕ повторять в тегах.

Вход:
- Name: ${input.name}
- Description: ${input.description || "(нет)"}
- Category: ${input.category || "(нет)"}
- Existing tags: ${(input.existingTags || []).join(", ") || "(нет)"}

Выведи СТРОГО JSON без пояснений:
{
  "description": "описание на ${lang}",
  "category": "категория на ${lang}",
  "tags": ["тег1", "тег2", "тег3", ...]
}`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("\n");

    const parsed = parseJsonObject(text);
    if (!parsed) {
      console.warn("[catalog-enricher] failed to parse model output:", text.slice(0, 200));
      return {
        description: input.description ?? null,
        category: input.category ?? null,
        tags: input.existingTags ?? [],
      };
    }

    const description = typeof parsed.description === "string" && parsed.description.trim()
      ? parsed.description.trim()
      : input.description ?? null;
    const category = typeof parsed.category === "string" && parsed.category.trim()
      ? parsed.category.trim()
      : input.category ?? null;

    // Объединяем сгенерированные теги с существующими, дедуплицируем (case-insensitive)
    const generatedTags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim())
      : [];
    const existing = (input.existingTags || []).map((t) => t.trim()).filter(Boolean);
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const tag of [...existing, ...generatedTags]) {
      const key = tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(tag);
    }

    return {
      description,
      category,
      tags: merged.slice(0, 15), // hard cap
    };
  } catch (error) {
    console.error("[catalog-enricher] enrichment failed:", error);
    return {
      description: input.description ?? null,
      category: input.category ?? null,
      tags: input.existingTags ?? [],
    };
  }
}

/**
 * Batch-обогащение: запускает enrichProduct по очереди с маленькой задержкой
 * чтобы не упереться в rate limit Anthropic. Возвращает массив с результатами
 * в том же порядке.
 */
export async function enrichProductsBatch(
  inputs: EnrichInput[],
  targetLanguage: string = "ru",
  delayMs: number = 200
): Promise<EnrichOutput[]> {
  const results: EnrichOutput[] = [];
  for (const input of inputs) {
    const out = await enrichProduct(input, targetLanguage);
    results.push(out);
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}
