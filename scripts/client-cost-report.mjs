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
// СТАТУС (после Шага 1 плана оптимизации, 21 июля 2026):
//
// 1. В БД теперь пишутся ВСЕ 4 счётчика: tokensUsedInput / tokensUsedOutput /
//    tokensCacheRead / tokensCacheCreate. Полная per-client себестоимость
//    считается точно, без "невидимой" статьи расходов.
//
// 2. Счётчик всё ещё суммирует Sonnet (главный ответ) + Haiku (tool-цикл)
//    вместе. Поэтому цена показана ВИЛКОЙ: «всё Haiku» (низ) … «всё Sonnet»
//    (верх). Real cost внутри вилки — ближе к Sonnet-стороне для активных
//    клиентов с тяжёлым главным ответом.
//
// 3. tokensUsed — накопительные за всё время. Для помесячной точности —
//    ANTHROPIC_BILL=<сумма месяца> node scripts/client-cost-report.mjs
//    разложит реальный счёт по клиентам пропорционально их 4 токенам.
//
// 4. ИНТЕРПРЕТАЦИЯ Cache hit rate:
//    >60% — здоровый, split-prompt работает
//    30-60% — умеренный, есть куда оптимизировать
//    <30% — плохо, кэш почти не срабатывает (спорадический трафик или
//    промпт нестабилен). Кандидат на Шаг 2 (умный cache_control).
// ----------------------------------------------------------------------------

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Цены за 1M токенов, USD (2026-06, см. _АНАЛИЗ/01_Модель_себестоимости.md).
// cacheWrite — 1h TTL (самый дорогой), cacheRead — 10× дешевле обычного входа.
const PRICE = {
  sonnet: { in: 3, out: 15, cacheWrite1h: 6,   cacheRead: 0.30 },
  haiku:  { in: 1, out: 5,  cacheWrite1h: 2.5, cacheRead: 0.10 },
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
      // Шаг 1 плана оптимизации (21 июля 2026): теперь есть токены кэша.
      // Для старых записей значения = 0, для новых — реальные.
      tokensCacheRead: true, tokensCacheCreate: true,
    },
    orderBy: { tokensUsedOutput: "desc" },
  });

  // Подписки (план + счётчик сообщений биллинга)
  const subs = await prisma.subscription.findMany({
    select: { businessId: true, plan: true, messagesUsed: true, messagesLimit: true },
  });
  const subByBiz = new Map(subs.map((s) => [s.businessId, s]));

  const rows = [];
  let totIn = 0, totOut = 0, totCacheR = 0, totCacheW = 0, totMsg = 0;

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
    const cacheR = b.tokensCacheRead || 0;
    const cacheW = b.tokensCacheCreate || 0;

    // Полная вилка цены с учётом всех 4 компонентов.
    // Sonnet-цена (верх): всё считаем по Sonnet 5 ставкам.
    // Haiku-цена (низ): всё по Haiku 4.5 (актуально для tool-loop итераций).
    // Формула: uncachedIn × rateIn + out × rateOut + cacheRead × rateRead + cacheWrite × rateWrite
    const high = (
      inTok  * PRICE.sonnet.in +
      outTok * PRICE.sonnet.out +
      cacheR * PRICE.sonnet.cacheRead +
      cacheW * PRICE.sonnet.cacheWrite1h
    ) / 1e6;
    const low = (
      inTok  * PRICE.haiku.in +
      outTok * PRICE.haiku.out +
      cacheR * PRICE.haiku.cacheRead +
      cacheW * PRICE.haiku.cacheWrite1h
    ) / 1e6;

    totIn += inTok; totOut += outTok; totCacheR += cacheR; totCacheW += cacheW; totMsg += inbound;
    rows.push({ b, sub: subByBiz.get(b.id), inbound, inTok, outTok, cacheR, cacheW, low, high });
  }

  // Раскладка реального счёта Anthropic по клиентам (пропорц. ВСЕМ 4 типам токенов).
  const weightTotal = totIn + totOut + totCacheR + totCacheW;

  console.log("\n=== СЕБЕСТОИМОСТЬ AI ПО КЛИЕНТАМ (Staffix) ===");
  console.log(`Клиентов: ${businesses.length} | Входящих сообщений (всего): ${totMsg.toLocaleString("ru-RU")}`);
  console.log(`Токены: вход(uncached)=${totIn.toLocaleString("ru-RU")}  выход=${totOut.toLocaleString("ru-RU")}  cache_read=${totCacheR.toLocaleString("ru-RU")}  cache_create=${totCacheW.toLocaleString("ru-RU")}`);
  if (totCacheR + totCacheW === 0) {
    console.log("⚠️  Токены кэша = 0 у всех бизнесов. Значит либо: (1) миграция ещё не применена в проде, либо (2) все данные накоплены ДО деплоя Шага 1. Свежие сообщения будут писать кэш корректно.");
  } else {
    const hitRate = totCacheR / (totIn + totCacheR + totCacheW);
    console.log(`Cache hit rate по всей платформе: ${(hitRate * 100).toFixed(1)}%  (норма >60%; <30% = плохо, кэш почти не работает)`);
  }
  if (bill) console.log(`Реальный счёт Anthropic (задан): ${usd(bill)} → blended = ${usd(bill / (totMsg || 1))}/сообщение`);
  console.log("");

  // Заголовок
  const H = ["Клиент", "План", "Вход.сообщ", "$/мес низ*", "$/мес верх*", bill ? "$/мес РЕАЛ**" : "", bill ? "$/сообщ РЕАЛ" : ""].filter(Boolean);
  console.log(H.join(" | "));

  for (const r of rows.sort((a, z) => z.high - a.high)) {
    // Разложение реального счёта: вес = все 4 типа токенов клиента
    // (cache_create считается наравне с input по deriv-costs).
    const weight = r.inTok + r.outTok + r.cacheR + r.cacheW;
    const realCost = bill && weightTotal > 0 ? (bill * weight) / weightTotal : null;
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

  console.log("\n* низ = все токены по Haiku, верх = все по Sonnet. Теперь ВКЛЮЧАЮТ токены кэша (Шаг 1 плана оптимизации, 21 июля 2026).");
  if (bill) console.log("** РЕАЛ = реальный счёт Anthropic, разложенный пропорционально всем 4 типам токенов клиента.");
  else console.log("Чтобы увидеть РЕАЛЬНУЮ цену: возьми сумму месяца из Anthropic Console и запусти  ANTHROPIC_BILL=<сумма> node scripts/client-cost-report.mjs");
  console.log("");

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
