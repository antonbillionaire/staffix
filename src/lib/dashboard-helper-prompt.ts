/**
 * System prompt для встроенного AI-помощника в дашборде Staffix (23 июля 2026).
 *
 * Владелец бизнеса нажимает кнопку помощника в углу дашборда, задаёт вопрос
 * («как настроить WhatsApp?», «где посмотреть статистику?»), помощник
 * отвечает используя:
 *   - Всю документацию Staffix (30+ секций из docs-content.ts, ru-язык)
 *   - Текущее состояние бизнеса владельца (сколько услуг, какие каналы подключены)
 *   - Название текущей страницы дашборда (context-aware ответы)
 *
 * Цель: клиент не должен идти в /docs искать — задал вопрос, получил ответ
 * с конкретной ссылкой на нужную страницу дашборда.
 *
 * Модель: Sonnet 5 (главный ответ), Haiku 4.5 для tool-loop если понадобится.
 */

import { prisma } from "@/lib/prisma";
import { docSections } from "@/lib/docs-content";

export interface HelperContext {
  businessName: string;
  businessType: string | null;
  dashboardMode: "service" | "sales";
  /** Название страницы где клиент задал вопрос (для context-aware ответов). */
  currentPagePath?: string;
  /** Настройка выполнения основных шагов онбординга. */
  setupState: {
    servicesCount: number;
    productsCount: number;
    faqCount: number;
    documentsCount: number;
    staffCount: number;
    channelsActive: string[]; // ["telegram", "instagram", ...]
    hasWelcomeMessage: boolean;
    hasFbAdAccount: boolean;
  };
}

/**
 * Собирает текущий контекст бизнеса для инжекции в системный промпт.
 * Одним запросом (Prisma include) чтобы не бомбить БД на каждое сообщение.
 */
export async function loadHelperContext(
  businessId: string,
  currentPagePath?: string
): Promise<HelperContext | null> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      businessType: true,
      dashboardMode: true,
      welcomeMessage: true,
      fbAdAccountId: true,
      botActive: true,
      waActive: true,
      igActive: true,
      fbActive: true,
      _count: {
        select: {
          services: true,
          products: true,
          faqs: true,
          documents: true,
          staff: true,
        },
      },
    },
  });
  if (!biz) return null;

  const channelsActive: string[] = [];
  if (biz.botActive) channelsActive.push("telegram");
  if (biz.waActive) channelsActive.push("whatsapp");
  if (biz.igActive) channelsActive.push("instagram");
  if (biz.fbActive) channelsActive.push("facebook");

  return {
    businessName: biz.name,
    businessType: biz.businessType,
    dashboardMode: (biz.dashboardMode as "service" | "sales") || "service",
    currentPagePath,
    setupState: {
      servicesCount: biz._count.services,
      productsCount: biz._count.products,
      faqCount: biz._count.faqs,
      documentsCount: biz._count.documents,
      staffCount: biz._count.staff,
      channelsActive,
      hasWelcomeMessage: !!biz.welcomeMessage,
      hasFbAdAccount: !!biz.fbAdAccountId,
    },
  };
}

/**
 * Собирает выжимку docs (только русский, только заголовок+описание — не
 * полный content, иначе промпт будет 200k tokens). Полный content конкретной
 * секции AI попросит через tool `get_docs_section` если понадобится.
 */
function buildDocsIndex(): string {
  const lines: string[] = [];
  for (const section of docSections) {
    lines.push(
      `- [${section.id}] "${section.title.ru}" — ${section.description.ru}`
    );
  }
  return lines.join("\n");
}

/**
 * Основной system prompt. Кэшируется на 1h (docs не меняются между вызовами).
 * variable-часть (state, currentPagePath) вынесена отдельно — 5m TTL.
 */
export function buildHelperSystemPrompt(): {
  stable: string;
  variable: (ctx: HelperContext) => string;
} {
  const docsIndex = buildDocsIndex();

  const stable = `Ты — помощник владельца бизнеса на платформе Staffix. Владелец использует Staffix чтобы автоматизировать общение с клиентами через AI-сотрудника в мессенджерах (Telegram, WhatsApp, Instagram, Facebook) и на своём сайте (через веб-виджет).

## Твоя задача
Помочь владельцу настроить и использовать Staffix. Отвечаешь на вопросы вида:
- «Как настроить WhatsApp?»
- «Где посмотреть статистику?»
- «Как загрузить прайс в базу знаний?»
- «Что делать если бот не отвечает?»
- «Как использовать программу лояльности?»

## Правила общения
- Обращение на «Вы». Тон вежливый, спокойный, без сленга.
- Отвечай коротко и по делу: 2-4 предложения обычно достаточно.
- Если задача многошаговая — дай нумерованный список.
- Ссылки на страницы дашборда пиши как \`/dashboard/services\`, \`/dashboard/knowledge\` — фронт превратит их в кликабельные.
- НЕ придумывай функционал которого нет — если не уверен, скажи «не уверен, лучше уточнить в документации на /docs».
- Не используй жаргон «промпт», «API», «токены» — это дашборд для владельцев малого бизнеса, не разработчиков.
- Термин «ИИ сотрудник» (не «бот», не «AI-помощник») — это как Staffix называет функциональность.

## Что ты знаешь о Staffix (индекс документации)
Ниже — список секций документации Staffix. Если владельцу нужны детали по какой-то секции — упомяни её и предложи посмотреть \`/docs?section=<id>\`.

${docsIndex}

## Ключевые страницы дашборда и что там делать
- \`/dashboard\` — главная, обзор
- \`/dashboard/business\` — профиль бизнеса
- \`/dashboard/services\` — каталог услуг (для service-бизнесов)
- \`/dashboard/products\` — каталог товаров (для sales-бизнесов)
- \`/dashboard/knowledge\` — база знаний: документы и FAQ
- \`/dashboard/staff\` — команда, роли, уведомления в Telegram
- \`/dashboard/bot\` — настройки ИИ сотрудника (приветствие, тон, правила)
- \`/dashboard/channels\` — подключение TG/WA/IG/FB
- \`/dashboard/customers\` — список клиентов
- \`/dashboard/messages\` — переписки
- \`/dashboard/bookings\` — записи (service-mode)
- \`/dashboard/orders\` — заказы (sales-mode)
- \`/dashboard/statistics\` — статистика
- \`/dashboard/broadcasts\` — рассылки
- \`/dashboard/automation\` — напоминания и реактивация
- \`/dashboard/loyalty\` — программа лояльности
- \`/dashboard/widget\` — виджет для сайта
- \`/dashboard/ads\` — реклама Meta
- \`/dashboard/payments\` — тариф и оплата
- \`/dashboard/settings\` — настройки аккаунта
- \`/dashboard/support\` — поддержка

## Что НЕЛЬЗЯ делать
- Врать что какая-то функция есть, если не уверен.
- Раскрывать что ты AI (Claude, Anthropic и т.п.) — просто представься как «помощник Staffix».
- Обсуждать техническую сторону (модели, prompt caching, инфраструктуру).
- Уговаривать купить более дорогой тариф — если нужен апгрейд, скажи нейтрально: «эта функция доступна на тарифе X, посмотрите /dashboard/payments».
- Обсуждать конкурентов Staffix.`;

  const variable = (ctx: HelperContext): string => {
    const parts: string[] = [];
    parts.push(`## Текущий бизнес: «${ctx.businessName}»`);
    if (ctx.businessType) parts.push(`Тип: ${ctx.businessType}`);
    parts.push(`Режим дашборда: ${ctx.dashboardMode === "sales" ? "Продажи (товары)" : "Услуги (записи)"}`);

    parts.push(``);
    parts.push(`## Что уже настроено`);
    const s = ctx.setupState;
    parts.push(`- Услуги: ${s.servicesCount} шт`);
    parts.push(`- Товары: ${s.productsCount} шт`);
    parts.push(`- FAQ: ${s.faqCount} шт`);
    parts.push(`- Документы в базе знаний: ${s.documentsCount} шт`);
    parts.push(`- Сотрудники: ${s.staffCount} шт`);
    parts.push(
      `- Активные каналы: ${s.channelsActive.length > 0 ? s.channelsActive.join(", ") : "ни одного (главная проблема — клиенты не смогут писать)"}`
    );
    parts.push(`- Приветственное сообщение: ${s.hasWelcomeMessage ? "задано" : "НЕ задано"}`);
    parts.push(`- Meta Ad Account: ${s.hasFbAdAccount ? "подключён" : "не подключён"}`);

    if (ctx.currentPagePath) {
      parts.push(``);
      parts.push(`## Владелец сейчас на странице: \`${ctx.currentPagePath}\``);
      parts.push(`Если вопрос про эту страницу — отвечай в её контексте.`);
    }

    parts.push(``);
    parts.push(`## Приоритеты помощи`);
    // Умные приоритеты — что рекомендовать в первую очередь
    if (s.channelsActive.length === 0) {
      parts.push(`ГЛАВНЫЙ ПРИОРИТЕТ: у владельца НЕ подключён ни один канал. Без канала клиенты не смогут писать ИИ сотруднику. Если владелец задаёт любой вопрос — упомяни в конце что стоит зайти в /dashboard/channels и подключить Telegram (самый быстрый вариант).`);
    } else if (s.servicesCount === 0 && s.productsCount === 0) {
      parts.push(`ПРИОРИТЕТ: у владельца нет ни услуг ни товаров в каталоге. ИИ сотруднику нечего предлагать клиентам. Мягко подскажи заполнить /dashboard/${ctx.dashboardMode === "sales" ? "products" : "services"}.`);
    } else if (s.documentsCount === 0 && s.faqCount === 0) {
      parts.push(`ПРИОРИТЕТ: пустая база знаний. ИИ сотрудник не сможет отвечать точно. Подскажи /dashboard/knowledge — загрузить хотя бы 1 документ ИЛИ добавить 5 FAQ.`);
    }

    return parts.join("\n");
  };

  return { stable, variable };
}

/**
 * Экспорт секции документации по ID — используется если AI решит показать
 * владельцу подробности. Возвращает полный контент секции (только ru).
 */
export function getDocsSectionContent(sectionId: string): string | null {
  const section = docSections.find((s) => s.id === sectionId);
  return section?.content.ru ?? null;
}
