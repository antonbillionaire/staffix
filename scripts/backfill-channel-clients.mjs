// ============================================================================
// backfill-channel-clients.mjs — переносит существующих ChannelClient в
// унифицированную модель Client (Sprint 3, июль 2026).
// ============================================================================
//
// ЗАЧЕМ:
// До Sprint 3 каналы WA/IG/FB писали клиентов в отдельную таблицу
// ChannelClient. Client в это время требовал telegramId. После step 1 схема
// разрешает non-TG клиентов в Client, а step 2 добавил shadow-write:
// новые WA/IG/FB сообщения одновременно создают Client и ChannelClient.
//
// СТАРЫЕ ChannelClient — до shadow-write — в Client не попадают. Этот
// backfill проходит по всем ним и делает то что shadow-write делает
// для новых:
//   1. Пытается найти существующий Client в этом бизнесе по:
//      - точному matching channel-id (whatsappPhone / instagramId / fbPsid)
//      - или phone (нормализованный, последние 9 цифр)
//   2. Если нашёл — обновляет соответствующим channel-id
//   3. Если не нашёл — создаёт новый Client с channel-id + именем + phone
//
// РЕЖИМЫ:
//   node scripts/backfill-channel-clients.mjs --dry-run
//     Ничего не пишет в БД. Печатает план: N клиентов будет merged,
//     M — created. Безопасно на проде.
//
//   node scripts/backfill-channel-clients.mjs
//     Реально применяет изменения. Идемпотентен — можно перезапускать.
//
//   node scripts/backfill-channel-clients.mjs --business <businessId>
//     Обрабатывает только один бизнес (для теста на конкретной компании).
//
// ЗАПУСК (из папки staffix с prod DATABASE_URL в .env):
//   node scripts/backfill-channel-clients.mjs --dry-run
//   node scripts/backfill-channel-clients.mjs
//
// ============================================================================

import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { dryRun: false, businessId: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") opts.dryRun = true;
    else if (args[i] === "--business") opts.businessId = args[++i];
  }
  return opts;
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.slice(-9); // последние 9 цифр — работает для всех стран СНГ
}

/**
 * Возвращает Client-канальный идентификатор для данного ChannelClient.
 * Приоритет:
 *   lastChannel === "whatsapp" → whatsappPhone или whatsappId (первый непустой)
 *   lastChannel === "instagram" → instagramId
 *   lastChannel === "facebook"|"messenger" → fbPsid или instagramId (legacy)
 *   lastChannel === "telegram" → telegramId (для полноты, обычно не нужно)
 */
function detectChannelIdentity(cc) {
  const ch = cc.lastChannel || "";
  if (ch === "whatsapp") {
    const wa = cc.whatsappPhone || cc.whatsappId;
    if (wa) return { channel: "whatsapp", field: "whatsappId", value: wa };
  }
  if (ch === "instagram") {
    if (cc.instagramId) return { channel: "instagram", field: "instagramId", value: cc.instagramId };
  }
  if (ch === "facebook" || ch === "messenger") {
    const psid = cc.fbPsid || cc.instagramId; // legacy fallback как в channel-memory.ts
    if (psid) return { channel: "facebook", field: "fbPsid", value: psid };
  }
  if (ch === "telegram" && cc.telegramId) {
    return { channel: "telegram", field: "telegramId", value: cc.telegramId };
  }
  // Иногда lastChannel не задан — пробуем эвристически.
  if (cc.whatsappPhone || cc.whatsappId) {
    return { channel: "whatsapp", field: "whatsappId", value: cc.whatsappPhone || cc.whatsappId };
  }
  if (cc.instagramId && !cc.fbPsid) {
    return { channel: "instagram", field: "instagramId", value: cc.instagramId };
  }
  if (cc.fbPsid) {
    return { channel: "facebook", field: "fbPsid", value: cc.fbPsid };
  }
  return null;
}

async function backfillOne(cc, dryRun) {
  const identity = detectChannelIdentity(cc);
  if (!identity) {
    return { action: "skipped", reason: "no channel identity" };
  }

  // Telegram-only записи скорее всего дубли уже существующего Client с TG →
  // отдельно не переносим, а сматчим по telegramId.
  const businessId = cc.businessId;
  const nameGuess = cc.name || [cc.firstName, cc.lastName].filter(Boolean).join(" ") || null;
  const phoneGuess = cc.phone || (identity.channel === "whatsapp" ? `+${identity.value}` : null);

  // 1. Прямой lookup по каналу.
  const directWhere = { businessId };
  if (identity.channel === "telegram") {
    directWhere.telegramId = safeBigInt(identity.value);
  } else {
    directWhere[identity.field] = identity.value;
  }
  const direct = await prisma.client.findFirst({ where: directWhere });
  if (direct) {
    // Уже привязан — обновляем name/phone если пустые (соединяем данные).
    const updates = {};
    if (nameGuess && !direct.name) updates.name = nameGuess;
    if (phoneGuess && !direct.phone) updates.phone = phoneGuess;
    if (Object.keys(updates).length > 0) {
      if (!dryRun) {
        await prisma.client.update({ where: { id: direct.id }, data: updates });
      }
      return { action: "enriched", clientId: direct.id, updates };
    }
    return { action: "already-linked", clientId: direct.id };
  }

  // 2. Fallback: клиент с таким же phone.
  const normPhone = normalizePhone(phoneGuess);
  if (normPhone) {
    const byPhone = await prisma.client.findFirst({
      where: { businessId, phone: { contains: normPhone } },
    });
    if (byPhone) {
      const patch = channelPatch(identity, nameGuess);
      if (!dryRun) {
        await prisma.client.update({ where: { id: byPhone.id }, data: patch });
      }
      return { action: "merged-by-phone", clientId: byPhone.id, patch };
    }
  }

  // 3. Создаём нового.
  const createData = {
    businessId,
    name: nameGuess,
    phone: phoneGuess,
    ...channelPatch(identity, null),
  };
  if (!dryRun) {
    try {
      const created = await prisma.client.create({ data: createData });
      return { action: "created", clientId: created.id };
    } catch (e) {
      // Может ловить unique conflict если параллельно shadow-write создал ту
      // же запись; в таком случае просто пропускаем.
      return { action: "conflict", reason: e.message?.slice(0, 100) };
    }
  }
  return { action: "would-create", data: createData };
}

function channelPatch(identity, name) {
  const patch = {};
  if (name) patch.name = name;
  if (identity.channel === "telegram") {
    patch.telegramId = safeBigInt(identity.value);
  } else {
    patch[identity.field] = identity.value;
  }
  return patch;
}

function safeBigInt(v) {
  try {
    return BigInt(v);
  } catch {
    return BigInt(0);
  }
}

async function main() {
  const { dryRun, businessId } = parseArgs();

  const where = businessId ? { businessId } : {};
  const total = await prisma.channelClient.count({ where });
  console.log(`ChannelClient total: ${total}${dryRun ? " (DRY RUN)" : ""}`);
  if (total === 0) {
    await prisma.$disconnect();
    return;
  }

  const stats = {
    processed: 0,
    "already-linked": 0,
    enriched: 0,
    "merged-by-phone": 0,
    created: 0,
    "would-create": 0,
    skipped: 0,
    conflict: 0,
  };

  let cursor;
  const PAGE = 200;
  while (true) {
    const page = await prisma.channelClient.findMany({
      where,
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });
    if (page.length === 0) break;

    for (const cc of page) {
      const res = await backfillOne(cc, dryRun);
      stats.processed++;
      stats[res.action] = (stats[res.action] || 0) + 1;
    }

    cursor = page[page.length - 1].id;
    if (page.length < PAGE) break;
    console.log(`  processed ${stats.processed} / ${total}...`);
  }

  console.log("\n═══════════════ RESULT ═══════════════");
  console.log(`Total ChannelClient scanned:  ${stats.processed}`);
  console.log(`Already linked to Client:     ${stats["already-linked"]}`);
  console.log(`Enriched existing Client:     ${stats.enriched}`);
  console.log(`Merged by phone match:        ${stats["merged-by-phone"]}`);
  console.log(`Newly created Client:         ${stats.created}`);
  console.log(`Would create (dry-run only):  ${stats["would-create"]}`);
  console.log(`Skipped (no identity):        ${stats.skipped}`);
  console.log(`Conflicts:                    ${stats.conflict}`);
  console.log("══════════════════════════════════════");

  if (dryRun) {
    console.log("\nЭто был DRY-RUN. Ничего не записано в БД.");
    console.log("Запусти без флага чтобы применить: node scripts/backfill-channel-clients.mjs");
  } else {
    console.log("\nBackfill применён. Проверь /dashboard/customers у нескольких бизнесов.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Ошибка:", e);
  await prisma.$disconnect();
  process.exit(1);
});
