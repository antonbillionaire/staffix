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
4. Сгенерируй 10-18 поисковых тегов — синонимы и варианты написания того же товара. Цель: чтобы клиент нашёл этот товар как бы он его ни написал.

ОБЯЗАТЕЛЬНО включи в теги:
а) **Транслитерацию латинских названий и брендов на ${lang}** и наоборот.
   Примеры: "Cleopatra" → добавь "клеопатра"; "Marvel" → "марвел"; "Tornado" → "торнадо"; "Neo" → "нео";
   "Lovely" → "лавли"; "Barbara" → "барбара".
   Если название уже на ${lang} — добавь латинский вариант.
б) **Морфологические формы категории на ${lang}** (если язык славянский — ru/uz-кир/kz):
   "Клей" → "клеи", "клея", "клею", "клеев", "клеем";
   "Ресницы" → "ресниц", "ресничка", "ресничный";
   "Пинцет" → "пинцеты", "пинцета", "пинцетом".
в) **Транслит коротких кодов и обозначений из названия** (1-3 буквы латиницей).
   "D" → "д", "изгиб д"; "C" → "с", "изгиб с"; "L" → "л", "изгиб л";
   "M" → "м"; "B" → "б"; "0.07" → "007", "толщина 007".
г) **Распространённые опечатки и сокращения** если они очевидны.
   "Cleopatra" → "клеопатра", "клеопара" (распространённая опечатка).
д) **ЭТАП / НАЗНАЧЕНИЕ ИСПОЛЬЗОВАНИЯ** — 1-3 функциональных тега, отвечающих
   на вопрос «когда и зачем этот товар применяют». Это ключевые slug'и по
   которым клиент ищет «средства для очищения» / «для увлажнения» / «для
   защиты от солнца» и т.п. Добавлено 4 сентября 2026 после OLLEE-фидбэка:
   искали «средства для очищения», бот выдавал мицеллярку и пенки, но
   пропускал энзимную пудру — потому что в её тегах не было слова «очищение».

   Определи ТИП товара и добавь соответствующие функциональные теги:

   **Косметика для лица / уход** (кремы, сыворотки, эссенции, пенки, тонеры,
   маски, скрабы, пудры-эксфолианты, солнцезащитные средства, средства для
   демакияжа, гидрофильные масла, мицеллярки, патчи):
   — «очищение», «умывание» (для пенок, гелей, мицеллярной воды, гидрофильных
     масел, энзимных пудр, скрабов)
   — «тонизация», «тонер», «тоник» (для тонеров, эссенций-тонеров)
   — «эссенция», «эссенции» (для эссенций и легких сывороток)
   — «сыворотка», «серум» (для сывороток и концентратов)
   — «увлажнение», «уход», «крем для лица» (для кремов, масел для лица)
   — «защита от солнца», «spf», «санскрин» (для солнцезащитных средств)
   — «снятие макияжа», «демакияж» (для средств для снятия макияжа)
   — «маска для лица», «маска» (для масок)
   — «эксфолиация», «пилинг», «скраб» (для скрабов, пилингов, пудр-эксфолиантов)
   — «патчи», «патч» (для гидрогелевых патчей)

   **Косметика для тела** — аналогично: «уход за телом», «скраб для тела»,
   «крем для рук», «дезодорант» и т.п.

   **Макияж** (BB-крем, тональный, тушь, помада, тени, румяна):
   — «макияж», «мейкап»
   — «тональная основа», «bb-крем» (для BB/CC/тональных)
   — «тушь для ресниц», «губная помада», «тени для век», «румяна» —
     соответственно, каждая по своему типу

   **Волосы** (шампуни, кондиционеры, маски для волос):
   — «уход за волосами», «шампунь», «кондиционер», «маска для волос»

   **Не-косметические категории** (еда, одежда, электроника, канцтовары,
   бытовая химия) — добавляй релевантные функциональные теги на своё
   усмотрение: «завтрак», «десерт», «напитки» для еды; «стирка», «уборка»
   для бытхимии; «верхняя одежда», «обувь» для одежды и т.п.

   Правило: добавляй ТОЛЬКО те функциональные теги которые действительно
   применимы к товару. Если не уверен — не добавляй, лучше пропустить чем
   поставить неправильный.

Бренд в name дублировать не обязательно, но в теги добавь и латиницу и кириллицу.

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
      // Hard cap 20 (расширен с 15 4 сентября 2026): stage-теги для этапов
      // ухода / применения (см. пункт «д» в промпте) добавили ещё 1-3 тега
      // на товар, 15 стало впритык для товаров с богатыми синонимами.
      tags: merged.slice(0, 20),
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
