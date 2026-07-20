/**
 * Публичный widget-config endpoint (Sprint Widget, 21 июля 2026).
 *
 * Возвращает список подключённых каналов бизнеса + deep-links для
 * встраиваемого виджета на чужом сайте. НИКАКИХ секретов — только
 * публичная информация (имя бота/страницы/username), которая и так
 * видна в TG/IG/FB.
 *
 * CORS: `*` (это же embed на чужих доменах). Отдаём только read-only
 * данные, secure by design.
 *
 * Rate-limit: fail-open по IP (если БД лагает — лучше отдать конфиг
 * чем сломать виджет на сайте клиента).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

interface WidgetChannel {
  type: "telegram" | "whatsapp" | "instagram" | "messenger";
  url: string;
  label: string;
}

interface WidgetConfig {
  businessId: string;
  name: string;
  channels: WidgetChannel[];
  theme: {
    color: string;
    position: "br" | "bl";
    icon: "chat" | "dots" | "sparkle" | "wave" | "custom";
    customImageUrl: string | null;
    greeting: string;
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const CACHE_HEADERS = {
  // 5 min edge cache + stale-while-revalidate ещё 5 min. Владелец меняет
  // настройки редко; конфиг публичный, кэшировать безопасно.
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * wa.me / api.whatsapp.com принимают только цифры (E.164 без +).
 * Business.phone обычно уже E.164 (владелец вводит с плюсом), но бывают
 * пробелы/дефисы — вычищаем всё нецифровое.
 */
function normalizeWaPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  // Не короче 8 цифр — иначе wa.me отдаст 404. Не длиннее 15 (E.164 max).
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;

  // Rate-limit по IP (fail-open — виджет не должен ломать чужой сайт из-за
  // нашего лага БД). 60 запросов/мин на IP — достаточно для нормального
  // серфинга, режет DDoS.
  const ip = getClientIp(request);
  const { allowed } = await rateLimit(`widget:${ip}`, 60, 1, "open");
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      phone: true,
      botUsername: true,
      botActive: true,
      waPhoneNumberId: true,
      waActive: true,
      igUsername: true,
      igActive: true,
      fbPageId: true,
      fbActive: true,
      widgetColor: true,
      widgetPosition: true,
      widgetIcon: true,
      widgetCustomImageUrl: true,
      widgetGreeting: true,
    },
  });

  if (!biz) {
    return NextResponse.json(
      { error: "Business not found" },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  const channels: WidgetChannel[] = [];

  // Telegram: t.me/username. Требует botActive + botUsername.
  if (biz.botActive && biz.botUsername) {
    channels.push({
      type: "telegram",
      url: `https://t.me/${biz.botUsername}`,
      label: "Telegram",
    });
  }

  // WhatsApp: wa.me/PHONE. Требует waActive + валидный business.phone
  // (waPhoneNumberId — Meta internal ID, для deep-link не годится).
  // Владелец задаёт phone в /dashboard/company; обычно совпадает с WA
  // Business номером. Если phone не задан — WA-кнопка не показывается.
  if (biz.waActive && biz.waPhoneNumberId) {
    const waPhone = normalizeWaPhone(biz.phone);
    if (waPhone) {
      channels.push({
        type: "whatsapp",
        url: `https://wa.me/${waPhone}`,
        label: "WhatsApp",
      });
    }
  }

  // Instagram: ig.me/m/USERNAME открывает DM в приложении/веб.
  if (biz.igActive && biz.igUsername) {
    channels.push({
      type: "instagram",
      url: `https://ig.me/m/${biz.igUsername}`,
      label: "Instagram",
    });
  }

  // Facebook Messenger: m.me/PAGE_ID.
  if (biz.fbActive && biz.fbPageId) {
    channels.push({
      type: "messenger",
      url: `https://m.me/${biz.fbPageId}`,
      label: "Messenger",
    });
  }

  // Sprint Widget: применяем настройки владельца, с дефолтами на пустое.
  // icon="custom" валиден только если реально задан customImageUrl —
  // иначе откатываемся к "chat" (защита от «сохранил custom → удалил
  // картинку → виджет ломается»).
  const iconRaw = biz.widgetIcon as WidgetConfig["theme"]["icon"];
  const icon =
    iconRaw === "custom" && !biz.widgetCustomImageUrl ? "chat" : iconRaw;

  const config: WidgetConfig = {
    businessId: biz.id,
    name: biz.name,
    channels,
    theme: {
      color: biz.widgetColor || "#2563eb",
      position: biz.widgetPosition === "bl" ? "bl" : "br",
      icon,
      customImageUrl: icon === "custom" ? biz.widgetCustomImageUrl : null,
      greeting:
        biz.widgetGreeting ||
        "Здравствуйте! Напишите нам в удобный мессенджер:",
    },
  };

  return NextResponse.json(config, {
    status: 200,
    headers: { ...CORS_HEADERS, ...CACHE_HEADERS },
  });
}
