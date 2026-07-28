// ============================================================================
// qwen-offline-test.mjs — Этап 1b плана миграции на Qwen 3-Max
// ============================================================================
//
// ЗАДАЧА: вытянуть 20-30 РЕАЛЬНЫХ диалогов из production-БД, для каждого
// сгенерировать пару ответов (Claude Haiku 4.5 baseline vs Qwen 3-Max),
// сохранить в JSON для ручного QA (Этап 4 плана).
//
// БЕЗОПАСНОСТЬ:
//   - Скрипт ЧИТАЕТ prod-БД, ничего не пишет обратно
//   - Реальные ответы клиентам НЕ отправляются (это офлайн-прогон)
//   - Телефоны/email в тексте маскируются перед логированием
//   - Результаты сохраняются локально в scratchpad, не публично
//
// ЗАПУСК (из корня staffix):
//   node scripts/qwen-offline-test.mjs
//
// В .env нужны:
//   DATABASE_URL       — Railway prod (для чтения диалогов)
//   ANTHROPIC_API_KEY  — для baseline Haiku
//   QWEN_API_KEY       — от Alibaba Cloud Model Studio (Singapore region)
//   QWEN_BASE_URL      — dedicated workspace endpoint (compatible-mode/v1)
//
// РЕЗУЛЬТАТ: качается в scripts/qwen-offline-test-results-<timestamp>.json

import { PrismaClient } from "@prisma/client";
import Anthropic from "@anthropic-ai/sdk";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const prisma = new PrismaClient();

// --- Конфиг -----------------------------------------------------------------
const SAMPLE_SIZE = 25;
const HAIKU_MODEL = "claude-haiku-4-5-20251001";
const QWEN_MODEL = process.env.QWEN_MODEL || "qwen3-max";
const QWEN_BASE = process.env.QWEN_BASE_URL || "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const QWEN_KEY = process.env.QWEN_API_KEY;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// --- Human-tone + funnel компактно (для честного сравнения одним промптом) --
// Полные модули лежат в src/lib/prompts/, здесь их урезанная сводка чтобы
// скрипт не тянул TypeScript. Для реального прод-теста ничего не меняется —
// прод использует полные версии через buildSystemPrompt.
const COMPACT_SYSTEM_TEMPLATE = (bizName, aiTone) => `Ты — сотрудник компании "${bizName}", отвечаешь клиенту в мессенджере.

## РАЗГОВОР КАК ЖИВОЙ ЧЕЛОВЕК
- На «Вы», без сленга и панибратства. Первое приветствие только «Здравствуйте», не «Привет».
- Мостики в ответах: «Хорошо», «Понял Вас», «Отлично», «Кстати».
- Реакция на эмоции: волнуется → «Понимаю, разберёмся»; недоволен → «Извините за неудобства».
- Запрещённые роботизмы: «Согласно системе», «Данная услуга», «Уточняющий вопрос:», «Прошу предоставить».
- 1-3 коротких предложения на ответ. Максимум 1 вопрос в сообщении.
- Никаких «Вы там?», «Ку-ку», «Обращайтесь если что». Только конкретные тёплые фразы.

## ВОРОНКА ПРОДАЖ (жёсткая логика)
- Стадия 1 — приветствие: 1 открытый вопрос, не сыпать прайсом.
- Стадия 2 — выяснение потребности: 1 уточнение, не 3 сразу.
- Стадия 3 — предложение: сначала ценность и польза, потом цена. Не начинай с цифры.
- Стадия 4 — возражения: «дорого» → сравни с результатом; «подумаю» → предложи резерв.
- Стадия 5 — закрытие: активное «Записать Вас на X?», не «когда решите, напишите».
- Стадия 6 — контакт: телефон обязателен ДО эскалации, «менеджер свяжется» без номера = ложь.
- Стадия 7 — закрепление: проговори детали + один раз можно допродажу.

## ТРИГГЕРЫ ЭСКАЛАЦИИ
Юр/мед/фин вопросы, жалоба, «хочу человека», 3 неудачные попытки — эскалация к менеджеру.
Ложная эскалация («передал менеджеру» без реального вызова) запрещена.

Тон общения: ${aiTone || "friendly"}.
Отвечай на русском языке.`;

// --- Утилиты ---------------------------------------------------------------
function maskPII(text) {
  return text
    .replace(/\+?[78]\s?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g, "+7XXX-XXX-XXXX")
    .replace(/[\w.+-]+@[\w-]+\.[\w-]+/g, "xxx@xxx.com");
}

function maskName(name) {
  if (!name || name.length < 2) return name;
  return name[0] + "*".repeat(Math.max(1, name.length - 1));
}

// --- Сбор реальных диалогов ------------------------------------------------
async function fetchConversationsForTest() {
  const cutoff = new Date(Date.now() - 30 * 86_400_000); // последние 30 дней

  // Берём разные каналы вперемешку для разнообразия сценариев
  const tgConvs = await prisma.conversation.findMany({
    where: {
      updatedAt: { gte: cutoff },
      messages: { some: {} },
    },
    include: {
      business: {
        select: { id: true, name: true, aiTone: true, businessType: true, dashboardMode: true },
      },
      messages: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
    take: Math.floor(SAMPLE_SIZE / 2),
  });

  const chConvs = await prisma.channelConversation.findMany({
    where: {
      updatedAt: { gte: cutoff },
      messageCount: { gt: 1 },
    },
    include: {
      business: {
        select: { id: true, name: true, aiTone: true, businessType: true, dashboardMode: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: SAMPLE_SIZE - Math.floor(SAMPLE_SIZE / 2),
  });

  const cases = [];

  for (const c of tgConvs) {
    // Берём последние 6-8 сообщений, обязательно чтобы последнее было от USER
    let msgs = c.messages.slice(-8).map((m) => ({
      role: m.role,
      content: maskPII(m.content),
    }));
    // Обрезаем чтобы последнее было "user"
    while (msgs.length > 0 && msgs[msgs.length - 1].role !== "user") msgs.pop();
    if (msgs.length === 0) continue;

    cases.push({
      id: `tg-${c.id.slice(0, 8)}`,
      channel: "telegram",
      businessName: c.business.name,
      businessTone: c.business.aiTone,
      businessType: c.business.businessType,
      dashboardMode: c.business.dashboardMode,
      clientName: maskName(c.clientName),
      messages: msgs,
    });
  }

  for (const c of chConvs) {
    const history = Array.isArray(c.history) ? c.history : [];
    let msgs = history.slice(-8).map((m) => ({
      role: m.role,
      content: maskPII(m.content || ""),
    })).filter((m) => (m.role === "user" || m.role === "assistant") && m.content);
    while (msgs.length > 0 && msgs[msgs.length - 1].role !== "user") msgs.pop();
    if (msgs.length === 0) continue;

    cases.push({
      id: `${c.channel}-${c.id.slice(0, 8)}`,
      channel: c.channel,
      businessName: c.business.name,
      businessTone: c.business.aiTone,
      businessType: c.business.businessType,
      dashboardMode: c.business.dashboardMode,
      clientName: maskName(c.clientName),
      messages: msgs,
    });
  }

  return cases;
}

// --- Вызов LLM -------------------------------------------------------------
async function callHaiku(system, messages) {
  const t0 = Date.now();
  try {
    const resp = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 400,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = resp.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return {
      text,
      latencyMs: Date.now() - t0,
      inputTokens: resp.usage?.input_tokens ?? null,
      outputTokens: resp.usage?.output_tokens ?? null,
    };
  } catch (e) {
    return { error: e.message, latencyMs: Date.now() - t0 };
  }
}

async function callQwen(system, messages) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${QWEN_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${QWEN_KEY}`,
      },
      body: JSON.stringify({
        model: QWEN_MODEL,
        max_tokens: 400,
        messages: [
          { role: "system", content: system },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error?.message || `HTTP ${res.status}`, latencyMs: Date.now() - t0 };
    }
    return {
      text: data.choices?.[0]?.message?.content?.trim() ?? "",
      latencyMs: Date.now() - t0,
      inputTokens: data.usage?.prompt_tokens ?? null,
      outputTokens: data.usage?.completion_tokens ?? null,
    };
  } catch (e) {
    return { error: e.message, latencyMs: Date.now() - t0 };
  }
}

// --- Main ------------------------------------------------------------------
async function main() {
  console.log(`[qwen-offline-test] Fetching up to ${SAMPLE_SIZE} real dialogs from prod DB...`);
  const cases = await fetchConversationsForTest();
  console.log(`[qwen-offline-test] Got ${cases.length} usable cases`);

  if (cases.length === 0) {
    console.error("No cases fetched — check DB has recent conversations");
    process.exit(1);
  }

  const results = [];
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const system = COMPACT_SYSTEM_TEMPLATE(c.businessName, c.businessTone);
    process.stdout.write(`  [${i + 1}/${cases.length}] ${c.id} (${c.businessName}) ... `);

    const [haiku, qwenResp] = await Promise.all([
      callHaiku(system, c.messages),
      callQwen(system, c.messages),
    ]);

    results.push({
      ...c,
      haiku,
      qwen: qwenResp,
    });

    const hLat = haiku.latencyMs || 0;
    const qLat = qwenResp.latencyMs || 0;
    console.log(`Haiku ${hLat}ms / Qwen ${qLat}ms`);
  }

  // Сводная статистика
  const haikuOk = results.filter((r) => !r.haiku.error).length;
  const qwenOk = results.filter((r) => !r.qwen.error).length;
  const haikuAvgLat = Math.round(
    results.filter((r) => !r.haiku.error).reduce((s, r) => s + r.haiku.latencyMs, 0) / haikuOk
  );
  const qwenAvgLat = Math.round(
    results.filter((r) => !r.qwen.error).reduce((s, r) => s + r.qwen.latencyMs, 0) / qwenOk
  );

  console.log("\n=== СВОДКА ===");
  console.log(`Всего диалогов: ${cases.length}`);
  console.log(`Haiku успешных: ${haikuOk}, avg latency: ${haikuAvgLat}ms`);
  console.log(`Qwen успешных: ${qwenOk}, avg latency: ${qwenAvgLat}ms`);

  const outPath = join(
    "scripts",
    `qwen-offline-test-results-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    qwenModel: QWEN_MODEL,
    haikuModel: HAIKU_MODEL,
    stats: {
      total: cases.length,
      haikuOk, qwenOk,
      haikuAvgLatMs: haikuAvgLat,
      qwenAvgLatMs: qwenAvgLat,
    },
    cases: results,
  }, null, 2));

  console.log(`\nРезультаты сохранены: ${outPath}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
