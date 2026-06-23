/**
 * Claude API call with automatic retry on overload (529) errors AND prompt caching.
 *
 * Prompt caching: системные промпты Staffix больших размеров (5-10 КБ — база знаний,
 * tools description, FAQ). Без caching каждый запрос пересылает их заново.
 * С caching Anthropic кэширует префикс на 5 минут и читает его в 10× дешевле
 * на повторных вызовах того же бизнеса.
 *
 * Включается автоматически: если params.system — строка длиннее 4096 символов
 * (Anthropic минимум для caching) ИЛИ массив, мы оборачиваем последний text-блок
 * в `cache_control: { type: "ephemeral" }`. Это режет ~50-80% Anthropic-расходов
 * при росте до 50+ активных бизнесов.
 *
 * Retry: до 2 попыток с растущей задержкой при 529/429 (overload/rate limit).
 */

import Anthropic from "@anthropic-ai/sdk";

type MessageCreateParams = Anthropic.MessageCreateParamsNonStreaming;
type Message = Anthropic.Message;

// Lazy init to avoid constructor issues in test mocks
let _anthropic: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// Anthropic минимум для caching — 1024 токена ≈ 4096 символов на лат, чуть меньше на кириллице.
// Берём 4096 символов — гарантированно достаточно.
const CACHE_MIN_CHARS = 4096;

/**
 * Применяет cache_control к последнему text-блоку system-параметра.
 *
 * TTL: используем '1h' вместо дефолтного '5m'. Запись 1h-кэша дороже в 2×,
 * но read цена та же. Break-even: 1h окупается уже при ≥8 чтениях кэша на одну
 * запись. В нашем сценарии (бизнес обслуживает разные диалоги в течение дня)
 * 5m TTL почти всегда истекает между сообщениями одного клиента — каждое его
 * сообщение становится новым cache_create. С 1h TTL префикс держится на всю
 * рабочую сессию клиента и переиспользуется десятки раз.
 *
 * Сценарии:
 * - Если system — строка длиной ≥ CACHE_MIN_CHARS, оборачиваем в один блок
 *   с cache_control + ttl:'1h'.
 * - Если массив — НЕ трогаем (вызывающий контролирует cache_control сам;
 *   это путь split-prompt для buildSystemPrompt/buildSalesSystemPrompt,
 *   где префикс отдельным блоком 1h, клиентский хвост — 5m).
 * - Если меньше CACHE_MIN_CHARS — без изменений (caching не сэкономит).
 */
function withPromptCaching(params: MessageCreateParams): MessageCreateParams {
  const sys = params.system;
  if (!sys) return params;

  if (typeof sys === "string") {
    if (sys.length < CACHE_MIN_CHARS) return params;
    return {
      ...params,
      system: [{ type: "text", text: sys, cache_control: { type: "ephemeral", ttl: "1h" } }],
    };
  }

  if (Array.isArray(sys) && sys.length > 0) {
    // Считаем суммарную длину текстовых блоков
    const totalLen = sys.reduce(
      (sum, b) => sum + (b.type === "text" ? b.text.length : 0),
      0
    );
    if (totalLen < CACHE_MIN_CHARS) return params;
    // Если вызывающий уже расставил cache_control — не трогаем (split-prompt путь)
    if (sys.some((b) => "cache_control" in b && b.cache_control)) return params;
    // Иначе автоматически кэшируем последний text-блок с часовым TTL
    const lastIdx = sys.length - 1;
    const lastBlock = sys[lastIdx];
    if (lastBlock.type !== "text") return params;
    const newSystem = [...sys];
    newSystem[lastIdx] = {
      ...lastBlock,
      cache_control: { type: "ephemeral", ttl: "1h" },
    };
    return { ...params, system: newSystem };
  }

  return params;
}

/**
 * Логирует использование токенов в одну строку для Vercel logs.
 * Цель — измерять реальный cache hit rate и находить дорогих клиентов:
 *
 *   [Claude usage] tg/main biz=biz_abc client=12345 in=320 cache_read=8400 cache_create=0 out=180 hit=96%
 *
 * Anthropic ценник (Sonnet 4.5, на момент 2026-06):
 *   - input_tokens         — $3/Mtok (uncached, обычная цена)
 *   - cache_read_*         — $0.30/Mtok (90% скидка)
 *   - cache_creation_*     — $3.75/Mtok (25% markup на запись)
 *   - output_tokens        — $15/Mtok
 *
 * hit% = cache_read / (input + cache_read + cache_create). Высокий hit% →
 * экономия в 10× на префиксе. Низкий → префикс нестабилен или TTL (5 мин)
 * истекает между сообщениями (клиент пишет редко).
 */
export function logClaudeUsage(
  label: string,
  usage: Message["usage"],
  extra?: Record<string, string | number | bigint | undefined>
): void {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheCreate = usage.cache_creation_input_tokens ?? 0;
  const inputUncached = usage.input_tokens ?? 0;
  const out = usage.output_tokens ?? 0;
  const totalInput = inputUncached + cacheRead + cacheCreate;
  const hitPct = totalInput > 0 ? Math.round((cacheRead / totalInput) * 100) : 0;
  const extraStr = extra
    ? " " + Object.entries(extra)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ")
    : "";
  console.log(
    `[Claude usage] ${label} in=${inputUncached} cache_read=${cacheRead} cache_create=${cacheCreate} out=${out} hit=${hitPct}%${extraStr}`
  );
}

export async function callClaudeWithRetry(params: MessageCreateParams, retries = 2): Promise<Message> {
  const cachedParams = withPromptCaching(params);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await getClient().messages.create(cachedParams);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isOverloaded = msg.includes("overloaded") || msg.includes("529");
      const isRateLimit = msg.includes("rate_limit") || msg.includes("429");

      if ((isOverloaded || isRateLimit) && attempt < retries) {
        const delay = (attempt + 1) * 2000; // 2s, 4s
        console.warn(`[Claude] ${isOverloaded ? "Overloaded" : "Rate limited"} (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay / 1000}s...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Retry exhausted");
}
