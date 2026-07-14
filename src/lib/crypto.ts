/**
 * Envelope encryption для integration secrets в Business (июль 2026, P1 fix).
 *
 * Задача: токены каналов (`Business.botToken`, `waAccessToken`, `fbPageAccessToken`
 * и т.п.) хранятся в PostgreSQL в открытом виде. Утечка БД (SQL injection,
 * скомпрометированный dev, украденный backup) = все каналы всех клиентов
 * угнаны. Envelope encryption защищает от такой утечки: без master key
 * (env var, не в БД) шифротекст бесполезен.
 *
 * Алгоритм: AES-256-GCM (стандарт, встроен в Node.js, authenticated).
 *
 * Формат хранения: prefix-versioned in-place
 *   v1:base64(iv):base64(ciphertext):base64(authTag)
 *
 * Почему in-place, а не отдельные колонки:
 *   - Zero-downtime rollout: код деплоится, umеет читать и plaintext, и v1
 *   - Нет схемной миграции
 *   - Лениво бэкфиллится при следующем write, или явно через backfill-скрипт
 *
 * Master key: ENCRYPTION_MASTER_KEY в env, 32 байта в base64.
 * Генерация: `openssl rand -base64 32` (macOS/Linux) или Node:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 *
 * ⚠️  Потеря master key = потеря всех зашифрованных токенов навсегда.
 * Ключ обязательно продублировать в 3 местах (Vercel env + 1Password + оффлайн).
 *
 * Feature flag: если ENCRYPTION_MASTER_KEY не задан → passthrough mode.
 * `encrypt(v)` возвращает `v` как есть (с warning в лог), `decrypt(v)`
 * работает как проходной. Это даёт возможность деплоить код БЕЗ ключа,
 * убедиться что ничего не сломалось, потом установить ключ и запустить бэкфилл.
 */

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — стандарт для GCM
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const VERSION_PREFIX = "v1:";

// Кэшируем ключ в модуле — чтобы не парсить env на каждый вызов
let cachedKey: Buffer | null = null;
let keyLoadAttempted = false;

function loadMasterKey(): Buffer | null {
  if (keyLoadAttempted) return cachedKey;
  keyLoadAttempted = true;

  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    // Passthrough mode — feature flag: код работает без шифрования
    console.warn(
      "[crypto] ENCRYPTION_MASTER_KEY not set — running in PASSTHROUGH mode. " +
      "encrypt() will return plaintext, decrypt() works only on plaintext values. " +
      "Set the env var to enable envelope encryption."
    );
    return null;
  }

  try {
    const key = Buffer.from(raw, "base64");
    if (key.length !== KEY_LENGTH) {
      throw new Error(
        `expected ${KEY_LENGTH} bytes, got ${key.length}. ` +
        `Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
      );
    }
    cachedKey = key;
    return key;
  } catch (e) {
    console.error(
      "[crypto] ENCRYPTION_MASTER_KEY invalid:",
      e instanceof Error ? e.message : String(e),
      "— falling back to PASSTHROUGH mode. Fix the env var ASAP."
    );
    return null;
  }
}

/**
 * true если строка выглядит как v1-зашифрованное значение.
 * Используется в decrypt() (проходной для plaintext) и в backfill-скрипте
 * (пропускать уже зашифрованные).
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  if (!value.startsWith(VERSION_PREFIX)) return false;
  // Формат: v1:iv:ct:tag — 4 части разделённые двоеточием
  const parts = value.split(":");
  return parts.length === 4;
}

/**
 * Шифрует plaintext. Если master key не задан — возвращает plaintext как есть.
 * Пустая строка / null / undefined возвращается как есть (не шифруется).
 */
export function encrypt(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return plaintext === undefined ? null : plaintext;
  }

  // Если уже зашифровано — не шифруем повторно (защита от двойного encrypt)
  if (isEncrypted(plaintext)) return plaintext;

  const key = loadMasterKey();
  if (!key) {
    // Passthrough mode
    return plaintext;
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}${iv.toString("base64")}:${ciphertext.toString("base64")}:${authTag.toString("base64")}`;
}

/**
 * Расшифровывает v1-строку. Если значение не зашифровано (plaintext или null)
 * — возвращает как есть (backwards compatibility на время rollout / бэкфилла).
 *
 * Ошибка расшифровки (GCM authentication fail) — throw. Это должно означать
 * что кто-то подделал шифротекст ИЛИ master key был сменён без бэкфилла.
 */
export function decrypt(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return value === undefined ? null : value;
  }

  // Не v1 — считаем что plaintext (backwards compat)
  if (!isEncrypted(value)) return value;

  const key = loadMasterKey();
  if (!key) {
    // Master key ушёл после того как что-то было зашифровано — не можем расшифровать.
    // Throw, чтобы вызывающий код не отправил "v1:..." строку в Telegram/Meta API.
    throw new Error(
      "[crypto] Encrypted value found but ENCRYPTION_MASTER_KEY not set — cannot decrypt. " +
      "Restore the master key from your backup."
    );
  }

  const [, ivB64, ctB64, tagB64] = value.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`[crypto] invalid IV length: ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`[crypto] invalid auth tag length: ${authTag.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

/**
 * Утилита для миграционных скриптов: перешифровывает значение только если
 * оно plaintext. Идемпотентно — safe вызывать многократно.
 * Возвращает { updated: boolean } чтобы бэкфилл-скрипт мог считать статистику.
 */
export function encryptIfNeeded(value: string | null | undefined): {
  value: string | null;
  updated: boolean;
} {
  if (!value) return { value: value ?? null, updated: false };
  if (isEncrypted(value)) return { value, updated: false };
  const encrypted = encrypt(value);
  return { value: encrypted, updated: encrypted !== value };
}

/**
 * Timing-safe сравнение двух строк одинаковой длины. Не для секретов
 * (`bcrypt.compare` для этого), а для сравнения отпечатков — например,
 * подписей webhook.
 */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return timingSafeEqual(bufA, bufB);
}

/**
 * Только для тестов: сбрасывает кэш ключа. Не использовать в проде.
 */
export function __resetKeyCacheForTests(): void {
  cachedKey = null;
  keyLoadAttempted = false;
}
