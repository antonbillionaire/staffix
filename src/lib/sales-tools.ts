/**
 * Sales Tools for AI Sales Bot
 * Инструменты Claude для работы с товарами и заказами
 *
 * Режим "магазин/продажи" — альтернатива booking режиму для сервисных бизнесов.
 */

import Anthropic from "@anthropic-ai/sdk";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { dispatchCrmEvent } from "./crm-integrations";
import { getPaymentButtons } from "./payment-links";
import { sendOwnerNotification } from "./notifications";
import { promoteDealStageByTelegram } from "./deal-pipeline";
import { logActivityFireAndForget } from "./activity-log";

const LOW_STOCK_THRESHOLD = 5;

// ========================================
// HELPERS
// ========================================

const COUNTRY_CURRENCY: Record<string, string> = {
  UZ: "сум", KZ: "тенге", RU: "руб.", KG: "сом", TJ: "сомони",
  AM: "драм", GE: "лари", US: "$", GB: "£",
};

function currencyLabel(country?: string | null): string {
  return COUNTRY_CURRENCY[country || "UZ"] || "сум";
}

// ========================================
// ТИПЫ
// ========================================

export interface SalesToolResult {
  success: boolean;
  error?: string;
  [key: string]: unknown;
}

// ========================================
// ОПРЕДЕЛЕНИЯ ИНСТРУМЕНТОВ ДЛЯ CLAUDE
// ========================================

export const salesToolDefinitions: Anthropic.Tool[] = [
  {
    name: "search_products",
    description:
      "Поиск товаров по запросу клиента. Используй когда клиент спрашивает о товарах, хочет выбрать что-то конкретное, или спрашивает о наличии.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Поисковый запрос: название товара, ключевые слова, категория",
        },
        category: {
          type: "string",
          description: "Фильтр по категории (необязательно)",
        },
        max_price: {
          type: "number",
          description: "Максимальная цена (необязательно, для фильтрации по бюджету)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_details",
    description:
      "Получить полную информацию о конкретном товаре: описание, характеристики, цену, наличие. Используй когда клиент заинтересовался конкретным товаром.",
    input_schema: {
      type: "object" as const,
      properties: {
        product_id: {
          type: "string",
          description: "ID товара из результатов поиска",
        },
      },
      required: ["product_id"],
    },
  },
  {
    name: "get_categories",
    description:
      "Получить список всех категорий товаров. Используй в начале разговора или когда клиент не знает что ищет.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "list_by_category",
    description:
      "Показать ВСЕ товары конкретной категории или бренда. Используй когда клиент просит обзор: «какие у вас клеи?», «покажите все ресницы», «что есть из Lovely», «весь ассортимент пинцетов». В отличие от search_products, этот инструмент не ищет по ключевым словам, а возвращает весь список в категории.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Название категории или бренда (например: Клей, Ресницы, Lovely, Barbara)",
        },
        max_price: {
          type: "number",
          description: "Максимальная цена (необязательно)",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "identify_client",
    description:
      "Найти клиента в базе бизнеса по телефону. Используй ОДИН РАЗ в начале диалога после того как клиент дал номер телефона. Если клиент найден — обращайся к нему по имени, упомяни его уровень лояльности и накопленный кэшбек/баллы. Если не найден — продолжай как с новым клиентом. Не вызывай повторно если уже идентифицировал.",
    input_schema: {
      type: "object" as const,
      properties: {
        phone: {
          type: "string",
          description: "Номер телефона клиента в любом формате (нормализуется автоматически)",
        },
      },
      required: ["phone"],
    },
  },
  {
    name: "create_order",
    description:
      "Создать заказ после того как клиент выбрал товары и подтвердил покупку. ОБЯЗАТЕЛЬНО: уточни имя, телефон и адрес доставки перед созданием заказа.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Имя клиента",
        },
        client_phone: {
          type: "string",
          description: "Номер телефона клиента",
        },
        client_address: {
          type: "string",
          description: "Адрес доставки (если нужна доставка)",
        },
        items: {
          type: "array",
          description: "Список товаров в заказе",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string", description: "ID товара" },
              quantity: { type: "number", description: "Количество" },
            },
            required: ["product_id", "quantity"],
          },
        },
        payment_method: {
          type: "string",
          description: "Способ оплаты: cash | card | online",
        },
        notes: {
          type: "string",
          description: "Пожелания или комментарий к заказу",
        },
      },
      required: ["client_name", "items"],
    },
  },
  {
    name: "get_client_orders",
    description:
      "Посмотреть предыдущие заказы клиента. Используй когда клиент спрашивает о своих заказах или статусе доставки.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_upsell_suggestions",
    description:
      "Получить товары для допродажи после оформления заказа. Используй ОДИН РАЗ после успешного создания заказа чтобы предложить сопутствующие товары.",
    input_schema: {
      type: "object" as const,
      properties: {
        ordered_product_ids: {
          type: "array",
          description: "ID товаров которые уже заказал клиент",
          items: { type: "string" },
        },
      },
      required: ["ordered_product_ids"],
    },
  },
  {
    name: "notify_manager",
    description:
      "Уведомить менеджера/владельца о вопросе клиента, который требует участия человека. Используй когда: клиент задаёт сложный вопрос за пределами твоей компетенции, нужно принять нестандартное решение, клиент явно просит поговорить с человеком, ситуация требует личного участия персонала. После вызова сообщи клиенту что передал вопрос менеджеру.",
    input_schema: {
      type: "object" as const,
      properties: {
        client_name: {
          type: "string",
          description: "Имя клиента",
        },
        reason: {
          type: "string",
          description: "Краткое описание ситуации или вопроса клиента",
        },
        urgency: {
          type: "string",
          enum: ["normal", "urgent"],
          description: "Срочность: normal — обычный запрос, urgent — срочно",
        },
      },
      required: ["reason"],
    },
  },
];

// ========================================
// РЕАЛИЗАЦИЯ ИНСТРУМЕНТОВ
// ========================================

/**
 * Поиск товаров по запросу
 */
export async function searchProducts(
  businessId: string,
  query: string,
  category?: string,
  maxPrice?: number
): Promise<SalesToolResult> {
  try {
    // Стоп-слова — предлоги/союзы которые не должны блокировать AND-поиск.
    // Раньше слово «в» в запросе «гель в тубе» резало результат до нуля
    // (искалось как точный тег `tags.has("в")`).
    const STOP_WORDS = new Set([
      "в", "во", "на", "с", "со", "у", "к", "ко", "и", "или", "от", "до",
      "из", "по", "за", "для", "о", "об", "про", // ВНИМАНИЕ: «про» НЕ в стоп-листе ниже —
      // в каталогах часто есть «Gel PRO», «Pro», «про»; пользователь Михаила прислал
      // именно "Gel PRO в тубе". Для других языков можно расширить позже.
      "the", "a", "an", "of", "for", "in", "on", "at", "to", "with",
    ]);
    // «про» убираем из стоп-слов — это часть бренда у Михаила. Пересоздаём set без него.
    STOP_WORDS.delete("про");

    // Слова из запроса: lowercase, без stop-words, без коротких (≤1 символ).
    // Слова длиной 2 оставляем — короткие коды размеров «D», «XS», «10мл» имеют смысл.
    const queryWords = query
      ? query
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
      : [];

    // Шаг 1 — найти ID товаров через raw SQL.
    // ПОЧЕМУ raw SQL: Prisma `tags.has(X)` ищет точное равенство элемента массива,
    // не substring внутри него. Тег `«гель про»` (одна строка с пробелом) не находится
    // через `has("про")`. Postgres `unnest(tags)` + ILIKE даёт substring-search
    // в каждом теге — единственный способ ВСЕГДА находить если в тегах есть нужное слово.
    //
    // Каждое слово запроса должно matchить хотя бы ОДНО поле:
    //   name | description | category | sku | любой элемент tags (substring)
    // AND между словами — все слова должны быть найдены.
    //
    // Параметризация через Prisma.sql защищает от SQL injection.

    // Собираем условия по словам запроса
    const wordClauses: Prisma.Sql[] = queryWords.map((w) => {
      const pattern = `%${w}%`;
      return Prisma.sql`(
        LOWER("name") LIKE ${pattern}
        OR LOWER(COALESCE("description", '')) LIKE ${pattern}
        OR LOWER(COALESCE("category", '')) LIKE ${pattern}
        OR LOWER(COALESCE("sku", '')) LIKE ${pattern}
        OR EXISTS (SELECT 1 FROM unnest("tags") t WHERE LOWER(t) LIKE ${pattern})
      )`;
    });

    const wordsWhere =
      wordClauses.length > 0
        ? Prisma.sql`AND ${Prisma.join(wordClauses, " AND ")}`
        : Prisma.empty;

    const categoryWhere = category
      ? Prisma.sql`AND LOWER(COALESCE("category", '')) LIKE ${`%${category.toLowerCase()}%`}`
      : Prisma.empty;

    const priceWhere =
      typeof maxPrice === "number" && maxPrice > 0
        ? Prisma.sql`AND "price" <= ${maxPrice}`
        : Prisma.empty;

    const idRows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Product"
      WHERE "businessId" = ${businessId}
        AND "isActive" = true
        ${wordsWhere}
        ${categoryWhere}
        ${priceWhere}
      ORDER BY "name" ASC
      LIMIT 20
    `;

    // Шаг 2 — догружаем полные объекты через стандартный findMany.
    // Это даёт корректную типизацию Product без явных type assertions.
    let products =
      idRows.length > 0
        ? await prisma.product.findMany({
            where: { id: { in: idRows.map((r) => r.id) } },
            orderBy: { name: "asc" },
          })
        : [];

    // AI-fallback: если raw substring-поиск ничего не нашёл — опечатка или
    // другой язык (Клеопатра vs Cleopatra). Дёргаем Haiku с реальными названиями.
    let normalizedQuery: string | null = null;
    if (products.length === 0 && query && query.trim().length >= 2) {
      const { normalizeProductQuery } = await import("./product-search-fallback");
      normalizedQuery = await normalizeProductQuery(query, businessId);
      if (normalizedQuery && normalizedQuery !== query) {
        // Повторный поиск нормализованным запросом — через тот же raw SQL.
        const nq = normalizedQuery.toLowerCase().trim();
        const nqWords = nq.split(/\s+/).filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
        const nqClauses: Prisma.Sql[] = nqWords.map((w) => {
          const p = `%${w}%`;
          return Prisma.sql`(
            LOWER("name") LIKE ${p}
            OR LOWER(COALESCE("description", '')) LIKE ${p}
            OR LOWER(COALESCE("category", '')) LIKE ${p}
            OR EXISTS (SELECT 1 FROM unnest("tags") t WHERE LOWER(t) LIKE ${p})
          )`;
        });
        const nqWhere =
          nqClauses.length > 0
            ? Prisma.sql`AND ${Prisma.join(nqClauses, " AND ")}`
            : Prisma.empty;

        const retryIds = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "Product"
          WHERE "businessId" = ${businessId}
            AND "isActive" = true
            ${nqWhere}
            ${priceWhere}
          ORDER BY "name" ASC
          LIMIT 20
        `;
        products =
          retryIds.length > 0
            ? await prisma.product.findMany({
                where: { id: { in: retryIds.map((r) => r.id) } },
                orderBy: { name: "asc" },
              })
            : [];
      }
    }

    if (products.length === 0) {
      // Get available categories to help the bot suggest alternatives
      const categories = await getAvailableCategories(businessId);
      return {
        success: true,
        found: false,
        message: `Товар по запросу "${query}" не найден.`,
        availableCategories: categories,
        products: [],
      };
    }

    return {
      success: true,
      found: true,
      count: products.length,
      // Если запрос был нормализован AI — отдаём это боту, чтобы он мог уточнить
      // у клиента: «Возможно вы имели в виду Cleopatra?»
      interpretedAs: normalizedQuery && normalizedQuery !== query ? normalizedQuery : undefined,
      originalQuery: normalizedQuery && normalizedQuery !== query ? query : undefined,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        oldPrice: p.oldPrice,
        category: p.category,
        stock: p.stock,
        inStock: p.stock === null || p.stock > 0,
        stockMessage:
          p.stock === null ? "В наличии"
          : p.stock === 0 ? "Нет в наличии"
          : p.stock < LOW_STOCK_THRESHOLD ? `Осталось ${p.stock} шт.`
          : `В наличии (${p.stock}+ шт.)`,
        shortDescription: p.description ? p.description.slice(0, 150) : null,
        imageUrl: p.imageUrl || null,
        productUrl: p.productUrl || null,
      })),
    };
  } catch (error) {
    console.error("searchProducts error:", error);
    return { success: false, error: "Ошибка поиска товаров" };
  }
}

/**
 * Получить список доступных категорий товаров бизнеса
 */
export async function getAvailableCategories(businessId: string): Promise<string[]> {
  try {
    const products = await prisma.product.findMany({
      where: { businessId, isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    });
    return products.map(p => p.category).filter((c): c is string => c !== null);
  } catch {
    return [];
  }
}

/**
 * Идентификация клиента по телефону — для случая когда клиент уже есть в БД
 * (импортирован из CRM, добавлен вручную, ранее писал из другого канала),
 * но впервые пишет в этот Telegram-бот.
 *
 * Если найден — записываем его telegramId, чтобы все будущие заказы
 * идентифицировались автоматически без повторного запроса телефона.
 *
 * Возвращает информацию о статусе клиента (имя, уровень, кэшбек, история),
 * чтобы бот мог приветствовать персонально.
 */
export async function identifyClientByPhone(
  businessId: string,
  phone: string,
  telegramId?: bigint
): Promise<SalesToolResult> {
  try {
    const normalized = phone.replace(/\D/g, "");
    if (normalized.length < 7) {
      return { success: false, error: "Слишком короткий номер" };
    }

    // Ищем по последним 9 цифрам (стабильно для +998, +7 и т.д.)
    const lastNine = normalized.slice(-9);
    const candidates = await prisma.client.findMany({
      where: { businessId, phone: { contains: lastNine } },
      select: {
        id: true,
        name: true,
        phone: true,
        telegramId: true,
        loyaltyTier: true,
        loyaltyCashbackPercent: true,
        loyaltyPoints: true,
        loyaltyTotalSpent: true,
      },
      take: 1,
    });

    if (candidates.length === 0) {
      return {
        success: true,
        found: false,
        message: "Клиент не найден в базе. Это новый клиент.",
      };
    }

    const client = candidates[0];

    // Получаем уровни и кэшбек программы для красивого ответа
    const programs = await prisma.loyaltyProgram.findMany({
      where: { businessId, enabled: true },
      select: { type: true, cashbackPercent: true, tiers: true },
    });

    let tierLabel = "";
    let tierDiscount = 0;
    const tieredProgram = programs.find((p) => p.type === "tiered");
    if (tieredProgram?.tiers && client.loyaltyTier) {
      const tiers = tieredProgram.tiers as Array<{ name: string; discount: number }>;
      const tierData = tiers.find((t) => t.name.toLowerCase() === client.loyaltyTier);
      if (tierData) {
        tierLabel = tierData.name;
        tierDiscount = tierData.discount;
      }
    }

    let cashbackPercent = 0;
    if (client.loyaltyCashbackPercent !== null && client.loyaltyCashbackPercent !== undefined) {
      cashbackPercent = client.loyaltyCashbackPercent;
    } else {
      const cashbackProgram = programs.find((p) => p.type === "cashback");
      if (cashbackProgram?.cashbackPercent) {
        cashbackPercent = cashbackProgram.cashbackPercent;
      }
    }

    // Авто-привязка: если у клиента ещё нет telegramId, а сейчас он пишет из Telegram
    // — связываем запись с этим Telegram-аккаунтом навсегда. Дальше lookup пойдёт по
    // telegramId без вопросов.
    if (telegramId && telegramId > BigInt(0) && !client.telegramId) {
      await prisma.client.update({
        where: { id: client.id },
        data: { telegramId },
      }).catch((e) => console.error("[identifyClient] failed to link telegramId:", e));
    }

    return {
      success: true,
      found: true,
      client: {
        name: client.name,
        tierName: tierLabel || null,
        tierDiscountPercent: tierDiscount,
        cashbackPercent,
        loyaltyPoints: client.loyaltyPoints,
        totalSpent: client.loyaltyTotalSpent,
      },
    };
  } catch (error) {
    console.error("identifyClientByPhone error:", error);
    return { success: false, error: "Ошибка идентификации" };
  }
}

/**
 * Получить ВСЕ товары категории или бренда — для запросов «какие у вас клеи?»,
 * «покажите все ресницы Lovely». Ищет совпадение в category, в названии (для брендов)
 * и в тегах. В отличие от searchProducts, не делит запрос на слова — берёт целиком.
 */
export async function listByCategory(
  businessId: string,
  category: string,
  maxPrice?: number
): Promise<SalesToolResult> {
  try {
    const cat = category.trim();
    if (!cat) {
      return { success: false, error: "Не указана категория" };
    }

    const conditions: Prisma.ProductWhereInput = {
      businessId,
      isActive: true,
      OR: [
        { category: { contains: cat, mode: "insensitive" } },
        { name: { contains: cat, mode: "insensitive" } },
        { tags: { has: cat.toLowerCase() } },
      ],
      ...(maxPrice ? { price: { lte: maxPrice } } : {}),
    };

    const products = await prisma.product.findMany({
      where: conditions,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 50, // больше чем search_products — обзорный запрос
    });

    if (products.length === 0) {
      const allCategories = await getAvailableCategories(businessId);
      return {
        success: true,
        found: false,
        message: `В категории "${cat}" товаров не найдено.`,
        availableCategories: allCategories,
        products: [],
      };
    }

    return {
      success: true,
      found: true,
      count: products.length,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        oldPrice: p.oldPrice,
        category: p.category,
        stock: p.stock,
        inStock: p.stock === null || p.stock > 0,
        stockMessage:
          p.stock === null ? "В наличии"
          : p.stock === 0 ? "Нет в наличии"
          : p.stock < LOW_STOCK_THRESHOLD ? `Осталось ${p.stock} шт.`
          : `В наличии (${p.stock}+ шт.)`,
        shortDescription: p.description ? p.description.slice(0, 150) : null,
        imageUrl: p.imageUrl || null,
        productUrl: p.productUrl || null,
      })),
    };
  } catch (error) {
    console.error("listByCategory error:", error);
    return { success: false, error: "Ошибка получения списка товаров" };
  }
}

/**
 * Детальная информация о товаре
 */
export async function getProductDetails(
  businessId: string,
  productId: string
): Promise<SalesToolResult> {
  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId, isActive: true },
    });

    if (!product) {
      return { success: false, error: "Товар не найден" };
    }

    const discount =
      product.oldPrice && product.oldPrice > product.price
        ? Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100)
        : null;

    return {
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        oldPrice: product.oldPrice,
        discount: discount ? `${discount}%` : null,
        category: product.category,
        sku: product.sku,
        tags: product.tags,
        stock: product.stock,
        inStock: product.stock === null || product.stock > 0,
        stockMessage:
          product.stock === null
            ? "В наличии"
            : product.stock === 0
            ? "Нет в наличии"
            : product.stock < 5
            ? `Осталось ${product.stock} шт.`
            : `В наличии (${product.stock}+ шт.)`,
        imageUrl: product.imageUrl || null,
        productUrl: product.productUrl || null,
      },
    };
  } catch (error) {
    console.error("getProductDetails error:", error);
    return { success: false, error: "Ошибка получения товара" };
  }
}

/**
 * Список категорий
 */
export async function getCategories(businessId: string): Promise<SalesToolResult> {
  try {
    const products = await prisma.product.findMany({
      where: { businessId, isActive: true, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    });

    const categories = products
      .map((p) => p.category)
      .filter(Boolean)
      .sort();

    const counts = await Promise.all(
      categories.map(async (cat) => {
        const count = await prisma.product.count({
          where: { businessId, isActive: true, category: cat! },
        });
        return { category: cat, count };
      })
    );

    return { success: true, categories: counts };
  } catch (error) {
    console.error("getCategories error:", error);
    return { success: false, error: "Ошибка получения категорий" };
  }
}

/**
 * Создать заказ
 */
export async function createOrder(
  businessId: string,
  telegramId: bigint,
  clientName: string,
  items: Array<{ product_id: string; quantity: number }>,
  clientPhone?: string,
  clientAddress?: string,
  paymentMethod?: string,
  notes?: string,
  channel?: string,
  channelClientId?: string
): Promise<SalesToolResult> {
  try {
    if (!items || items.length === 0) {
      return { success: false, error: "Не указаны товары в заказе" };
    }

    // Загружаем все товары чтобы проверить наличие и получить цены
    const productIds = items.map((i) => i.product_id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId, isActive: true },
    });

    if (products.length === 0) {
      return { success: false, error: "Указанные товары не найдены" };
    }

    // Формируем позиции заказа
    const orderItemsData: Array<{
      name: string;
      price: number;
      quantity: number;
      productId: string;
    }> = [];
    let totalPrice = 0;
    const issues: string[] = [];

    for (const item of items) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product) {
        issues.push(`Товар ${item.product_id} не найден`);
        continue;
      }

      // Проверяем наличие
      if (product.stock !== null && product.stock < item.quantity) {
        if (product.stock === 0) {
          issues.push(`"${product.name}" — нет в наличии`);
          continue;
        }
        issues.push(
          `"${product.name}" — доступно только ${product.stock} шт., вы запросили ${item.quantity}`
        );
        orderItemsData.push({
          name: product.name,
          price: product.price,
          quantity: product.stock,
          productId: product.id,
        });
        totalPrice += product.price * product.stock;
        continue;
      }

      orderItemsData.push({
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        productId: product.id,
      });
      totalPrice += product.price * item.quantity;
    }

    if (orderItemsData.length === 0) {
      return {
        success: false,
        error: `Не удалось сформировать заказ: ${issues.join("; ")}`,
      };
    }

    // ======== LOYALTY: look up client discounts ========
    let tierDiscount = 0;
    let cashbackPercent = 0;
    let clientTierLabel = "";
    let cashbackEarned = 0;

    // Ищем клиента в порядке: 1) Telegram ID, 2) телефон, 3) имя.
    // Раньше lookup был только по telegramId — клиенты, добавленные вручную
    // через дашборд (только phone) или через каналы WA/IG, не получали скидку.
    let client: {
      id: string;
      telegramId: bigint | null;
      loyaltyCashbackPercent: number | null;
      loyaltyTier: string | null;
      loyaltyPoints: number;
      loyaltyTotalSpent: number;
    } | null = null;

    const loyaltySelect = {
      id: true,
      telegramId: true,
      loyaltyCashbackPercent: true,
      loyaltyTier: true,
      loyaltyPoints: true,
      loyaltyTotalSpent: true,
    } as const;

    if (telegramId > BigInt(0)) {
      client = await prisma.client.findUnique({
        where: { businessId_telegramId: { businessId, telegramId } },
        select: loyaltySelect,
      });
    }

    // Fallback по нормализованному телефону (только цифры, без + и пробелов)
    if (!client && clientPhone) {
      const normalizedPhone = clientPhone.replace(/\D/g, "");
      if (normalizedPhone.length >= 7) {
        const candidates = await prisma.client.findMany({
          where: { businessId, phone: { contains: normalizedPhone.slice(-9) } },
          select: loyaltySelect,
          take: 1,
        });
        client = candidates[0] || null;
      }
    }

    // Последний fallback по имени (точное совпадение, без учёта регистра)
    if (!client && clientName) {
      const candidates = await prisma.client.findMany({
        where: { businessId, name: { equals: clientName, mode: "insensitive" } },
        select: loyaltySelect,
        take: 1,
      });
      client = candidates[0] || null;
    }

    // Канальный fallback: клиент пришёл из WhatsApp/Instagram через ChannelClient,
    // в чате не дал телефон, но в его профиле канала есть whatsappPhone (для WA),
    // или общий phone. Пробуем смэтчить с импортированной записью Client по этому
    // номеру. Без этого WA/IG-клиенты с присвоенным уровнем не получали скидку.
    if (!client && channelClientId) {
      try {
        const channelClient = await prisma.channelClient.findUnique({
          where: { id: channelClientId },
          select: { whatsappPhone: true, phone: true },
        });
        const channelPhone = channelClient?.whatsappPhone || channelClient?.phone || null;
        if (channelPhone) {
          const normalized = channelPhone.replace(/\D/g, "");
          if (normalized.length >= 7) {
            const candidates = await prisma.client.findMany({
              where: { businessId, phone: { contains: normalized.slice(-9) } },
              select: loyaltySelect,
              take: 1,
            });
            client = candidates[0] || null;
          }
        }
      } catch (e) {
        console.warn("[create_order] channel-client loyalty lookup failed:", e);
      }
    }

    // Авто-привязка: если нашли импортированную/ручную запись, у которой ещё
    // нет telegramId, а заказ создаётся из Telegram — связываем навсегда.
    // Все будущие заказы этого клиента пойдут по telegramId без поиска.
    if (client && !client.telegramId && telegramId > BigInt(0)) {
      await prisma.client
        .update({ where: { id: client.id }, data: { telegramId } })
        .catch((e) => console.error("[create_order] auto-link telegramId failed:", e));
    }

    if (client) {
      // Get business loyalty programs
      const programs = await prisma.loyaltyProgram.findMany({
        where: { businessId, enabled: true },
        select: { type: true, cashbackPercent: true, tiers: true },
      });

      // Determine cashback %: individual override > program default
      const cashbackProgram = programs.find((p) => p.type === "cashback");
      if (client.loyaltyCashbackPercent !== null && client.loyaltyCashbackPercent !== undefined) {
        cashbackPercent = client.loyaltyCashbackPercent;
      } else if (cashbackProgram?.cashbackPercent) {
        cashbackPercent = cashbackProgram.cashbackPercent;
      }

      // Determine tier discount
      const tieredProgram = programs.find((p) => p.type === "tiered");
      if (tieredProgram && tieredProgram.tiers) {
        const tiers = tieredProgram.tiers as Array<{ name: string; minSpent: number; discount: number }>;
        // Use manually assigned tier or auto-detect from spending
        const clientTier = client.loyaltyTier;
        if (clientTier) {
          const tierData = tiers.find((t) => t.name.toLowerCase() === clientTier);
          if (tierData) {
            tierDiscount = tierData.discount;
            clientTierLabel = tierData.name;
          }
        } else {
          // Auto-detect tier from totalSpent
          const sorted = [...tiers].sort((a, b) => b.minSpent - a.minSpent);
          for (const t of sorted) {
            if (client.loyaltyTotalSpent >= t.minSpent) {
              tierDiscount = t.discount;
              clientTierLabel = t.name;
              break;
            }
          }
        }
      }
    }

    // Apply tier discount to totalPrice
    const discountAmount = tierDiscount > 0 ? Math.round(totalPrice * tierDiscount / 100) : 0;
    const finalPrice = totalPrice - discountAmount;

    // Calculate cashback earned on finalPrice
    cashbackEarned = cashbackPercent > 0 ? Math.round(finalPrice * cashbackPercent / 100) : 0;

    // ======== END LOYALTY ========

    // Получаем привязку клиента к продавцу (если есть)
    let assignedStaffId: string | null = null;
    if (telegramId > BigInt(0)) {
      const client = await prisma.client.findUnique({
        where: { businessId_telegramId: { businessId, telegramId } },
        select: { assignedStaffId: true },
      });
      assignedStaffId = client?.assignedStaffId || null;
    }

    // Получаем следующий номер заказа
    const lastOrder = await prisma.order.findFirst({
      where: { businessId },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber ?? 1000) + 1;

    // Атомарно создаём заказ + декрементим остатки в одной транзакции.
    // Для каждого товара с ограниченным stock используем updateMany с условием
    // stock >= quantity — если между findMany и этой транзакцией другой заказ
    // "съел" остаток, count === 0 → бросаем OUT_OF_STOCK и rollback'аем весь заказ.
    // Иначе получили бы отрицательный stock (два параллельных заказа проходят
    // проверку до create, оба декрементят — конфликт).
    let order: Awaited<ReturnType<typeof prisma.order.create>> & {
      items: Array<{ id: string; name: string; price: number; quantity: number; productId: string | null }>;
    };
    const stockUpdates: Array<{ productId: string; previousStock: number; newStock: number; quantity: number; productName: string }> = [];
    try {
      order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            businessId,
            orderNumber,
            clientName,
            clientPhone: clientPhone || null,
            clientAddress: clientAddress || null,
            clientTelegramId: telegramId,
            clientChannel: channel || (telegramId > BigInt(0) ? "telegram" : null),
            clientChannelId: channelClientId || null,
            clientNotes: notes || null,
            totalPrice: finalPrice,
            paymentMethod: paymentMethod || null,
            staffId: assignedStaffId,
            status: "new",
            items: {
              create: orderItemsData.map((item) => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                productId: item.productId,
              })),
            },
          },
          include: { items: true },
        });

        for (const item of created.items) {
          if (!item.productId) continue;
          const product = products.find((p) => p.id === item.productId);
          if (!product || product.stock === null) continue;

          const previousStock = product.stock;
          const conditional = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (conditional.count === 0) {
            throw new Error(`OUT_OF_STOCK:${product.name}`);
          }
          const newStock = previousStock - item.quantity;
          stockUpdates.push({
            productId: item.productId,
            previousStock,
            newStock,
            quantity: item.quantity,
            productName: product.name,
          });
        }

        return created;
      });
    } catch (txError) {
      const msg = txError instanceof Error ? txError.message : String(txError);
      if (msg.startsWith("OUT_OF_STOCK:")) {
        const name = msg.slice("OUT_OF_STOCK:".length);
        return {
          success: false,
          error: `Товар "${name}" разобрали пока мы формировали заказ. Проверьте наличие и попробуйте ещё раз.`,
        };
      }
      throw txError;
    }

    // Auto-promote in deal pipeline: order created = paid client.
    // dealValue picks up the order total (only if higher than what's already
    // there — won't shrink a manually-entered figure). Skipped for clients
    // without a Telegram identity (channel orders are handled via Lead).
    if (telegramId > BigInt(0)) {
      promoteDealStageByTelegram(businessId, telegramId, "client", finalPrice).catch(() => {});
    }

    // Post-transaction: логируем stock-изменения + уведомляем о низком остатке.
    // Вынесено из транзакции — это не должно её растягивать/фейлить (fire-and-forget).
    for (const s of stockUpdates) {
      prisma.stockLog.create({
        data: {
          productId: s.productId,
          previousStock: s.previousStock,
          newStock: s.newStock,
          change: -s.quantity,
          reason: "order",
          orderId: order.id,
        },
      }).catch((e) => console.error("stockLog create failed:", e));

      if (s.newStock <= LOW_STOCK_THRESHOLD && s.newStock >= 0) {
        const stockMsg = s.newStock === 0
          ? `<b>Товар закончился!</b>\n"${s.productName}" — остаток: 0 шт.`
          : `<b>Мало на складе!</b>\n"${s.productName}" — осталось: ${s.newStock} шт.`;
        sendOwnerNotification(businessId, stockMsg).catch(() => {});
      }
    }

    // Award cashback points to client — обновляем по client.id, а не по
    // businessId_telegramId. Клиенты найденные по phone/имени (WA/IG/FB
    // источники, ручные импорты) имеют telegramId=null → update по составному
    // ключу промахивался и уходил в silent .catch. Через client.id одинаково
    // работает для всех источников привязки.
    if (client) {
      prisma.client.update({
        where: { id: client.id },
        data: {
          loyaltyTotalSpent: { increment: finalPrice },
          ...(cashbackEarned > 0 ? { loyaltyPoints: { increment: cashbackEarned } } : {}),
        },
      }).catch((e) => console.error("[Cashback] Failed to update loyalty:", e));
    }

    // Уведомляем владельца через Telegram + отправляем кнопки оплаты клиенту
    notifyNewOrder(businessId, order, orderItemsData, telegramId, assignedStaffId).catch(() => {});

    // Диспатчим в CRM
    dispatchCrmEvent(businessId, "booking_created", {
      client: {
        name: clientName,
        phone: clientPhone || null,
        telegramId: String(telegramId),
        totalVisits: 0,
        tags: [],
      },
      booking: {
        id: order.id,
        service: orderItemsData.map((i) => `${i.name} x${i.quantity}`).join(", "),
        master: null,
        date: new Date().toISOString(),
        price: totalPrice,
        status: "new",
        clientName,
        clientPhone: clientPhone || null,
      },
    }).catch(() => {});

    const summary = orderItemsData
      .map((i) => `${i.name} × ${i.quantity}`)
      .join(", ");

    return {
      success: true,
      orderId: order.id,
      orderNumber: `#${orderNumber}`,
      originalPrice: discountAmount > 0 ? totalPrice : undefined,
      discountAmount: discountAmount > 0 ? discountAmount : undefined,
      discountPercent: tierDiscount > 0 ? tierDiscount : undefined,
      tierName: clientTierLabel || undefined,
      totalPrice: finalPrice,
      cashbackEarned: cashbackEarned > 0 ? cashbackEarned : undefined,
      cashbackPercent: cashbackPercent > 0 ? cashbackPercent : undefined,
      summary,
      items: orderItemsData,
      warnings: issues.length > 0 ? issues : undefined,
      message: discountAmount > 0
        ? `Заказ #${orderNumber} оформлен! Скидка ${tierDiscount}% (${clientTierLabel}): -${discountAmount.toLocaleString("ru-RU")}. Итого: ${finalPrice.toLocaleString("ru-RU")}${cashbackEarned > 0 ? `. Начислено ${cashbackEarned} бонусных баллов (${cashbackPercent}%)` : ""}`
        : `Заказ #${orderNumber} оформлен! Сумма: ${finalPrice.toLocaleString("ru-RU")}${cashbackEarned > 0 ? `. Начислено ${cashbackEarned} бонусных баллов (${cashbackPercent}%)` : ""}`,
    };
  } catch (error) {
    console.error("createOrder error:", error);
    return { success: false, error: "Ошибка при оформлении заказа" };
  }
}

/**
 * Заказы клиента
 */
export async function getClientOrders(
  businessId: string,
  telegramId: bigint
): Promise<SalesToolResult> {
  try {
    const orders = await prisma.order.findMany({
      where: { businessId, clientTelegramId: telegramId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { items: true },
    });

    if (orders.length === 0) {
      return {
        success: true,
        found: false,
        message: "У вас пока нет заказов",
        orders: [],
      };
    }

    const statusMap: Record<string, string> = {
      new: "Новый",
      confirmed: "Подтверждён",
      processing: "В обработке",
      shipped: "Отправлен",
      delivered: "Доставлен",
      cancelled: "Отменён",
    };

    return {
      success: true,
      found: true,
      orders: orders.map((o) => ({
        orderNumber: `#${o.orderNumber}`,
        status: statusMap[o.status] || o.status,
        totalPrice: o.totalPrice,
        createdAt: o.createdAt.toLocaleDateString("ru-RU"),
        items: o.items.map((i) => `${i.name} × ${i.quantity}`).join(", "),
        isPaid: o.isPaid,
      })),
    };
  } catch (error) {
    console.error("getClientOrders error:", error);
    return { success: false, error: "Ошибка получения заказов" };
  }
}

/**
 * Предложения для допродажи (upsell)
 */
export async function getUpsellSuggestions(
  businessId: string,
  orderedProductIds: string[]
): Promise<SalesToolResult> {
  try {
    // Получаем категории заказанных товаров
    const orderedProducts = await prisma.product.findMany({
      where: { id: { in: orderedProductIds } },
      select: { category: true },
    });
    const categories = orderedProducts.map((p) => p.category).filter(Boolean);

    // Ищем похожие товары из тех же категорий (которые не заказали)
    const suggestions = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        id: { notIn: orderedProductIds },
        category: categories.length > 0 ? { in: categories as string[] } : undefined,
        OR: [{ stock: null }, { stock: { gt: 0 } }],
      },
      take: 3,
      orderBy: { price: "asc" },
    });

    if (suggestions.length === 0) {
      return { success: true, found: false, suggestions: [] };
    }

    return {
      success: true,
      found: true,
      suggestions: suggestions.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        category: p.category,
        shortDescription: p.description ? p.description.slice(0, 100) : null,
      })),
    };
  } catch (error) {
    console.error("getUpsellSuggestions error:", error);
    return { success: false, error: "Ошибка получения рекомендаций" };
  }
}

// ========================================
// УВЕДОМЛЕНИЕ ВЛАДЕЛЬЦА О НОВОМ ЗАКАЗЕ
// ========================================

async function notifyNewOrder(
  businessId: string,
  order: { id: string; orderNumber: number; totalPrice: number; clientName: string; clientPhone: string | null; clientAddress: string | null },
  items: Array<{ name: string; price: number; quantity: number }>,
  clientTelegramId?: bigint,
  assignedStaffId?: string | null
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        botToken: true,
        ownerTelegramChatId: true,
        name: true,
        phone: true,
        waPhoneNumberId: true,
        waAccessToken: true,
        waActive: true,
        paymeId: true,
        clickServiceId: true,
        clickMerchantId: true,
        country: true,
      },
    });

    if (!business?.botToken) {
      console.log("[Notify] No botToken for business", businessId);
      return;
    }

    // decrypt() — envelope encryption; passthrough для plaintext (backwards compat).
    // Расшифровываем один раз при загрузке — inline fetch'и ниже используют .botToken как есть.
    const { decrypt } = await import("./crypto");
    business.botToken = decrypt(business.botToken) || business.botToken;
    if (business.waAccessToken) {
      business.waAccessToken = decrypt(business.waAccessToken) || business.waAccessToken;
    }

    const itemsList = items
      .map((i) => `• ${i.name} × ${i.quantity} = ${(i.price * i.quantity).toLocaleString("ru-RU")}`)
      .join("\n");

    const message =
      `🛒 <b>Новый заказ #${order.orderNumber}</b>\n\n` +
      `👤 ${order.clientName}${order.clientPhone ? ` | ${order.clientPhone}` : ""}\n` +
      (order.clientAddress ? `📍 ${order.clientAddress}\n` : "") +
      `\n📦 <b>Состав заказа:</b>\n${itemsList}\n\n` +
      `💰 <b>Итого: ${order.totalPrice.toLocaleString("ru-RU")}</b>\n\n` +
      `🔗 Управление: staffix.io/dashboard/orders`;

    // Уведомление владельцу
    if (business.ownerTelegramChatId) {
      console.log(`[Notify] Sending order #${order.orderNumber} to owner chatId=${business.ownerTelegramChatId}`);
      const ownerRes = await fetch(
        `https://api.telegram.org/bot${business.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: business.ownerTelegramChatId.toString(),
            text: message,
            parse_mode: "HTML",
          }),
        }
      );
      if (!ownerRes.ok) {
        console.error(`[Notify] Failed to send to owner:`, await ownerRes.text());
      }
    } else {
      console.log(`[Notify] No ownerTelegramChatId for business ${businessId} — owner needs to /start the bot`);
    }

    // WhatsApp уведомление владельцу (if WA connected and phone available)
    if (business.waActive && business.waPhoneNumberId && business.waAccessToken && business.phone) {
      const ownerPhone = business.phone.replace(/[\s\-()]/g, "");
      if (ownerPhone.length >= 10) {
        const plainMessage = message.replace(/<[^>]+>/g, "");
        const { sendWAMessage } = await import("./whatsapp-utils");
        sendWAMessage(business.waPhoneNumberId, business.waAccessToken, ownerPhone, plainMessage).catch(
          (e) => console.error("[Notify] Owner WA notify error:", e)
        );
      }
    }

    // Уведомляем сотрудников при создании заказа:
    // 1) Назначенному продавцу/менеджеру (если есть) — он отвечает за этот заказ.
    // 2) Всем admin (контроль) — но НЕ operator: оператор получит уведомление позже,
    //    когда менеджер подтвердит заказ (notifyWarehouseOrderConfirmed).
    const staffMembers = await prisma.staff.findMany({
      where: {
        businessId,
        telegramChatId: { not: null },
        OR: [
          ...(assignedStaffId ? [{ id: assignedStaffId }] : []),
          { notificationsEnabled: true, role: "admin" },
        ],
      },
      select: { id: true, telegramChatId: true, name: true },
    });
    const sentChatIds = new Set<string>();
    for (const staff of staffMembers) {
      if (!staff.telegramChatId) continue;
      const chatIdStr = staff.telegramChatId.toString();
      if (sentChatIds.has(chatIdStr)) continue; // на случай если один человек и admin, и assigned seller
      sentChatIds.add(chatIdStr);
      console.log(`[Notify] Sending order #${order.orderNumber} to staff ${staff.name} chatId=${chatIdStr}`);
      await fetch(
        `https://api.telegram.org/bot${business.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatIdStr,
            text: message,
            parse_mode: "HTML",
          }),
        }
      ).catch((e) => console.error(`[Notify] Staff notify error:`, e));
    }

    // Отправить кнопки оплаты клиенту (если есть платёжные методы)
    if (clientTelegramId) {
      const paymentButtons = getPaymentButtons(
        {
          paymeId: business.paymeId,
          clickServiceId: business.clickServiceId,
          clickMerchantId: business.clickMerchantId,
        },
        order.totalPrice,
        order.orderNumber
      );

      if (paymentButtons.length > 0) {
        await fetch(
          `https://api.telegram.org/bot${business.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: clientTelegramId.toString(),
              text: `💳 Оплатите заказ #${order.orderNumber} — ${order.totalPrice.toLocaleString("ru-RU")} ${currencyLabel(business.country)}:`,
              reply_markup: { inline_keyboard: paymentButtons },
            }),
          }
        );
      }
    }

    // Создаём уведомление в дашборде
    await prisma.notification.create({
      data: {
        businessId,
        type: "new_order",
        title: `Новый заказ #${order.orderNumber}`,
        message: `${order.clientName} — ${items.map((i) => i.name).join(", ")} — ${order.totalPrice.toLocaleString("ru-RU")}`,
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { notifiedOwner: true },
    });
  } catch (err) {
    console.error("notifyNewOrder error:", err);
  }
}

// ========================================
// УВЕДОМЛЕНИЕ МЕНЕДЖЕРА (ЭСКАЛАЦИЯ)
// ========================================

export async function notifyManagerByTelegram(
  businessId: string,
  clientTelegramId: bigint,
  reason: string,
  clientName?: string,
  urgency?: string
): Promise<SalesToolResult> {
  // Один маркер для трейсинга всего цикла эскалации в Vercel-логах.
  const tag = `[notify_manager][${businessId}]`;
  console.log(`${tag} START reason="${reason?.slice(0, 80)}…" client=${clientName || "?"} urgency=${urgency || "normal"}`);

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { botToken: true, ownerTelegramChatId: true, name: true },
    });

    if (!business) {
      console.error(`${tag} FAIL: business not found`);
      return { success: false, error: "Бизнес не найден" };
    }

    // decrypt() — envelope encryption; passthrough для plaintext
    if (business.botToken) {
      const { decrypt } = await import("./crypto");
      business.botToken = decrypt(business.botToken) || business.botToken;
    }

    const isUrgent = urgency === "urgent";
    const urgencyLabel = isUrgent ? "🚨 СРОЧНО" : "📩 Новый запрос";
    const clientLabel = clientName ? `👤 ${clientName}` : `👤 Клиент (ID: ${clientTelegramId})`;

    // 1) Всегда оставляем запись в дашборде, даже если Telegram владельца не настроен —
    //    иначе эскалация превращается в ложь боту ("я передал" → никто не получил).
    let dashboardCreated = false;
    try {
      await prisma.notification.create({
        data: {
          businessId,
          type: "manager_escalation",
          title: isUrgent
            ? `🚨 Срочный запрос от клиента${clientName ? ` — ${clientName}` : ""}`
            : `📩 Запрос требует менеджера${clientName ? ` — ${clientName}` : ""}`,
          message: reason,
          metadata: {
            clientTelegramId: clientTelegramId.toString(),
            clientName: clientName || null,
            urgency: urgency || "normal",
          },
        },
      });
      dashboardCreated = true;
      console.log(`${tag} dashboard notification CREATED`);
    } catch (e) {
      console.error(`${tag} dashboard notification FAILED:`, e);
    }

    // 2) Если у клиента есть привязанный менеджер — эскалируем именно ему.
    //    Если нет (или менеджер не настроил телеграм) — fallback на владельца.
    //    Это правильнее чем дёргать владельца по каждому диалогу: владелец
    //    хочет видеть только то, что менеджер не закрыл сам.
    let assignedManagerChatId: bigint | null = null;
    let assignedManagerName: string | null = null;
    if (clientTelegramId > BigInt(0)) {
      try {
        const client = await prisma.client.findUnique({
          where: { businessId_telegramId: { businessId, telegramId: clientTelegramId } },
          select: { assignedStaffId: true },
        });
        if (client?.assignedStaffId) {
          const staff = await prisma.staff.findUnique({
            where: { id: client.assignedStaffId },
            select: { telegramChatId: true, name: true, notificationsEnabled: true },
          });
          if (staff?.telegramChatId && staff.notificationsEnabled !== false) {
            assignedManagerChatId = staff.telegramChatId;
            assignedManagerName = staff.name;
          }
        }
      } catch (e) {
        console.warn(`${tag} assignedStaff lookup failed:`, e);
      }
    }

    // Целевой получатель: привязанный менеджер > владелец
    const targetChatId = assignedManagerChatId ?? business.ownerTelegramChatId;
    const targetLabel = assignedManagerChatId
      ? `assigned manager "${assignedManagerName || "?"}"`
      : "owner";

    let telegramDelivered = false;
    let telegramReason = "";
    if (!business.botToken) {
      telegramReason = "no botToken";
      console.warn(`${tag} TG skip: no botToken`);
    } else if (!targetChatId) {
      telegramReason = "no chatId — neither assigned manager nor owner has /start'ed the bot";
      console.warn(`${tag} TG skip: ${telegramReason}`);
    } else {
      try {
        const text =
          `${urgencyLabel} — требуется помощь менеджера\n\n` +
          `${clientLabel}\n` +
          `Вопрос: ${reason}\n\n` +
          `Клиент ждёт ответа в Telegram.`;

        console.log(`${tag} TG sending to ${targetLabel} chat=${targetChatId}`);
        const tgResponse = await fetch(
          `https://api.telegram.org/bot${business.botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChatId.toString(),
              text,
              // НЕ передаём parse_mode — plain text всегда доходит без эскейпа.
            }),
          }
        );

        if (tgResponse.ok) {
          telegramDelivered = true;
          console.log(`${tag} TG DELIVERED to ${targetLabel}`);
        } else {
          const body = await tgResponse.text().catch(() => "");
          telegramReason = `TG API ${tgResponse.status}: ${body.slice(0, 200)}`;
          console.error(`${tag} TG FAILED: ${telegramReason}`);
        }
      } catch (e) {
        telegramReason = e instanceof Error ? e.message : String(e);
        console.error(`${tag} TG fetch error:`, e);
      }
    }

    console.log(
      `${tag} DONE dashboard=${dashboardCreated} telegram=${telegramDelivered} reason="${telegramReason}"`
    );

    // Activity log: видно ли клиенту в /dashboard/activity что эскалация
    // прошла и куда ушла. Для дебага — реквизиты в technical.
    logActivityFireAndForget({
      businessId,
      type: "notification_sent",
      severity: telegramDelivered ? "info" : dashboardCreated ? "warn" : "error",
      summary: telegramDelivered
        ? `Уведомление менеджеру (${assignedManagerName || "владелец"}) доставлено в Telegram`
        : dashboardCreated
          ? `Уведомление сохранено в дашборде (Telegram-доставка не прошла)`
          : `Уведомление НЕ доставлено`,
      technical: {
        tool: "notify_manager",
        reason: reason?.slice(0, 200) || null,
        urgency: urgency || "normal",
        target: assignedManagerName ? "assigned_manager" : "owner",
        targetName: assignedManagerName,
        telegramDelivered,
        dashboardCreated,
        deliveryError: telegramReason || null,
        clientTelegramId: clientTelegramId.toString(),
      },
    });

    // Запрос всегда сохранён (в дашборде), даже если Telegram-канал владельца не настроен.
    return {
      success: true,
      notified: dashboardCreated || telegramDelivered,
      telegramDelivered,
      dashboardCreated,
      message: telegramDelivered
        ? "Менеджер уведомлён в Telegram. Он свяжется с клиентом в ближайшее время."
        : "Запрос передан в дашборд менеджера. Он свяжется с клиентом, как только увидит уведомление.",
    };
  } catch (error) {
    console.error(`${tag} fatal:`, error);
    return { success: false, error: "Ошибка при уведомлении менеджера" };
  }
}

// ========================================
// ДИСПЕТЧЕР ИНСТРУМЕНТОВ (вызывается из webhook)
// ========================================

export async function executeSalesTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  businessId: string,
  telegramId: bigint
): Promise<string> {
  try {
    switch (toolName) {
      case "search_products": {
        const result = await searchProducts(
          businessId,
          toolInput.query as string,
          toolInput.category as string | undefined,
          toolInput.max_price as number | undefined
        );
        return JSON.stringify(result);
      }

      case "get_product_details": {
        const result = await getProductDetails(
          businessId,
          toolInput.product_id as string
        );
        return JSON.stringify(result);
      }

      case "get_categories": {
        const result = await getCategories(businessId);
        return JSON.stringify(result);
      }

      case "list_by_category": {
        const result = await listByCategory(
          businessId,
          toolInput.category as string,
          toolInput.max_price as number | undefined
        );
        return JSON.stringify(result);
      }

      case "identify_client": {
        const result = await identifyClientByPhone(
          businessId,
          toolInput.phone as string,
          telegramId
        );
        return JSON.stringify(result);
      }

      case "create_order": {
        const result = await createOrder(
          businessId,
          telegramId,
          toolInput.client_name as string,
          toolInput.items as Array<{ product_id: string; quantity: number }>,
          toolInput.client_phone as string | undefined,
          toolInput.client_address as string | undefined,
          toolInput.payment_method as string | undefined,
          toolInput.notes as string | undefined
        );
        return JSON.stringify(result);
      }

      case "get_client_orders": {
        const result = await getClientOrders(businessId, telegramId);
        return JSON.stringify(result);
      }

      case "get_upsell_suggestions": {
        const result = await getUpsellSuggestions(
          businessId,
          toolInput.ordered_product_ids as string[]
        );
        return JSON.stringify(result);
      }

      case "notify_manager": {
        const result = await notifyManagerByTelegram(
          businessId,
          telegramId,
          toolInput.reason as string,
          toolInput.client_name as string | undefined,
          toolInput.urgency as string | undefined
        );
        // Сохраняем эскалацию в Task — чтобы менеджер видел в дашборде
        // персистентный список, а не только Telegram-уведомление.
        const { createEscalationTask } = await import("@/lib/tasks");
        createEscalationTask({
          businessId,
          clientTelegramId: telegramId > BigInt(0) ? telegramId : undefined,
          clientChannel: "telegram",
          clientChannelId: telegramId.toString(),
          clientName: toolInput.client_name as string | undefined,
          reason: (toolInput.reason as string) || "AI попросил человека",
          urgency: toolInput.urgency as string | undefined,
        }).catch(() => {});
        return JSON.stringify(result);
      }

      default:
        return JSON.stringify({ error: `Unknown sales tool: ${toolName}` });
    }
  } catch (error) {
    console.error(`Error in sales tool ${toolName}:`, error);
    return JSON.stringify({ error: "Ошибка выполнения инструмента" });
  }
}
