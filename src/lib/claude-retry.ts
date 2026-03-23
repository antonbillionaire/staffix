/**
 * Claude API call with automatic retry on overload (529) errors.
 * Retries up to 2 times with increasing delay between attempts.
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

export async function callClaudeWithRetry(params: MessageCreateParams, retries = 2): Promise<Message> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await getClient().messages.create(params);
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
