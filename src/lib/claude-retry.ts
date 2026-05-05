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
 * Если system — строка, оборачиваем в массив с одним блоком и cache_control.
 * Если массив — добавляем cache_control к последнему text-блоку.
 * Если меньше CACHE_MIN_CHARS — возвращаем как есть (caching не сэкономит).
 */
function withPromptCaching(params: MessageCreateParams): MessageCreateParams {
  const sys = params.system;
  if (!sys) return params;

  if (typeof sys === "string") {
    if (sys.length < CACHE_MIN_CHARS) return params;
    return {
      ...params,
      system: [{ type: "text", text: sys, cache_control: { type: "ephemeral" } }],
    };
  }

  if (Array.isArray(sys) && sys.length > 0) {
    // Считаем суммарную длину текстовых блоков
    const totalLen = sys.reduce(
      (sum, b) => sum + (b.type === "text" ? b.text.length : 0),
      0
    );
    if (totalLen < CACHE_MIN_CHARS) return params;
    // Если уже есть cache_control где-то — не трогаем (вызывающий знает что делает)
    if (sys.some((b) => "cache_control" in b && b.cache_control)) return params;
    // Добавляем cache_control к последнему блоку (стандартная практика — кешируем хвост стабильного префикса)
    const lastIdx = sys.length - 1;
    const lastBlock = sys[lastIdx];
    if (lastBlock.type !== "text") return params;
    const newSystem = [...sys];
    newSystem[lastIdx] = {
      ...lastBlock,
      cache_control: { type: "ephemeral" },
    };
    return { ...params, system: newSystem };
  }

  return params;
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
