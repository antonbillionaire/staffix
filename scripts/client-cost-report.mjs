// ============================================================================
// client-cost-report.mjs — реальная себестоимость AI по каждому клиенту (бизнесу)
// ============================================================================
//
// ЗАПУСК (из папки staffix, где лежит .env с DATABASE_URL):
//   node scripts/client-cost-report.mjs
//
// С реальным счётом Anthropic за период (для точной раскладки):
//   ANTHROPIC_BILL=170 node scripts/client-cost-report.mjs
//   (ANTHROPIC_BILL — сумма в USD из Anthropic Console за тот же период)
//
// ----------------------------------------------------------------------------
// ЧЕСТНЫЕ ОГРАНИЧЕНИЯ (читать обязательно):
//
// 1. В БД (Business.tokensUsedInput / tokensUsedOutput) пишутся ТОЛЬКО
//    некэшированный вход и выход. Токены кэша (cache_creation / cache_read)
//    НЕ сохраняются — а для клиентов с большой базой знаний/каталогом это
//    ГЛАВНАЯ статья расходов. => расчёт из БД даёт НИЖНЮЮ ГРАНИЦУ, реальная
//    цифра выше (иногда в разы).
//
// 2. Счётчик суммирует токены Sonnet 4.5 (главный ответ) и Haiku 4.5
//    (tool-цикл, саммари) вместе — по нему нельзя разложить по моделям.
//    Поэтому цена показана ВИЛКОЙ: «всё Haiku» (низ) … «всё Sonnet» (верх).
//
// 3. tokensUsed — накопительные за всё время; сообщения тоже считаем за всё
//    время, чтобы знаменатель совпадал. Для помесячной точности нужен либо
//    патч (п. ниже), либо Anthropic Console.
//
// САМЫЙ ТОЧНЫЙ СПОСОБ УЗНАТЬ РЕАЛЬНУЮ ЦИФРУ СЕЙЧАС:
//   взять сумму из Anthropic Console за месяц и поделить на общее число
//   сообщений всех клиентов -> истинный средний $/сообщение (blended).
//   Запусти с ANTHROPIC_BILL=<сумма> — скрипт разложит её по клиентам
//   пропорционально их токенам.
//
// ЧТОБЫ per-client стал ТОЧНЫМ на будущее (рекомендация, код НЕ трогаю):
//   в channel-ai.ts / telegram/ai.ts, где инкрементится tokensUsedInput,
//   добавить два счётчика в модель Business и инкремент:
//       tokensCacheRead   Int @default(0)
//       tokensCacheCreate Int @default(0)
//     data: { tokensCacheRead:   { increment: usage.cache_read_input_tokens ?? 0 },
//             tokensCacheCreate: { increment: usage.cache_creation_input_tokens ?? 0 } }
//   После этого этот скрипт сможет считать полную цену без вилки.
// ----------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Цены за 1M токенов, USD (2026-06, см. _АНАЛИЗ/01_Модель_себестоимости.md)
const PRICE = {
  sonnet: { in: 3, out: 15 },
  haiku:  { in: 1, out: 5 },
};
const USD_KZT = 485;

const bill = process.env.ANTHROPIC_BILL ? Number(process.env.ANTHROPIC_BILL) : null;

function usd(n) { return "$" + n.toFixed(2); }
function kzt(n) { return Math.round(n * USD_KZT).toLocaleString("ru-RU") + " тг"; }

async function main() {
  const businesses = await prisma.business.findMany({
    select: {
      id: true, name: true, businessType: true, dashboardMode: true,
      tokensUsedInput: true, tokensUsedOutput: true,
    },
    orderBy: { tokensUsedOutput: "desc" },
  });

  // Подписки (план + счётчик сообщений биллинга)
  const subs = await prisma.subscription.findMany({
    select: { businessId: true, plan: true, messagesUsed: true, messagesLimit: true },
  });
  const subByBiz = new Map(subs.map((s) => [s.businessId, s]));

  const rows = [];
  let totIn = 0, totOut = 0, totMsg = 0;

  for (const b of businesses) {
    // Входящие сообщения (то, что реально запускает AI): Telegram (role=user) + каналы (incoming)
    let tgUser = 0, chIn = 0;
    try {
      tgUser = await prisma.message.count({
        where: { role: "user", conversation: { is: { businessId: b.id } } },
      });
    } catch { /* модель/связь могла измениться */ }
    try {
      chIn = await prisma.channelMessage.count({
        where: { direction: "incoming", businessId: b.id },
      });
    } catch { /* ignore */ }

    const inbound = tgUser + chIn;
    const inTok = b.tokensUsedInput || 0;
    const outTok = b.tokensUsedOutput || 0;

    // Вилка цены по НЕкэшированным токенам (без кэша — это НИЖНЯЯ граница!)
    const low  = (inTok * PRICE.haiku.in  + outTok * PRICE.haiku.out)  / 1e6; // всё Haiku
    const high = (inTok * PRICE.sonnet.in + outTok * PRICE.sonnet.out) / 1e6; // всё Sonnet

    totIn += inTok; totOut += outTok; totMsg += inbound;
    rows.push({ b, sub: subByBiz.get(b.id), inbound, inTok, outTok, low, high });
  }

  // Раскладка реального счёта Anthropic по клиентам (пропорц. токенам)
  const weightTotal = totIn + totOut;

  console.log("\n=== СЕБЕСТОИМОСТЬ AI ПО КЛИЕНТАМ (Staffix) ===");
  console.log(`Клиентов: ${businesses.length} | Входящих сообщений (всего): ${totMsg.toLocaleString("ru-RU")}`);
  console.log(`Токены: вход(uncached)=${totIn.toLocaleString("ru-RU")}  выход=${totOut.toLocaleString("ru-RU")}`);
  if (bill) console.log(`Реальный счёт Anthropic (задан): ${usd(bill)} → blended = ${usd(bill / (totMsg || 1))}/сообщение`);
  console.log("");

  // Заголовок
  const H = ["Клиент", "План", "Вход.сообщ", "$/мес низ*", "$/мес верх*", bill ? "$/мес РЕАЛ**" : "", bill ? "$/сообщ РЕАЛ" : ""].filter(Boolean);
  console.log(H.join(" | "));

  for (const r of rows.sort((a, z) => z.high - a.high)) {
    const realCost = bill && weightTotal > 0 ? (bill * (r.inTok + r.outTok)) / weightTotal : null;
    const perMsgReal = realCost != null && r.inbound > 0 ? realCost / r.inbound : null;
    const line = [
      (r.b.name || r.b.id).slice(0, 28).padEnd(28),
      (r.sub?.plan || "—").padEnd(8),
      String(r.inbound).padStart(9),
      usd(r.low).padStart(10),
      usd(r.high).padStart(10),
      bill ? usd(realCost).padStart(10) : "",
      bill ? (perMsgReal != null ? "$" + perMsgReal.toFixed(3) : "—").padStart(10) : "",
    ].filter((x) => x !== "");
    console.log(line.join(" | "));
  }

  console.log("\n* низ = все токены по Haiku, верх = все по Sonnet. Обе БЕЗ токенов кэша => это НИЖНЯЯ граница реальной цены.");
  if (bill) console.log("** РЕАЛ = реальный счёт Anthropic, разложенный пропорционально токенам клиента (учитывает кэш неявно, через общий счёт).");
  else console.log("Чтобы увидеть РЕАЛЬНУЮ цену: возьми сумму месяца из Anthropic Console и запусти  ANTHROPIC_BILL=<сумма> node scripts/client-cost-report.mjs");
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
