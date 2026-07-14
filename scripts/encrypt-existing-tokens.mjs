// ============================================================================
// encrypt-existing-tokens.mjs — one-shot backfill: encrypt plaintext tokens in Business
// ============================================================================
//
// ЧТО ДЕЛАЕТ:
//   Читает все Business, для каждого поля токена канала — если оно plaintext
//   (не начинается с "v1:"), шифрует через AES-256-GCM и обновляет в БД.
//   Идемпотентно — можно перезапускать многократно, уже зашифрованные пропускаются.
//
// ЗАЧЕМ:
//   После деплоя Phase 2 (encrypt в writes) и Phase 3 (decrypt в reads) новые
//   изменения токенов сохраняются шифрованными автоматически. Но старые
//   существующие строки лежат plaintext до тех пор пока владелец не переподключит
//   канал. Этот скрипт мигрирует их сразу.
//
// ЗАПУСК (из папки staffix):
//   set ENCRYPTION_MASTER_KEY=<32-byte-base64>
//   set DATABASE_URL=<prod-postgres-url>
//   node scripts/encrypt-existing-tokens.mjs
//
// ОБЯЗАТЕЛЬНО СНАЧАЛА ПРОТЕСТИРОВАТЬ НА КОПИИ БД:
//   1. Дублировать prod PostgreSQL в Railway ("Duplicate" в UI)
//   2. Взять DATABASE_URL копии
//   3. Прогнать скрипт против копии
//   4. Проверить: подключиться под demo-аккаунтом, отправить сообщение через
//      каждый канал (TG/WA/IG/FB), убедиться что бот отвечает
//   5. Только если всё зелёное — прогнать против prod
//
// ФЛАГИ:
//   --dry-run — только показать что будет зашифровано, ничего не менять
//   --verbose — подробный лог по каждому Business
//
// SAFETY:
//   - НИКОГДА не работает без ENCRYPTION_MASTER_KEY (32 байта base64) — падает сразу
//   - Проверяет каждое поле по одному, транзакционно per-business
//   - Не трогает уже зашифрованные (v1:...) значения
//   - Не трогает null/пустые значения
//   - Ошибка на одном бизнесе не ломает остальные
// ----------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "node:crypto";

// ─── Crypto (duplicate of src/lib/crypto.ts — не хочу зависимость от TS build) ────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const VERSION_PREFIX = "v1:";

function loadKey() {
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) {
    console.error("ERROR: ENCRYPTION_MASTER_KEY env var not set. Aborting.");
    console.error("Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"");
    process.exit(1);
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_LENGTH) {
    console.error(`ERROR: ENCRYPTION_MASTER_KEY must be ${KEY_LENGTH} bytes; got ${key.length}. Aborting.`);
    process.exit(1);
  }
  return key;
}

function isEncrypted(value) {
  if (!value) return false;
  if (!value.startsWith(VERSION_PREFIX)) return false;
  return value.split(":").length === 4;
}

function encrypt(plaintext, key) {
  if (plaintext == null || plaintext === "") return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION_PREFIX}${iv.toString("base64")}:${ct.toString("base64")}:${tag.toString("base64")}`;
}

// ─── Backfill ─────────────────────────────────────────────────────────────────

const TOKEN_FIELDS = [
  "botToken",
  "webhookSecret",
  "waAccessToken",
  "waVerifyToken",
  "fbPageAccessToken",
  "fbVerifyToken",
  "metaUserAccessToken",
];

const dryRun = process.argv.includes("--dry-run");
const verbose = process.argv.includes("--verbose");

const key = loadKey();
const prisma = new PrismaClient();

async function main() {
  console.log(dryRun ? "[DRY RUN] Not making any changes\n" : "[LIVE] Will update DB\n");

  const businesses = await prisma.business.findMany({
    select: {
      id: true,
      name: true,
      ...Object.fromEntries(TOKEN_FIELDS.map((f) => [f, true])),
    },
  });

  console.log(`Loaded ${businesses.length} businesses\n`);

  const stats = {
    businessesTouched: 0,
    fieldsEncrypted: 0,
    fieldsSkipped: 0,
    errors: 0,
  };

  for (const biz of businesses) {
    const updates = {};
    const touched = [];

    for (const field of TOKEN_FIELDS) {
      const value = biz[field];
      if (!value) {
        stats.fieldsSkipped++;
        continue;
      }
      if (isEncrypted(value)) {
        if (verbose) console.log(`  ${biz.id.slice(0, 8)}… ${field}: ALREADY ENCRYPTED — skipping`);
        stats.fieldsSkipped++;
        continue;
      }
      // Plaintext — encrypt
      try {
        updates[field] = encrypt(value, key);
        touched.push(field);
        stats.fieldsEncrypted++;
      } catch (e) {
        console.error(`  ${biz.id.slice(0, 8)}… ${field}: ENCRYPT FAILED — ${e.message}`);
        stats.errors++;
      }
    }

    if (touched.length === 0) {
      if (verbose) console.log(`  ${biz.id.slice(0, 8)}… ${biz.name}: nothing to update`);
      continue;
    }

    console.log(`  ${biz.id.slice(0, 8)}… ${biz.name}: encrypting [${touched.join(", ")}]`);
    stats.businessesTouched++;

    if (!dryRun) {
      try {
        await prisma.business.update({
          where: { id: biz.id },
          data: updates,
        });
      } catch (e) {
        console.error(`    UPDATE FAILED for ${biz.id}: ${e.message}`);
        stats.errors++;
      }
    }
  }

  console.log("\n─── Summary ───────────────────────────");
  console.log(`  Businesses total:     ${businesses.length}`);
  console.log(`  Businesses touched:   ${stats.businessesTouched}`);
  console.log(`  Fields encrypted:     ${stats.fieldsEncrypted}`);
  console.log(`  Fields skipped:       ${stats.fieldsSkipped} (null or already encrypted)`);
  console.log(`  Errors:               ${stats.errors}`);
  if (dryRun) console.log(`\n  [DRY RUN] — no DB writes. Run without --dry-run to apply.`);
  console.log("");
}

main()
  .catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
