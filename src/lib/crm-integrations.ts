/**
 * CRM Integrations Dispatcher
 * Отправляет события из Staffix во внешние CRM системы:
 * - Universal Webhook (любой HTTP endpoint)
 * - Google Sheets
 * - Bitrix24
 * - AmoCRM
 */

import { createHmac } from "crypto";
import { prisma } from "./prisma";

// ========================================
// ТИПЫ СОБЫТИЙ
// ========================================

export type CrmEventType =
  | "booking_created"
  | "booking_confirmed"
  | "booking_cancelled"
  | "new_client"
  | "review_created"
  | "message_received";

export interface CrmBookingPayload {
  id: string;
  service: string | null;
  master: string | null;
  date: string;
  price: number | null;
  status: string;
  clientName: string;
  clientPhone: string | null;
}

export interface CrmClientPayload {
  name: string | null;
  phone: string | null;
  telegramId: string | null;
  totalVisits: number;
  tags: string[];
}

export interface CrmEvent {
  event: CrmEventType;
  timestamp: string;
  business: {
    id: string;
    name: string;
  };
  client: CrmClientPayload;
  booking?: CrmBookingPayload;
  review?: {
    rating: number;
    comment: string | null;
  };
  message?: {
    text: string;
    direction: "incoming" | "outgoing";
  };
}

// ========================================
// ГЛАВНЫЙ ДИСПЕТЧЕР
// ========================================

/**
 * Отправляет событие во все активные CRM интеграции бизнеса
 */
export async function dispatchCrmEvent(
  businessId: string,
  eventType: CrmEventType,
  payload: Omit<CrmEvent, "event" | "timestamp" | "business">
): Promise<void> {
  try {
    // Загружаем активные интеграции, которые слушают этот тип события
    const integrations = await prisma.crmIntegration.findMany({
      where: {
        businessId,
        isActive: true,
        events: { has: eventType },
      },
      include: {
        business: { select: { name: true } },
      },
    });

    if (integrations.length === 0) return;

    const event: CrmEvent = {
      event: eventType,
      timestamp: new Date().toISOString(),
      business: {
        id: businessId,
        name: integrations[0].business.name,
      },
      ...payload,
    };

    // Отправляем в каждую интеграцию параллельно (не блокируем основной флоу)
    const results = await Promise.allSettled(
      integrations.map((integration) =>
        sendToIntegration(integration, event)
      )
    );

    // Обновляем статус каждой интеграции
    for (let i = 0; i < integrations.length; i++) {
      const result = results[i];
      const integration = integrations[i];

      if (result.status === "fulfilled") {
        await prisma.crmIntegration.update({
          where: { id: integration.id },
          data: {
            lastSyncAt: new Date(),
            lastError: null,
          },
        });
      } else {
        const errorMsg =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        await prisma.crmIntegration.update({
          where: { id: integration.id },
          data: {
            lastError: errorMsg.slice(0, 500),
          },
        });
      }
    }
  } catch (err) {
    // Не бросаем ошибку — не хотим ломать основной флоу из-за CRM
    console.error("[CRM] Dispatch error:", err);
  }
}

// ========================================
// РОУТЕР ПО ТИПУ ИНТЕГРАЦИИ
// ========================================

async function sendToIntegration(
  integration: {
    id: string;
    type: string;
    config: unknown;
  },
  event: CrmEvent
): Promise<void> {
  const config = integration.config as Record<string, unknown>;

  switch (integration.type) {
    case "webhook":
      await sendWebhook(config, event);
      break;
    case "google_sheets":
      await sendGoogleSheets(config, event);
      break;
    case "bitrix24":
      await sendBitrix24(config, event);
      break;
    case "amocrm":
      await sendAmoCRM(config, event);
      break;
    default:
      throw new Error(`Unknown integration type: ${integration.type}`);
  }
}

// ========================================
// 1. UNIVERSAL WEBHOOK
// ========================================

async function sendWebhook(
  config: Record<string, unknown>,
  event: CrmEvent
): Promise<void> {
  const url = config.url as string;
  if (!url) throw new Error("Webhook URL is not configured");

  const body = JSON.stringify(event);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Staffix-CRM/1.0",
    "X-Staffix-Event": event.event,
    "X-Staffix-Timestamp": event.timestamp,
  };

  // HMAC подпись если настроен secret
  if (config.secret) {
    const signature = createHmac("sha256", config.secret as string)
      .update(body)
      .digest("hex");
    headers["X-Staffix-Signature"] = `sha256=${signature}`;
  }

  // Дополнительные кастомные заголовки
  if (config.headers && typeof config.headers === "object") {
    Object.assign(headers, config.headers);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10000), // 10 секунд timeout
  });

  if (!response.ok) {
    throw new Error(
      `Webhook returned ${response.status}: ${await response.text().catch(() => "")}`
    );
  }
}

// ========================================
// 2. GOOGLE SHEETS
// ========================================

async function sendGoogleSheets(
  config: Record<string, unknown>,
  event: CrmEvent
): Promise<void> {
  const spreadsheetId = config.spreadsheetId as string;
  const sheetName = (config.sheetName as string) || "Sheet1";

  if (!spreadsheetId) throw new Error("Google Sheets: spreadsheetId not configured");

  // Формируем строку для таблицы
  const row = buildSheetsRow(event);

  // Google Sheets API через сервисный аккаунт
  const accessToken = await getGoogleAccessToken(
    config.credentialsJson as string
  );

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [row],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Google Sheets API error ${response.status}: ${text}`);
  }
}

function buildSheetsRow(event: CrmEvent): string[] {
  const b = event.booking;
  const c = event.client;
  const r = event.review;

  return [
    new Date(event.timestamp).toLocaleString("ru-RU", { timeZone: "UTC" }),
    event.event,
    event.business.name,
    c.name || "",
    c.phone || "",
    c.telegramId || "",
    String(c.totalVisits),
    c.tags.join(", "),
    b?.service || "",
    b?.master || "",
    b ? new Date(b.date).toLocaleString("ru-RU") : "",
    b?.price ? String(b.price) : "",
    b?.status || "",
    r ? String(r.rating) : "",
    r?.comment || "",
  ];
}

async function getGoogleAccessToken(credentialsJson: string): Promise<string> {
  let creds: Record<string, string>;
  try {
    creds = JSON.parse(credentialsJson);
  } catch {
    throw new Error("Google Sheets: invalid credentials JSON");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");

  const signingInput = `${header}.${payload}`;

  // Используем Web Crypto API (доступен в Node.js 18+)
  const privateKey = creds.private_key.replace(/\\n/g, "\n");
  const keyData = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const keyBuffer = Buffer.from(keyData, "base64");
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    Buffer.from(signingInput)
  );

  const jwt = `${signingInput}.${Buffer.from(signature).toString("base64url")}`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google OAuth error: ${await tokenResponse.text()}`);
  }

  const data = (await tokenResponse.json()) as { access_token: string };
  return data.access_token;
}

// ========================================
// 3. BITRIX24
// ========================================

async function sendBitrix24(
  config: Record<string, unknown>,
  event: CrmEvent
): Promise<void> {
  const domain = (config.domain as string)?.replace(/\/$/, "");
  const token = config.token as string;

  if (!domain || !token) {
    throw new Error("Bitrix24: domain or token not configured");
  }

  const baseUrl = `https://${domain}/rest/${token}`;

  // Создаём/обновляем контакт
  const contactId = await upsertBitrix24Contact(baseUrl, event.client);

  // Создаём сделку при новом бронировании
  if (event.event === "booking_created" && event.booking) {
    await createBitrix24Deal(baseUrl, contactId, event);
  }

  // Добавляем активность (звонок/встреча)
  if (event.booking) {
    await createBitrix24Activity(baseUrl, contactId, event);
  }
}

async function upsertBitrix24Contact(
  baseUrl: string,
  client: CrmClientPayload
): Promise<string | null> {
  // Ищем по телефону
  if (client.phone) {
    const searchRes = await fetch(
      `${baseUrl}/crm.contact.list.json?filter[PHONE]=${encodeURIComponent(client.phone)}&select[]=ID`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (searchRes.ok) {
      const data = (await searchRes.json()) as { result: Array<{ ID: string }> };
      if (data.result?.length > 0) {
        return data.result[0].ID;
      }
    }
  }

  // Создаём новый контакт
  const phones = client.phone
    ? [{ VALUE: client.phone, VALUE_TYPE: "WORK" }]
    : [];

  const nameParts = (client.name || "Клиент Staffix").split(" ");
  const createRes = await fetch(`${baseUrl}/crm.contact.add.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        NAME: nameParts[0] || "Клиент",
        LAST_NAME: nameParts.slice(1).join(" ") || "",
        PHONE: phones,
        COMMENTS: `Источник: Staffix Telegram Bot\nTelegram ID: ${client.telegramId || "—"}\nВизитов: ${client.totalVisits}`,
        SOURCE_ID: "OTHER",
      },
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!createRes.ok) {
    throw new Error(`Bitrix24 contact create failed: ${createRes.status}`);
  }

  const createData = (await createRes.json()) as { result: string };
  return createData.result || null;
}

async function createBitrix24Deal(
  baseUrl: string,
  contactId: string | null,
  event: CrmEvent
): Promise<void> {
  const b = event.booking!;
  const fields: Record<string, unknown> = {
    TITLE: `${b.service || "Услуга"} — ${event.client.name || "Клиент"} (${event.business.name})`,
    OPPORTUNITY: b.price || 0,
    CURRENCY_ID: "RUB",
    SOURCE_ID: "OTHER",
    COMMENTS: `Мастер: ${b.master || "—"}\nДата: ${new Date(b.date).toLocaleString("ru-RU")}\nСервис: Staffix`,
  };

  if (contactId) {
    fields.CONTACT_ID = contactId;
  }

  await fetch(`${baseUrl}/crm.deal.add.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
    signal: AbortSignal.timeout(8000),
  });
}

async function createBitrix24Activity(
  baseUrl: string,
  contactId: string | null,
  event: CrmEvent
): Promise<void> {
  const b = event.booking!;
  const bindings = contactId
    ? [{ OWNER_TYPE_ID: 3, OWNER_ID: contactId }] // 3 = Contact
    : [];

  await fetch(`${baseUrl}/crm.activity.add.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        TYPE_ID: 1, // 1 = Встреча
        SUBJECT: `${b.service || "Запись"} через Staffix`,
        DESCRIPTION: `Клиент: ${event.client.name || "—"}\nМастер: ${b.master || "—"}\nСтатус: ${b.status}`,
        START_TIME: b.date,
        END_TIME: b.date,
        BINDINGS: bindings,
        COMPLETED: b.status === "completed" ? "Y" : "N",
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
}

// ========================================
// 4. AMOCRM
// ========================================

async function sendAmoCRM(
  config: Record<string, unknown>,
  event: CrmEvent
): Promise<void> {
  const domain = (config.domain as string)?.replace(/\/$/, "");
  const token = config.token as string;

  if (!domain || !token) {
    throw new Error("AmoCRM: domain or token not configured");
  }

  const baseUrl = `https://${domain}.amocrm.ru/api/v4`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Создаём контакт
  const contactId = await upsertAmoCRMContact(baseUrl, headers, event.client);

  // Создаём сделку при новом бронировании
  if (event.event === "booking_created" && event.booking) {
    await createAmoCRMLead(baseUrl, headers, contactId, event, config);
  }
}

async function upsertAmoCRMContact(
  baseUrl: string,
  headers: Record<string, string>,
  client: CrmClientPayload
): Promise<number | null> {
  // Поиск по телефону
  if (client.phone) {
    const searchRes = await fetch(
      `${baseUrl}/contacts?query=${encodeURIComponent(client.phone)}&limit=1`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (searchRes.ok) {
      const data = (await searchRes.json()) as {
        _embedded?: { contacts?: Array<{ id: number }> };
      };
      if (data._embedded?.contacts?.length) {
        return data._embedded.contacts[0].id;
      }
    }
  }

  // Создаём нового
  const customFields = [];
  if (client.phone) {
    customFields.push({
      field_code: "PHONE",
      values: [{ value: client.phone, enum_code: "WORK" }],
    });
  }

  const createRes = await fetch(`${baseUrl}/contacts`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      {
        name: client.name || "Клиент Staffix",
        custom_fields_values: customFields,
      },
    ]),
    signal: AbortSignal.timeout(8000),
  });

  if (!createRes.ok) return null;

  const data = (await createRes.json()) as {
    _embedded?: { contacts?: Array<{ id: number }> };
  };
  return data._embedded?.contacts?.[0]?.id ?? null;
}

async function createAmoCRMLead(
  baseUrl: string,
  headers: Record<string, string>,
  contactId: number | null,
  event: CrmEvent,
  config: Record<string, unknown>
): Promise<void> {
  const b = event.booking!;
  const lead: Record<string, unknown> = {
    name: `${b.service || "Услуга"} — ${event.client.name || "Клиент"}`,
    price: b.price || 0,
    status_id: config.statusId || undefined,
    pipeline_id: config.pipelineId || undefined,
    _embedded: contactId
      ? { contacts: [{ id: contactId }] }
      : undefined,
  };

  await fetch(`${baseUrl}/leads`, {
    method: "POST",
    headers,
    body: JSON.stringify([lead]),
    signal: AbortSignal.timeout(8000),
  });
}

// ========================================
// ТЕСТОВЫЙ PAYLOAD (для UI)
// ========================================

export function buildTestCrmEvent(businessName: string): CrmEvent {
  return {
    event: "booking_created",
    timestamp: new Date().toISOString(),
    business: {
      id: "test-business-id",
      name: businessName,
    },
    client: {
      name: "Тест Клиент",
      phone: "+998901234567",
      telegramId: "123456789",
      totalVisits: 5,
      tags: ["vip"],
    },
    booking: {
      id: "test-booking-id",
      service: "Стрижка",
      master: "Алексей",
      date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      price: 25000,
      status: "confirmed",
      clientName: "Тест Клиент",
      clientPhone: "+998901234567",
    },
  };
}
