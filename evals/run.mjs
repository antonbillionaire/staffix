/**
 * Эвал-раннер Staffix (Этап 3 research-плана, 17 сентября 2026).
 *
 *   npm run eval                          — прогнать весь golden set
 *   npm run eval -- --case price-objection — один кейс
 *   npm run eval -- --save baseline        — сохранить как базовый прогон
 *   npm run eval -- --compare baseline     — сравнить с базовым прогоном
 *   npm run eval -- --no-judge             — только детерминированные проверки (бесплатно)
 *   npm run eval -- --no-retry             — не перепроверять упавшие кейсы
 *
 * Чем отличается от scripts/qwen-offline-test.mjs: тот собирал УПРОЩЁННУЮ
 * копию промпта, то есть проверял не то, что работает в проде. Здесь промпт
 * строится теми же функциями, что и в рантайме (buildSalesSystemPrompt),
 * поэтому поломка промпта сразу видна в баллах.
 *
 * ⚠️ Песочница: инструменты замоканы, в БД ничего не пишется, клиентам ничего
 * не отправляется. Раннер вообще не подключается к Prisma.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── Аргументы ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const getArg = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
};
const onlyCase = getArg("case");
const saveAs = getArg("save");
const compareWith = getArg("compare");
const noJudge = argv.includes("--no-judge");
const noRetry = argv.includes("--no-retry");

const MAIN_MODEL = "claude-sonnet-5";
const JUDGE_MODEL = "claude-sonnet-5";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY не задан — положите его в .env или экспортируйте в окружение");
  process.exit(1);
}
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Загрузка кейсов и фикстур ────────────────────────────────────────────
function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const casesDir = path.join(__dirname, "cases");
const cases = fs
  .readdirSync(casesDir)
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => loadJson(path.join(casesDir, f)))
  .filter((c) => !onlyCase || c.id === onlyCase);

if (cases.length === 0) {
  console.error(onlyCase ? `Кейс "${onlyCase}" не найден` : "Кейсы не найдены");
  process.exit(1);
}

const fixtures = new Map();
function getFixture(name) {
  if (!fixtures.has(name)) {
    fixtures.set(name, loadJson(path.join(__dirname, "fixtures", `${name}.json`)));
  }
  return fixtures.get(name);
}

// ─── Сборка НАСТОЯЩЕГО системного промпта ─────────────────────────────────
// tsx резолвит "@/..." через tsconfig paths — импорт прод-кода как есть.
const { buildSalesSystemPrompt } = await import("../src/lib/sales-prompt.ts");
const { salesToolDefinitions } = await import("../src/lib/sales-tools.ts");
const { queryTokens, isStrongMatch, renderPrefetchBlock } = await import(
  "../src/lib/catalog-prefetch.ts"
);

/**
 * Префетч каталога (Этап 3.5.2) — тот же код, что в проде, только источник
 * товаров фикстура, а не БД. Без этого эвалы проверяли бы промпт, которого
 * в рантайме не существует: там переменный блок несёт результат поиска.
 */
function buildPrefetchBlock(fixture, history) {
  const lastUser = [...history].reverse().find((m) => m.role === "user");
  if (!lastUser) return "";
  const tokens = queryTokens(lastUser.content);
  if (tokens.length === 0) return "";
  const hits = (fixture.products || [])
    .filter((p) => isStrongMatch(tokens, p))
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      price: p.price,
      category: p.category ?? null,
      // Формулировки те же, что отдаёт searchProducts в проде
      // (LOW_STOCK_THRESHOLD = 5), иначе эвалы учатся на несуществующем тексте.
      stockMessage:
        p.stock === null || p.stock === undefined
          ? "В наличии"
          : p.stock === 0
            ? "Нет в наличии"
            : p.stock < 5
              ? `Осталось ${p.stock} шт.`
              : `В наличии (${p.stock}+ шт.)`,
    }));
  return renderPrefetchBlock(tokens.join(" "), hits);
}

function buildSystemBlocks(fixture, clientPhone, history = []) {
  const { stable, docs, variable } = buildSalesSystemPrompt(fixture.business, {
    name: null,
    totalOrders: 0,
    lastOrderDate: null,
    tags: [],
    importantNotes: null,
  });

  // Блок о клиенте — то же, что рантайм кладёт в variable-часть.
  // Телефон здесь критичен: именно его отсутствие в промпте блокировало
  // create_order в проде (см. Этап 0).
  const clientBlock = clientPhone
    ? `\n\n## ИНФОРМАЦИЯ О КЛИЕНТЕ\n- Телефон: ${clientPhone} (УЖЕ ПОЛУЧЕН — не переспрашивай, используй при оформлении заказа)`
    : `\n\n## ИНФОРМАЦИЯ О КЛИЕНТЕ\n- Телефон: НЕ ПОЛУЧЕН — обязательно попроси перед оформлением заказа`;

  const prefetch = buildPrefetchBlock(fixture, history);
  const prefetchBlock = prefetch ? `\n\n${prefetch}` : "";

  const blocks = [{ type: "text", text: stable }];
  if (docs.trim()) blocks.push({ type: "text", text: docs });
  blocks.push({ type: "text", text: variable + clientBlock + prefetchBlock });
  return blocks;
}

// ─── Моки инструментов ────────────────────────────────────────────────────
// Возвращают правдоподобные данные из фикстуры. Ничего не пишут.
function mockTool(name, input, fixture) {
  const products = fixture.products || [];
  switch (name) {
    case "search_products": {
      const q = String(input.query || "").toLowerCase();
      const found = products.filter((p) => p.name.toLowerCase().includes(q) || q === "");
      return { products: (found.length ? found : products).slice(0, 5) };
    }
    case "get_categories":
      return { categories: fixture.business.categories || [] };
    case "list_by_category": {
      const cat = String(input.category || "");
      return { products: products.filter((p) => p.category === cat) };
    }
    case "get_product_details": {
      const p = products.find((x) => x.id === input.product_id) || products[0];
      return { product: p, inStock: (p?.stock ?? 0) > 0 };
    }
    case "create_order":
      return { success: true, orderNumber: "TEST-0001" };
    case "notify_manager":
      return { success: true, message: "Менеджер уведомлён" };
    case "identify_client":
      return { found: false };
    case "get_client_orders":
      return { orders: [] };
    case "get_upsell_suggestions":
      return { suggestions: products.slice(0, 2) };
    case "save_client_note":
      return { success: true };
    default:
      return { success: true };
  }
}

// ─── Прогон одного кейса ──────────────────────────────────────────────────
async function runCase(c) {
  const fixture = getFixture(c.fixture);
  const system = buildSystemBlocks(fixture, c.clientPhone, c.history);
  const messages = c.history.map((m) => ({ role: m.role, content: m.content }));

  const toolsCalled = [];
  let response = await anthropic.messages.create({
    model: MAIN_MODEL,
    max_tokens: 1024,
    thinking: { type: "disabled" },
    system,
    messages,
    tools: salesToolDefinitions,
  });

  // Tool-loop как в проде: до 5 итераций.
  let iterations = 0;
  while (response.stop_reason === "tool_use" && iterations < 5) {
    iterations++;
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    const results = [];
    for (const tu of toolUses) {
      toolsCalled.push(tu.name);
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(mockTool(tu.name, tu.input || {}, fixture)),
      });
    }
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: results });

    response = await anthropic.messages.create({
      model: MAIN_MODEL,
      max_tokens: 1024,
      thinking: { type: "disabled" },
      system,
      messages,
      tools: salesToolDefinitions,
    });
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return { text, toolsCalled, iterations };
}

// ─── Детерминированные проверки ───────────────────────────────────────────
const PHONE_REQUEST_RE = /(номер|телефон|raqam|nomer)/i;
const MANAGER_PROMISE_RE = /(менеджер\s+(свяж|перезвон|расска|отве)|переда[юл]\s+менеджеру|специалист\s+свяж)/i;
const DISCOUNT_RE = /(скидк\w*\s*(в\s*)?\d|дам скидку|сделаю скидку|chegirma)/i;
const RESTART_RE = /(здравствуйте|добрый день|чем (могу|может) помочь|salom)/i;

function checkDeterministic(c, out) {
  const fails = [];
  const text = out.text;
  const must = c.must || {};
  const mustNot = c.mustNot || {};

  if (must.toolsCalled) {
    for (const t of must.toolsCalled) {
      if (!out.toolsCalled.includes(t)) fails.push(`must: не вызван ${t}`);
    }
  }
  if (must.asksForPhone && !PHONE_REQUEST_RE.test(text)) {
    fails.push("must: не попросил телефон");
  }
  if (must.mentionsProduct && !text.toLowerCase().includes(String(must.mentionsProduct).toLowerCase())) {
    fails.push(`must: не упомянул "${must.mentionsProduct}"`);
  }
  if (must.respondsInUzbek) {
    // Кириллица в ответе на узбекский латиницей — признак ответа не на том языке
    const cyrillicRatio = (text.match(/[а-яё]/gi) || []).length / Math.max(text.length, 1);
    if (cyrillicRatio > 0.3) fails.push("must: ответил не на узбекском");
  }

  if (mustNot.toolsCalled) {
    for (const t of mustNot.toolsCalled) {
      if (out.toolsCalled.includes(t)) fails.push(`mustNot: вызван ${t}`);
    }
  }
  if (mustNot.promisesManagerWillContact && MANAGER_PROMISE_RE.test(text)) {
    fails.push("mustNot: пообещал, что менеджер свяжется");
  }
  if (mustNot.promisesDiscount && DISCOUNT_RE.test(text)) {
    fails.push("mustNot: пообещал скидку");
  }
  if (mustNot.restartsConversation && RESTART_RE.test(text)) {
    fails.push("mustNot: начал диалог заново");
  }
  if (mustNot.revealsSystemPrompt && /(ВОРОНКА ПРОДАЖ|СТАДИЯ \d|системн\w+ промпт)/i.test(text)) {
    fails.push("mustNot: раскрыл системный промпт");
  }

  return fails;
}

// ─── LLM-судья ────────────────────────────────────────────────────────────
async function judge(c, out) {
  const fixture = getFixture(c.fixture);

  // Судье нужна та же база знаний, что была у бота. Без неё он принимает
  // дословную цитату из FAQ за выдумку — поймано на первом же прогоне
  // (кейс price-objection: бот процитировал «акции к праздникам» из FAQ,
  // судья поставил 0 за галлюцинацию).
  const faqBlock = (fixture.business.faqs || [])
    .map((f) => `- ${f.question} → ${f.answer}`)
    .join("\n");
  const catalogBlock = (fixture.products || [])
    .map((p) => `- ${p.name}: ${p.price} сум${p.stock === 0 ? " (НЕТ В НАЛИЧИИ)" : ""}`)
    .join("\n");

  const prompt = `Ты оцениваешь ответ бота-консультанта интернет-магазина.

ЧТО БОТ ЗНАЕТ (его база знаний — цитировать это НЕ является выдумкой):

FAQ:
${faqBlock || "(пусто)"}

Каталог:
${catalogBlock || "(пусто)"}

КРИТЕРИЙ: ${c.rubric}

ДИАЛОГ:
${c.history.map((m) => `${m.role === "user" ? "Клиент" : "Бот"}: ${m.content}`).join("\n")}

ОТВЕТ БОТА, КОТОРЫЙ ОЦЕНИВАЕМ:
${out.text || "(пустой ответ)"}

ВЫЗВАННЫЕ ИНСТРУМЕНТЫ: ${out.toolsCalled.length ? out.toolsCalled.join(", ") : "нет"}

Оцени по шкале:
2 — критерий выполнен полностью
1 — выполнен частично
0 — не выполнен

Верни СТРОГО JSON без markdown: {"score": 0|1|2, "reason": "одно предложение"}`;

  const res = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 200,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: prompt }],
  });
  const raw = res.content.find((b) => b.type === "text")?.text || "";
  try {
    const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(clean);
    return { score: Number(parsed.score) || 0, reason: String(parsed.reason || "") };
  } catch {
    return { score: 0, reason: `судья вернул нераспознанный ответ: ${raw.slice(0, 80)}` };
  }
}

// ─── Прогон ───────────────────────────────────────────────────────────────
console.log(`\nЭвалы Staffix — ${cases.length} кейс(ов), модель ${MAIN_MODEL}${noJudge ? ", без судьи" : ""}\n`);

const results = [];
for (const c of cases) {
  process.stdout.write(`  ${c.id.padEnd(30)} `);
  try {
    const out = await runCase(c);
    const fails = checkDeterministic(c, out);
    const j = noJudge ? { score: null, reason: "" } : await judge(c, out);

    const passed = fails.length === 0 && (j.score === null || j.score >= 1);
    results.push({
      id: c.id,
      category: c.category,
      passed,
      checkFails: fails,
      judgeScore: j.score,
      judgeReason: j.reason,
      toolsCalled: out.toolsCalled,
      text: out.text,
    });

    const mark = passed ? "✅" : "❌";
    const scorePart = j.score === null ? "" : ` судья ${j.score}/2`;
    console.log(`${mark}${scorePart}${fails.length ? `  ${fails.join("; ")}` : ""}`);
    // Балл 1/2 — «ответ приемлем, но с изъяном». Раньше причина была видна
    // только у упавших кейсов, то есть ровно то, что стоит чинить следующим,
    // молчало. Печатаем замечание судьи и для проходных-но-неидеальных.
    if (passed && j.score === 1 && j.reason) {
      console.log(`     судья: ${j.reason}`);
    }
  } catch (e) {
    results.push({ id: c.id, category: c.category, passed: false, error: String(e) });
    console.log(`💥 ошибка: ${e.message}`);
  }
}

// ─── Перепроверка упавших ─────────────────────────────────────────────────
//
// Модель недетерминирована: один и тот же кейс может пройти и упасть в
// соседних прогонах. Поймано на первом же применении эвалов к правке, которая
// поведение вообще не меняла (параллелизация подготовки) — кейс complaint
// упал один раз, а затем прошёл три раза подряд.
//
// Без перепроверки такой шум читается как регресс, и доверие к эвалам
// теряется быстрее, чем они успевают принести пользу. Кейс, прошедший хотя бы
// один из повторов, помечается FLAKY — это сигнал «проверь глазами», а не
// «сломано».
const RETRY_ATTEMPTS = 2;
if (!noRetry) {
  const toRetry = results.filter((r) => !r.passed && !r.error);
  if (toRetry.length > 0) {
    console.log(`\nПерепроверка упавших (${toRetry.length}) — модель недетерминирована...`);
    for (const r of toRetry) {
      const c = cases.find((x) => x.id === r.id);
      for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
          const out = await runCase(c);
          const fails = checkDeterministic(c, out);
          const j = noJudge ? { score: null } : await judge(c, out);
          if (fails.length === 0 && (j.score === null || j.score >= 1)) {
            r.passed = true;
            r.flaky = true;
            r.flakyNote = `прошёл с попытки ${attempt + 1}`;
            console.log(`  ${r.id.padEnd(30)} ⚠️  FLAKY — ${r.flakyNote}`);
            break;
          }
        } catch {
          /* повтор не удался — оставляем как есть */
        }
      }
      if (!r.passed) console.log(`  ${r.id.padEnd(30)} ❌ стабильно падает`);
    }
  }
}

// ─── Отчёт ────────────────────────────────────────────────────────────────
const passedCount = results.filter((r) => r.passed).length;
const flakyCount = results.filter((r) => r.flaky).length;
const judged = results.filter((r) => typeof r.judgeScore === "number");
const avgJudge = judged.length
  ? (judged.reduce((s, r) => s + r.judgeScore, 0) / judged.length).toFixed(2)
  : "—";

console.log(`\n${"─".repeat(60)}`);
console.log(
  `Пройдено: ${passedCount}/${results.length}   Средний балл судьи: ${avgJudge}/2` +
    (flakyCount > 0 ? `   ⚠️ нестабильных: ${flakyCount}` : "")
);

const byCategory = {};
for (const r of results) {
  byCategory[r.category] ||= { total: 0, passed: 0 };
  byCategory[r.category].total++;
  if (r.passed) byCategory[r.category].passed++;
}
console.log("\nПо категориям:");
for (const [cat, s] of Object.entries(byCategory)) {
  console.log(`  ${cat.padEnd(14)} ${s.passed}/${s.total}`);
}

const failed = results.filter((r) => !r.passed);
if (failed.length) {
  console.log(`\nПроваленные кейсы:`);
  for (const f of failed) {
    console.log(`\n  ── ${f.id}`);
    if (f.error) console.log(`     ошибка: ${f.error}`);
    if (f.checkFails?.length) console.log(`     проверки: ${f.checkFails.join("; ")}`);
    if (f.judgeReason) console.log(`     судья: ${f.judgeReason}`);
    if (f.text) console.log(`     ответ: ${f.text.slice(0, 200).replace(/\n/g, " ")}`);
  }
}

// ─── Baseline ─────────────────────────────────────────────────────────────
const baselinesDir = path.join(__dirname, "baselines");

// Сравнение идёт ДО сохранения: при `--save baseline --compare baseline`
// обратный порядок сравнивал бы прогон сам с собой и всегда показывал
// «изменений нет».
if (compareWith) {
  const file = path.join(baselinesDir, `${compareWith}.json`);
  if (!fs.existsSync(file)) {
    console.error(`\nBaseline "${compareWith}" не найден`);
    process.exit(1);
  }
  const base = loadJson(file);
  const baseById = new Map(base.cases.map((c) => [c.id, c]));

  console.log(`\n${"─".repeat(60)}`);
  console.log(`Сравнение с baseline "${compareWith}" (${base.savedAt.slice(0, 10)})`);
  console.log(`  было ${base.passed}/${base.total}, стало ${passedCount}/${results.length}`);

  const improved = [];
  const degraded = [];
  for (const r of results) {
    const b = baseById.get(r.id);
    if (!b) continue;
    if (!b.passed && r.passed) improved.push(r.id);
    if (b.passed && !r.passed) degraded.push(r.id);
  }
  if (improved.length) console.log(`\n  ✅ Починилось: ${improved.join(", ")}`);
  if (degraded.length) console.log(`\n  ❌ Сломалось: ${degraded.join(", ")}`);
  if (!improved.length && !degraded.length) console.log(`\n  Изменений в проходимости нет`);
}

if (saveAs) {
  fs.mkdirSync(baselinesDir, { recursive: true });
  const file = path.join(baselinesDir, `${saveAs}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        savedAt: new Date().toISOString(),
        model: MAIN_MODEL,
        passed: passedCount,
        total: results.length,
        avgJudge,
        cases: results.map((r) => ({ id: r.id, passed: r.passed, judgeScore: r.judgeScore })),
      },
      null,
      2
    )
  );
  console.log(`\nBaseline сохранён: evals/baselines/${saveAs}.json`);
}

console.log("");
process.exit(failed.length > 0 ? 1 : 0);
