/**
 * Complexity classifier для гибридной маршрутизации Sonnet ↔ Haiku (июль 2026).
 *
 * Мотивация: главный вызов Sonnet 5 стоит ~$0.008 за оборот на Right Flight
 * (30K prefix + 300 output). Haiku 4.5 — $0.003 за то же самое, в 2.5× дешевле,
 * и справляется с FAQ/списками/фактами. Но на возражениях, жалобах и торге
 * Haiku слабее — Sonnet держит тон лучше.
 *
 * Решение: перед основным вызовом мини-классификатор на Haiku (~$0.0005)
 * решает SIMPLE (→ Haiku 4.5 для ответа) vs COMPLEX (→ Sonnet 5). На неясностях
 * лежим в COMPLEX — качество приоритет.
 *
 * A/B feature flag:
 *   AI_HYBRID_BUSINESS_IDS = "cmojxzwg30001js04vl5fg4oj,..."  (Vercel env var,
 *   comma-separated). Если businessId в списке — классификатор работает и
 *   часть запросов уходит на Haiku. Иначе — всё как раньше (Sonnet 5).
 *
 * Логируем модель на каждое сообщение — потом можно сравнить качество и
 * долю жалоб на бота между «hybrid» и «Sonnet-only» бизнесами.
 */

import { callClaudeWithRetry } from "@/lib/claude-retry";

export type MessageComplexity = "simple" | "complex";
export type MainModelChoice =
  | "claude-sonnet-5"
  | "claude-haiku-4-5-20251001";

const CLASSIFIER_TIMEOUT_MS = 6000;

/**
 * Классифицирует сообщение клиента одним словом.
 * SAFE-DEFAULT: при любой ошибке / таймауте возвращает "complex" (→ Sonnet).
 * То есть если что-то ломается — деградируем в качество, не в цену.
 */
export async function classifyMessageComplexity(
  userMessage: string
): Promise<MessageComplexity> {
  if (!userMessage || userMessage.trim().length === 0) return "complex";

  // Мгновенные эвристики без вызова Haiku — экономим лишний roundtrip.
  const trimmed = userMessage.trim().toLowerCase();

  // Очень длинное сообщение (>500 chars) — почти всегда сложное (возражение,
  // жалоба, детальный запрос). Пропускаем классификатор.
  if (trimmed.length > 500) return "complex";

  // Явные красные флаги эмоций / претензий — сразу complex
  const complexPatterns = [
    /\bне\s+нрав\b/i, /обман\w*/i, /жалоб\w*/i, /возврат/i,
    /разочаров\w*/i, /дорог\w*/i, /скидк\w*/i, /дешевл\w*/i,
    /обиж\w*/i, /плох\w*/i, /ужас\w*/i,
  ];
  if (complexPatterns.some((r) => r.test(trimmed))) return "complex";

  // Короткие приветствия / очевидные вопросы — сразу simple без Haiku
  const simplePatterns = [
    /^(привет|здрав|салам|hi|hello|assalam)/i,
    /^(добр\w*\s+день|добр\w*\s+утр|добр\w*\s+вечер|good\s+morning)/i,
    /^(спасибо|thanks|ok|ок|хорошо|давайте|поехали)$/i,
  ];
  if (simplePatterns.some((r) => r.test(trimmed))) return "simple";

  // Средние по длине — зовём Haiku классификатор.
  const prompt = `Классифицируй сообщение клиента бизнеса одним словом:
- SIMPLE — простой фактический вопрос (цена, адрес, часы, "какие туры есть", "что у вас"), приветствие, короткое подтверждение
- COMPLEX — возражение, жалоба, торг, эмоциональный запрос, сложный многошаговый выбор, вопрос требующий совета

При сомнениях — COMPLEX.

Сообщение: "${userMessage.substring(0, 300)}"

Ответ (одно слово SIMPLE или COMPLEX):`;

  try {
    const response = await Promise.race([
      callClaudeWithRetry({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 5,
        system: "Ты — классификатор сложности сообщений. Отвечаешь одним словом.",
        messages: [{ role: "user" as const, content: prompt }],
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("classifier timeout")), CLASSIFIER_TIMEOUT_MS)
      ),
    ]);

    const textBlock = response.content.find((c) => c.type === "text");
    const answer = textBlock && "text" in textBlock ? textBlock.text.trim().toLowerCase() : "";
    if (answer.startsWith("simple")) return "simple";
    return "complex";
  } catch (e) {
    console.warn(
      "[complexity-classifier] failed, defaulting to complex:",
      e instanceof Error ? e.message : String(e)
    );
    return "complex";
  }
}

/**
 * Читает AI_HYBRID_BUSINESS_IDS из env и говорит, включён ли hybrid routing
 * для конкретного бизнеса. Если env не задан — hybrid off глобально.
 */
export function isHybridEnabledForBusiness(businessId: string): boolean {
  const ids = process.env.AI_HYBRID_BUSINESS_IDS;
  if (!ids) return false;
  const list = ids.split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(businessId);
}

/**
 * Главный решатель: какую модель использовать на основной ответ клиенту.
 * По умолчанию Sonnet 5 (текущее поведение). Только если hybrid включён
 * для этого бизнеса И классификатор сказал SIMPLE — используем Haiku.
 *
 * Никогда не бросает — на любую ошибку падает в Sonnet 5 (safe default).
 */
export async function pickMainModel(
  businessId: string,
  userMessage: string
): Promise<{ model: MainModelChoice; complexity: MessageComplexity | "off" }> {
  if (!isHybridEnabledForBusiness(businessId)) {
    return { model: "claude-sonnet-5", complexity: "off" };
  }
  const complexity = await classifyMessageComplexity(userMessage);
  const model: MainModelChoice =
    complexity === "simple" ? "claude-haiku-4-5-20251001" : "claude-sonnet-5";
  return { model, complexity };
}
