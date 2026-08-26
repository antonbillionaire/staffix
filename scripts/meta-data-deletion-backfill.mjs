// ============================================================================
// meta-data-deletion-backfill.mjs — одноразовая обработка накопившихся
// User Data Deletion Requests из Meta App Dashboard (26 августа 2026).
// ============================================================================
//
// ЗАЧЕМ:
// Мета шлёт письмо раз в 21 день со списком ASID пользователей, запросивших
// удаление данных. До сегодняшнего фикса endpoint `/api/meta/data-deletion`
// работал только для владельцев бизнесов (Business.metaUserId = ASID) —
// запросы про конечных клиентов накапливались непроцессированными.
//
// Файл со списком ASID можно скачать в:
//   Meta App Dashboard → App Settings → Advanced → «Download User Identifiers»
// (файл истекает через 60 дней, скачивай сразу как приходит письмо).
//
// ЗАПУСК:
//   1. Скачай CSV/TXT из Dashboard (обычно `<AppID>_YYYY-MM-DD.csv`)
//   2. Из папки staffix (где .env с DATABASE_URL + META_APP_SECRET):
//        node scripts/meta-data-deletion-backfill.mjs <path-to-file>
//   3. Смотри лог. Если хочешь dry-run (не удалять, только показать что нашли):
//        node scripts/meta-data-deletion-backfill.mjs <file> --dry-run
//
// ФОРМАТ ФАЙЛА:
// Мета отдаёт разные форматы, скрипт принимает всё что может выглядеть
// как список ASID: по одному на строку, CSV с колонкой ASID/user_id/id,
// JSON-массив ["asid1","asid2"] и т.п. Парсер извлекает всё что похоже
// на цифровой ID длиной 5+ символов.

import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const APP_ID = "1875270986685772";
const APP_SECRET = process.env.META_APP_SECRET;

if (!APP_SECRET) {
  console.error("META_APP_SECRET is not set in env. Add it to .env or export it.");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filePath = args.find((a) => !a.startsWith("--"));

if (!filePath) {
  console.error("Usage: node scripts/meta-data-deletion-backfill.mjs <path-to-file> [--dry-run]");
  process.exit(1);
}

// ── Парсер файла: извлекаем ASID из любого разумного формата ─────────────
function extractAsids(raw) {
  const asids = new Set();
  // Просто ищем все цифровые последовательности длиной 5+ (ASID — обычно
  // 15-17 цифр, но берём с запасом чтобы не потерять test ID). Отсекаем
  // явные false-positives: числа < 10^5 (маленькие штуки в CSV headers).
  const matches = raw.match(/\d{5,}/g) || [];
  for (const m of matches) {
    asids.add(m);
  }
  return Array.from(asids);
}

// ── Graph API: резолв ASID → PSID/IGSID ────────────────────────────────
function buildAppAccessToken() {
  return `${APP_ID}|${APP_SECRET}`;
}

async function resolveAsidToPageScopedIds(asid) {
  const appToken = buildAppAccessToken();
  const result = new Set();
  for (const endpoint of ["ids_for_pages", "ids_for_business"]) {
    try {
      const url = `https://graph.facebook.com/v21.0/${encodeURIComponent(asid)}/${endpoint}?access_token=${encodeURIComponent(appToken)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`  ${endpoint} → HTTP ${res.status}: ${errText.slice(0, 150)}`);
        continue;
      }
      const data = await res.json();
      for (const entry of data.data ?? []) {
        if (entry.id) result.add(entry.id);
      }
    } catch (e) {
      console.warn(`  ${endpoint} → fetch failed:`, e.message);
    }
  }
  return Array.from(result);
}

// ── Удаление (то же самое что endpoint делает — но здесь inline через prisma) ─
const META_CHANNELS = ["facebook", "instagram", "messenger"];

async function deleteEndUserData(prisma, pageScopedIds) {
  if (pageScopedIds.length === 0) return { total: 0, breakdown: {} };
  const breakdown = {};

  const clientsToDelete = await prisma.client.findMany({
    where: {
      OR: [
        { instagramId: { in: pageScopedIds } },
        { fbPsid: { in: pageScopedIds } },
      ],
    },
    select: { id: true },
  });
  const clientIds = clientsToDelete.map((c) => c.id);

  if (!dryRun) {
    breakdown.clients = (
      await prisma.client.deleteMany({
        where: {
          OR: [
            { instagramId: { in: pageScopedIds } },
            { fbPsid: { in: pageScopedIds } },
          ],
        },
      })
    ).count;
    breakdown.channelClients = (
      await prisma.channelClient.deleteMany({
        where: {
          OR: [
            { instagramId: { in: pageScopedIds } },
            { fbPsid: { in: pageScopedIds } },
          ],
        },
      })
    ).count;
    breakdown.channelConversations = (
      await prisma.channelConversation.deleteMany({
        where: {
          channel: { in: META_CHANNELS },
          clientId: { in: pageScopedIds },
        },
      })
    ).count;
    breakdown.channelMessages = (
      await prisma.channelMessage.deleteMany({
        where: {
          channel: { in: META_CHANNELS },
          chatId: { in: pageScopedIds },
        },
      })
    ).count;
    breakdown.leads = (
      await prisma.lead.deleteMany({
        where: {
          channel: { in: META_CHANNELS },
          clientId: null,
        },
      })
    ).count;
    breakdown.salesLeads = (
      await prisma.salesLead.deleteMany({
        where: {
          OR: [
            { instagramId: { in: pageScopedIds } },
            { fbPsid: { in: pageScopedIds } },
          ],
        },
      })
    ).count;
    breakdown.tasksCleared = (
      await prisma.task.updateMany({
        where: {
          clientChannel: { in: META_CHANNELS },
          clientChannelId: { in: pageScopedIds },
        },
        data: { clientChannel: null, clientChannelId: null },
      })
    ).count;
    breakdown.ordersObfuscated = (
      await prisma.order.updateMany({
        where: {
          clientChannel: { in: META_CHANNELS },
          clientChannelId: { in: pageScopedIds },
        },
        data: {
          clientChannelId: null,
          clientName: "deleted",
          clientPhone: null,
          clientAddress: null,
          clientNotes: null,
        },
      })
    ).count;
    if (clientIds.length > 0) {
      await prisma.businessActivityLog.deleteMany({
        where: {
          clientId: { in: clientIds },
          channel: { in: META_CHANNELS },
        },
      });
    }
  } else {
    // dry-run: только считаем сколько ЗАТРОНУЛО БЫ
    breakdown.clients = clientsToDelete.length;
    breakdown.channelClients = await prisma.channelClient.count({
      where: {
        OR: [
          { instagramId: { in: pageScopedIds } },
          { fbPsid: { in: pageScopedIds } },
        ],
      },
    });
    breakdown.channelConversations = await prisma.channelConversation.count({
      where: {
        channel: { in: META_CHANNELS },
        clientId: { in: pageScopedIds },
      },
    });
    breakdown.channelMessages = await prisma.channelMessage.count({
      where: {
        channel: { in: META_CHANNELS },
        chatId: { in: pageScopedIds },
      },
    });
    breakdown.salesLeads = await prisma.salesLead.count({
      where: {
        OR: [
          { instagramId: { in: pageScopedIds } },
          { fbPsid: { in: pageScopedIds } },
        ],
      },
    });
    breakdown.tasksCleared = await prisma.task.count({
      where: {
        clientChannel: { in: META_CHANNELS },
        clientChannelId: { in: pageScopedIds },
      },
    });
    breakdown.ordersObfuscated = await prisma.order.count({
      where: {
        clientChannel: { in: META_CHANNELS },
        clientChannelId: { in: pageScopedIds },
      },
    });
  }
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total, breakdown };
}

// ── main ────────────────────────────────────────────────────────────────
async function main() {
  const raw = readFileSync(filePath, "utf-8");
  const asids = extractAsids(raw);
  console.log(`\n=== Meta Data Deletion backfill ${dryRun ? "(DRY RUN)" : "(LIVE)"} ===`);
  console.log(`Файл: ${filePath}`);
  console.log(`Извлечено ASID: ${asids.length}`);
  if (asids.length === 0) {
    console.log("Ничего не нашли в файле. Проверь формат.");
    return;
  }

  const prisma = new PrismaClient();
  const grandTotals = {
    asidsProcessed: 0,
    asidsWithData: 0,
    pageScopedIdsResolved: 0,
    totalDeletions: 0,
    perTable: {},
  };

  try {
    for (let i = 0; i < asids.length; i++) {
      const asid = asids[i];
      console.log(`\n[${i + 1}/${asids.length}] ASID ${asid}`);
      const resolvedFromGraph = await resolveAsidToPageScopedIds(asid);
      // Fallback: raw user_id тоже пробуем как page-scoped ID напрямую —
      // для IG Messaging API Meta шлёт IGSID, а не ASID (см. lib/meta-data-deletion.ts).
      const pageScopedIds = Array.from(new Set([asid, ...resolvedFromGraph]));
      console.log(
        `  Graph API вернул: ${resolvedFromGraph.length}. Пробуем ${pageScopedIds.length} ID: ${pageScopedIds.join(", ")}`
      );
      grandTotals.pageScopedIdsResolved += resolvedFromGraph.length;
      grandTotals.asidsProcessed++;

      if (pageScopedIds.length === 0) continue;

      const { total, breakdown } = await deleteEndUserData(prisma, pageScopedIds);
      if (total > 0) {
        grandTotals.asidsWithData++;
        grandTotals.totalDeletions += total;
        for (const [k, v] of Object.entries(breakdown)) {
          grandTotals.perTable[k] = (grandTotals.perTable[k] || 0) + v;
        }
        console.log(`  ${dryRun ? "[dry-run] Затронуло бы" : "Удалили/обфусцировали"}:`, breakdown);
      } else {
        console.log(`  Данных в базе нет — ASID можно пропустить.`);
      }
    }

    console.log(`\n=== Итого ===`);
    console.log(`ASID обработано: ${grandTotals.asidsProcessed}/${asids.length}`);
    console.log(`ASID с данными в базе: ${grandTotals.asidsWithData}`);
    console.log(`Резолвили в page-scoped IDs: ${grandTotals.pageScopedIdsResolved}`);
    console.log(`${dryRun ? "Затронуло бы" : "Всего удалили/обновили"}: ${grandTotals.totalDeletions}`);
    console.log("По таблицам:", grandTotals.perTable);
    if (dryRun) {
      console.log(`\nЭто dry-run — ничего не удалено. Запусти без --dry-run когда убедишься что цифры разумные.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
