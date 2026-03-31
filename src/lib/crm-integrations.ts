/**
 * CRM Integrations Dispatcher
 * Отправляет события из Staffix во внешние CRM системы:
 * - Universal Webhook (любой HTTP endpoint)
 * - Google Sheets
 * - Bitrix24
 * - AmoCRM
 *
 * Security: SSRF protection, token encryption, retry logic, deduplication
 */

import { createHmac, createCipheriv, createDecipheriv, randomBytes } from "crypto";
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
// SSRF PROTECTION
// ========================================

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "metadata.google.internal",
  "metadata.google",
  "169.254.169.254",
]);

function isPrivateIP(hostname: string): boolean {
  // Check known blocked hosts
  if (BLOCKED_HOSTS.has(hostname.toLowerCase())) return true;

  // Check IP patterns for private/internal ranges
  const parts = hostname.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts.map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 127) return true; // 127.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
    if (a === 0) return true; // 0.0.0.0/8
    if (a >= 224) return true; // 224.0.0.0+ multicast & reserved
  }

  return false;
}

/**
 * Validates a URL is safe to send requests to (prevents SSRF)
 */
export function validateExternalUrl(urlString: string): void {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new Error("Некорректный URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL должен использовать http или https");
  }

  if (isPrivateIP(parsed.hostname)) {
    throw new Error("URL не может указывать на внутренний/приватный адрес");
  }

  // Block URLs with auth credentials
  if (parsed.username || parsed.password) {
    throw new Error("URL не должен содержать учётные данные");
  }
}

// ========================================
// TOKEN ENCRYPTION
// ========================================

const ENCRYPTION_KEY = process.env.CRM_ENCRYPTION_KEY; // 32-byte hex string
const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer | null {
  if (!ENCRYPTION_KEY) return null;
  return Buffer.from(ENCRYPTION_KEY, "hex");
}

/**
 * Encrypt sensitive config fields before storing in DB.
 * Gracefully returns plaintext if no encryption key is configured.
 */
export function encryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  const key = getEncryptionKey();
  if (!key) return config;

  const sensitiveFields = ["token", "accessToken", "secret", "credentialsJson"];
  const encrypted = { ...config };

  for (const field of sensitiveFields) {
    if (encrypted[field] && typeof encrypted[field] === "string") {
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      let ciphertext = cipher.update(encrypted[field] as string, "utf8", "hex");
      ciphertext += cipher.final("hex");
      const tag = cipher.getAuthTag().toString("hex");
      encrypted[field] = `enc:${iv.toString("hex")}:${tag}:${ciphertext}`;
    }
  }

  return encrypted;
}

/**
 * Decrypt sensitive config fields when reading from DB.
 * Handles both encrypted and plaintext values gracefully.
 */
export function decryptConfig(config: Record<string, unknown>): Record<string, unknown> {
  const key = getEncryptionKey();
  if (!key) return config;

  const decrypted = { ...config };

  for (const [field, value] of Object.entries(decrypted)) {
    if (typeof value === "string" && value.startsWith("enc:")) {
      try {
        const parts = value.split(":");
        if (parts.length === 4) {
          const iv = Buffer.from(parts[1], "hex");
          const tag = Buffer.from(parts[2], "hex");
          const ciphertext = parts[3];
          const decipher = createDecipheriv(ALGORITHM, key, iv);
          decipher.setAuthTag(tag);
          let plaintext = decipher.update(ciphertext, "hex", "utf8");
          plaintext += decipher.final("utf8");
          decrypted[field] = plaintext;
        }
      } catch (err) {
        console.error(`[CRM] Failed to decrypt field ${field}:`, err);
        // Leave as-is if decryption fails — will show error on use
      }
    }
  }

  return decrypted;
}

// ========================================
// RETRY LOGIC
// ========================================

async function fetchWithRetry(
  url: string,
  options: RequestInit & { signal?: AbortSignal },
  maxRetries = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 429 (rate limit) and 5xx (server errors)
      if (response.status === 429 || (response.status >= 500 && attempt < maxRetries)) {
        const retryAfter = response.headers.get("retry-after");
        const delay = retryAfter
          ? Math.min(parseInt(retryAfter, 10) * 1000, 10000)
          : Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on abort/timeout
      if (lastError.name === "AbortError" || lastError.name === "TimeoutError") {
        throw lastError;
      }

      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
    }
  }

  throw lastError || new Error("fetchWithRetry: all attempts failed");
}

// ========================================
// EVENT DEDUPLICATION
// ========================================

const recentEvents = new Map<string, number>();
const DEDUP_TTL_MS = 60_000; // 1 minute

function isDuplicate(businessId: string, eventType: string, clientId: string | null): boolean {
  // Cleanup old entries
  const now = Date.now();
  for (const [key, ts] of recentEvents) {
    if (now - ts > DEDUP_TTL_MS) recentEvents.delete(key);
  }

  const dedupKey = `${businessId}:${eventType}:${clientId || "unknown"}`;
  if (recentEvents.has(dedupKey)) return true;

  recentEvents.set(dedupKey, now);
  return false;
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
    // Deduplication: skip if same event for same client was dispatched within 1 min
    const clientId = payload.client.telegramId || payload.client.phone;
    if (isDuplicate(businessId, eventType, clientId)) {
      console.log(`[CRM] Skipping duplicate event: ${eventType} for ${clientId}`);
      return;
    }

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
  // Decrypt config before use
  const rawConfig = integration.config as Record<string, unknown>;
  const config = decryptConfig(rawConfig);

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

  // SSRF protection
  validateExternalUrl(url);

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

  // Дополнительные кастомные заголовки (sanitize: only allow string values)
  if (config.headers && typeof config.headers === "object") {
    const customHeaders = config.headers as Record<string, unknown>;
    for (const [key, value] of Object.entries(customHeaders)) {
      if (typeof value === "string" && !key.toLowerCase().startsWith("x-staffix-")) {
        headers[key] = value;
      }
    }
  }

  const response = await fetchWithRetry(url, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10000),
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

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetchWithRetry(url, {
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
    if (response.status === 429) {
      throw new Error("Google Sheets: превышен лимит запросов. Попробуйте позже.");
    }
    if (response.status === 403) {
      throw new Error("Google Sheets: нет доступа. Убедитесь что сервисный аккаунт добавлен в редакторы таблицы.");
    }
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

  if (!creds.client_email || !creds.private_key) {
    throw new Error("Google Sheets: credentials должны содержать client_email и private_key");
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

  const tokenResponse = await fetchWithRetry("https://oauth2.googleapis.com/token", {
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

  // Sanitize domain — only allow valid Bitrix24 hostnames
  if (!/^[\w.-]+\.bitrix24\.\w+$/.test(domain)) {
    throw new Error("Bitrix24: некорректный домен. Формат: mycompany.bitrix24.ru");
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
  // Ищем по телефону используя crm.duplicate.findbycomm (правильный API для поиска по телефону)
  if (client.phone) {
    try {
      const searchRes = await fetchWithRetry(
        `${baseUrl}/crm.duplicate.findbycomm.json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "PHONE",
            values: [client.phone],
            entity_type: "CONTACT",
          }),
          signal: AbortSignal.timeout(8000),
        }
      );

      if (searchRes.ok) {
        const data = (await searchRes.json()) as {
          result?: { CONTACT?: string[] };
        };
        if (data.result?.CONTACT?.length) {
          return data.result.CONTACT[0];
        }
      }
    } catch {
      // If duplicate search fails, continue to create new contact
    }
  }

  // Создаём новый контакт
  const phones = client.phone
    ? [{ VALUE: client.phone, VALUE_TYPE: "WORK" }]
    : [];

  const nameParts = (client.name || "Клиент Staffix").split(" ");
  const createRes = await fetchWithRetry(`${baseUrl}/crm.contact.add.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        NAME: nameParts[0] || "Клиент",
        LAST_NAME: nameParts.slice(1).join(" ") || "",
        PHONE: phones,
        COMMENTS: `Источник: Staffix\nTelegram ID: ${client.telegramId || "—"}\nВизитов: ${client.totalVisits}`,
        SOURCE_ID: "OTHER",
      },
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "");
    if (createRes.status === 401) {
      throw new Error("Bitrix24: токен недействителен. Пересоздайте входящий вебхук в Bitrix24.");
    }
    throw new Error(`Bitrix24 contact create failed (${createRes.status}): ${errText.slice(0, 200)}`);
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
    CURRENCY_ID: "KZT",
    SOURCE_ID: "OTHER",
    COMMENTS: `Мастер: ${b.master || "—"}\nДата: ${new Date(b.date).toLocaleString("ru-RU")}\nСервис: Staffix`,
  };

  if (contactId) {
    fields.CONTACT_ID = contactId;
  }

  await fetchWithRetry(`${baseUrl}/crm.deal.add.json`, {
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

  await fetchWithRetry(`${baseUrl}/crm.activity.add.json`, {
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

  // Sanitize domain — only allow valid subdomain names
  if (!/^[\w-]+$/.test(domain)) {
    throw new Error("AmoCRM: некорректный домен. Укажите только субдомен (например: mycompany)");
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
    const searchRes = await fetchWithRetry(
      `${baseUrl}/contacts?query=${encodeURIComponent(client.phone)}&limit=1`,
      { headers, signal: AbortSignal.timeout(8000) }
    );

    if (searchRes.status === 401) {
      throw new Error("AmoCRM: токен истёк или недействителен. Обновите access token в настройках интеграции.");
    }

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

  const createRes = await fetchWithRetry(`${baseUrl}/contacts`, {
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

  if (createRes.status === 401) {
    throw new Error("AmoCRM: токен истёк или недействителен. Обновите access token в настройках интеграции.");
  }

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

  const res = await fetchWithRetry(`${baseUrl}/leads`, {
    method: "POST",
    headers,
    body: JSON.stringify([lead]),
    signal: AbortSignal.timeout(8000),
  });

  if (res.status === 401) {
    throw new Error("AmoCRM: токен истёк или недействителен. Обновите access token в настройках интеграции.");
  }
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
