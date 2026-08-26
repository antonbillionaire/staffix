import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  parseSignedRequest,
  buildAppAccessToken,
  isDeletionStatsEmpty,
} from "../meta-data-deletion";

/**
 * Утилита для тестов — собирает валидный `signed_request` в формате Меты:
 * `<base64url_signature>.<base64url_payload>`, подпись = HMAC-SHA256(payload, secret).
 */
function buildSignedRequest(payload: Record<string, unknown>, appSecret: string): string {
  const payloadStr = Buffer.from(JSON.stringify(payload), "utf-8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const sig = crypto
    .createHmac("sha256", appSecret)
    .update(payloadStr)
    .digest();
  const sigStr = sig
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${sigStr}.${payloadStr}`;
}

describe("parseSignedRequest — валидные запросы", () => {
  const SECRET = "test-app-secret-123";

  it("валидный запрос → распарсенный payload", () => {
    const signed = buildSignedRequest(
      {
        user_id: "1234567890",
        algorithm: "HMAC-SHA256",
        issued_at: 1700000000,
      },
      SECRET
    );
    const result = parseSignedRequest(signed, SECRET);
    expect(result).toEqual({
      user_id: "1234567890",
      algorithm: "HMAC-SHA256",
      issued_at: 1700000000,
    });
  });

  it("algorithm в нижнем регистре — тоже валиден (нормализуем)", () => {
    const signed = buildSignedRequest(
      {
        user_id: "999",
        algorithm: "hmac-sha256",
      },
      SECRET
    );
    expect(parseSignedRequest(signed, SECRET)?.user_id).toBe("999");
  });
});

describe("parseSignedRequest — отклоняемые запросы", () => {
  const SECRET = "test-app-secret-123";

  it("подпись подписана другим секретом → null", () => {
    const signed = buildSignedRequest(
      { user_id: "123", algorithm: "HMAC-SHA256" },
      "wrong-secret"
    );
    expect(parseSignedRequest(signed, SECRET)).toBeNull();
  });

  it("нет точки-разделителя → null", () => {
    expect(parseSignedRequest("no-dot-here", SECRET)).toBeNull();
  });

  it("payload испорчен (не JSON) → null", () => {
    // Валидная подпись для мусорного payload
    const bad = "not-json-data";
    const sig = crypto.createHmac("sha256", SECRET).update(bad).digest();
    const sigStr = sig.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    expect(parseSignedRequest(`${sigStr}.${bad}`, SECRET)).toBeNull();
  });

  it("незнакомый algorithm → null", () => {
    const signed = buildSignedRequest(
      { user_id: "123", algorithm: "MD5" },
      SECRET
    );
    expect(parseSignedRequest(signed, SECRET)).toBeNull();
  });

  it("нет user_id → null", () => {
    const signed = buildSignedRequest(
      { algorithm: "HMAC-SHA256" },
      SECRET
    );
    expect(parseSignedRequest(signed, SECRET)).toBeNull();
  });

  it("user_id не строка → null", () => {
    const signed = buildSignedRequest(
      { user_id: 12345, algorithm: "HMAC-SHA256" },
      SECRET
    );
    expect(parseSignedRequest(signed, SECRET)).toBeNull();
  });

  it("пустая строка → null (защита от timingSafeEqual crash)", () => {
    expect(parseSignedRequest("", SECRET)).toBeNull();
    expect(parseSignedRequest(".", SECRET)).toBeNull();
  });

  it("подпись правильной длины но неверная → null (не бросает)", () => {
    // Собираем валидный payload
    const payload = Buffer.from(JSON.stringify({ user_id: "1", algorithm: "HMAC-SHA256" }))
      .toString("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    // Придумываем неправильную подпись той же длины (32 байта)
    const wrongSig = crypto.randomBytes(32).toString("base64")
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
    expect(parseSignedRequest(`${wrongSig}.${payload}`, SECRET)).toBeNull();
  });
});

describe("buildAppAccessToken", () => {
  it("формат `<app_id>|<app_secret>`", () => {
    expect(buildAppAccessToken("1875270986685772", "secret-abc")).toBe(
      "1875270986685772|secret-abc"
    );
  });
});

describe("isDeletionStatsEmpty", () => {
  const EMPTY = {
    clients: 0,
    channelClients: 0,
    channelConversations: 0,
    channelMessages: 0,
    leads: 0,
    salesLeads: 0,
    tasksCleared: 0,
    ordersObfuscated: 0,
  };

  it("все счётчики 0 → true", () => {
    expect(isDeletionStatsEmpty(EMPTY)).toBe(true);
  });

  it("удалили клиента → false", () => {
    expect(isDeletionStatsEmpty({ ...EMPTY, clients: 1 })).toBe(false);
  });

  it("обфусцировали заказ → false (данные тронуты, надо ответить о работе)", () => {
    expect(isDeletionStatsEmpty({ ...EMPTY, ordersObfuscated: 3 })).toBe(false);
  });

  it("очистили Task → false", () => {
    expect(isDeletionStatsEmpty({ ...EMPTY, tasksCleared: 2 })).toBe(false);
  });
});
