/**
 * Sales Tools for AI Sales Bot
 * Инструменты Claude для работы с товарами и заказами
 *
 * Режим "магазин/продажи" — альтернатива booking режиму для сервисных бизнесов.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { dispatchCrmEvent } from "./crm-integrations";
import { getPaymentButtons } from "./payment-links";

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
    // Build DB-level text search — search across name, description, category, tags
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [{ businessId, isActive: true }];

    // Text search across multiple fields at DB level
    if (query) {
      const queryWords = query.trim().split(/\s+/).filter(w => w.length > 1);
      // Each word must match at least one field (AND logic between words)
      for (const word of queryWords) {
        conditions.push({
          OR: [
            { name: { contains: word, mode: "insensitive" } },
            { description: { contains: word, mode: "insensitive" } },
            { category: { contains: word, mode: "insensitive" } },
            { sku: { contains: word, mode: "insensitive" } },
            { tags: { has: word } },
          ],
        });
      }
    }

    if (category) {
      conditions.push({ category: { contains: category, mode: "insensitive" } });
    }

    if (maxPrice) {
      conditions.push({ price: { lte: maxPrice } });
    }

    // Primary search: DB-level filtering
    let products = await prisma.product.findMany({
      where: { AND: conditions },
      orderBy: { name: "asc" },
      take: 20,
    });

    // Fallback: if strict AND didn't find anything, try OR across fields
    if (products.length === 0 && query) {
      products = await prisma.product.findMany({
        where: {
          businessId,
          isActive: true,
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { category: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
          ],
          ...(maxPrice ? { price: { lte: maxPrice } } : {}),
        },
        orderBy: { name: "asc" },
        take: 20,
      });
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
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        oldPrice: p.oldPrice,
        category: p.category,
        stock: p.stock,
        inStock: p.stock === null || p.stock > 0,
        shortDescription: p.description ? p.description.slice(0, 150) : null,
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
  notes?: string
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

    // Получаем следующий номер заказа
    const lastOrder = await prisma.order.findFirst({
      where: { businessId },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const orderNumber = (lastOrder?.orderNumber ?? 1000) + 1;

    // Создаём заказ
    const order = await prisma.order.create({
      data: {
        businessId,
        orderNumber,
        clientName,
        clientPhone: clientPhone || null,
        clientAddress: clientAddress || null,
        clientTelegramId: telegramId,
        clientNotes: notes || null,
        totalPrice,
        paymentMethod: paymentMethod || null,
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

    // Уменьшаем stock для товаров с ограниченным наличием
    for (const item of order.items) {
      if (item.productId) {
        const product = products.find((p) => p.id === item.productId);
        if (product && product.stock !== null) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }
    }

    // Уведомляем владельца через Telegram + отправляем кнопки оплаты клиенту
    notifyNewOrder(businessId, order, orderItemsData, telegramId).catch(() => {});

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
      totalPrice,
      summary,
      items: orderItemsData,
      warnings: issues.length > 0 ? issues : undefined,
      message: `Заказ ${`#${orderNumber}`} успешно оформлен! Сумма: ${totalPrice.toLocaleString("ru-RU")}`,
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
  clientTelegramId?: bigint
): Promise<void> {
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        botToken: true,
        ownerTelegramChatId: true,
        name: true,
        paymeId: true,
        clickServiceId: true,
        clickMerchantId: true,
        kaspiPayLink: true,
      },
    });

    if (!business?.botToken) return;

    const itemsList = items
      .map((i) => `• ${i.name} × ${i.quantity} = ${(i.price * i.quantity).toLocaleString("ru-RU")}`)
      .join("\n");

    const message =
      `🛒 *Новый заказ #${order.orderNumber}*\n\n` +
      `👤 ${order.clientName}${order.clientPhone ? ` | ${order.clientPhone}` : ""}\n` +
      (order.clientAddress ? `📍 ${order.clientAddress}\n` : "") +
      `\n📦 *Состав заказа:*\n${itemsList}\n\n` +
      `💰 *Итого: ${order.totalPrice.toLocaleString("ru-RU")}*\n\n` +
      `🔗 Управление: staffix.io/dashboard/orders`;

    // Уведомление владельцу
    if (business.ownerTelegramChatId) {
      await fetch(
        `https://api.telegram.org/bot${business.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: business.ownerTelegramChatId.toString(),
            text: message,
            parse_mode: "Markdown",
          }),
        }
      );
    }

    // Отправить кнопки оплаты клиенту (если есть платёжные методы)
    if (clientTelegramId) {
      const paymentButtons = getPaymentButtons(
        {
          paymeId: business.paymeId,
          clickServiceId: business.clickServiceId,
          clickMerchantId: business.clickMerchantId,
          kaspiPayLink: business.kaspiPayLink,
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
              text: `💳 Оплатите заказ #${order.orderNumber} — ${order.totalPrice.toLocaleString("ru-RU")} сум:`,
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
        type: "new_booking",
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
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { botToken: true, ownerTelegramChatId: true, name: true },
    });

    if (!business?.botToken) {
      return { success: false, error: "Бот не настроен" };
    }

    if (!business.ownerTelegramChatId) {
      return {
        success: true,
        notified: false,
        message: "Менеджер будет уведомлён при первой возможности",
      };
    }

    const urgencyLabel = urgency === "urgent" ? "🚨 СРОЧНО" : "📩 Новый запрос";
    const clientLabel = clientName ? `👤 *${clientName}*` : `👤 Клиент (ID: ${clientTelegramId})`;

    const text =
      `${urgencyLabel} — требуется помощь менеджера\n\n` +
      `${clientLabel}\n` +
      `💬 *Вопрос:* ${reason}\n\n` +
      `_Клиент ждёт ответа в Telegram_`;

    await fetch(
      `https://api.telegram.org/bot${business.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: business.ownerTelegramChatId.toString(),
          text,
          parse_mode: "Markdown",
        }),
      }
    );

    return {
      success: true,
      notified: true,
      message: "Менеджер уведомлён. Он свяжется с клиентом в ближайшее время.",
    };
  } catch (error) {
    console.error("notifyManagerByTelegram error:", error);
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
