// ============================================================================
// backfill-client-phones.mjs — перенос телефонов ChannelClient → Client
// ============================================================================
//
// Зачем (17 сент 2026, Этап 0 research-плана):
//   Бот собирал телефоны и писал их только в ChannelClient.phone (legacy-таблица
//   канала). Карточка клиента в дашборде читает Client — там телефонов почти не
//   было. С коммита d00db2f новые номера пишутся в обе таблицы, но ~60 уже
//   собранных остались только в ChannelClient.
//
// Что делает:
//   Для каждого ChannelClient с непустым phone находит соответствующий Client
//   по channel-id (instagramId / whatsappPhone→whatsappId / fbPsid / telegramId)
//   и заполняет Client.phone — ТОЛЬКО если он пустой.
//
// Безопасность:
//   - Существующие значения Client.phone НЕ перезаписываются
//   - По умолчанию dry-run: печатает что будет сделано, ничего не меняет
//   - Запись только с флагом --apply
//
// Запуск:
//   node scripts/backfill-client-phones.mjs           # dry-run
//   node scripts/backfill-client-phones.mjs --apply   # реальная запись

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** Маскируем номер для вывода — PII в консоль не пишем целиком. */
function mask(phone) {
  if (!phone || phone.length < 6) return "***";
  return phone.slice(0, 5) + "***" + phone.slice(-2);
}

async function main() {
  const sources = await prisma.channelClient.findMany({
    where: { phone: { not: null } },
    select: {
      id: true,
      businessId: true,
      phone: true,
      name: true,
      instagramId: true,
      whatsappPhone: true,
      fbPsid: true,
      telegramId: true,
    },
  });

  console.log(`\nChannelClient с телефоном: ${sources.length}`);
  console.log(APPLY ? "РЕЖИМ: ЗАПИСЬ (--apply)\n" : "РЕЖИМ: dry-run (без --apply ничего не меняется)\n");

  let matched = 0;
  let willUpdate = 0;
  let alreadyHas = 0;
  let noClient = 0;

  for (const cc of sources) {
    // Собираем условия поиска Client по всем известным channel-id.
    // telegramId в ChannelClient — строка, в Client — BigInt.
    const or = [];
    if (cc.instagramId) or.push({ instagramId: cc.instagramId });
    if (cc.fbPsid) or.push({ fbPsid: cc.fbPsid });
    if (cc.whatsappPhone) or.push({ whatsappId: cc.whatsappPhone });
    if (cc.telegramId && /^\d+$/.test(cc.telegramId)) {
      try {
        or.push({ telegramId: BigInt(cc.telegramId) });
      } catch {
        /* нечисловой id — пропускаем */
      }
    }
    if (or.length === 0) {
      noClient++;
      continue;
    }

    const client = await prisma.client.findFirst({
      where: { businessId: cc.businessId, OR: or },
      select: { id: true, phone: true, name: true },
    });

    if (!client) {
      noClient++;
      continue;
    }
    matched++;

    if (client.phone) {
      alreadyHas++;
      continue;
    }

    willUpdate++;
    console.log(`  ${cc.name || client.name || "(без имени)"} → ${mask(cc.phone)}`);

    if (APPLY) {
      await prisma.client.update({
        where: { id: client.id },
        data: { phone: cc.phone },
      });
    }
  }

  console.log(`\n--- Итог ---`);
  console.log(`Нашли Client:            ${matched}`);
  console.log(`Телефон уже был:         ${alreadyHas}`);
  console.log(`${APPLY ? "Обновлено" : "Будет обновлено"}:         ${willUpdate}`);
  console.log(`Client не найден:        ${noClient}`);
  if (!APPLY && willUpdate > 0) {
    console.log(`\nДля записи: node scripts/backfill-client-phones.mjs --apply`);
  }
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
