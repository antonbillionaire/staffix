/**
 * Единственная точка создания клиента Anthropic (4 октября 2026).
 *
 * ЗАЧЕМ. Платформа остановлена, но счёт за Claude продолжал приходить два дня.
 * Виноват был прогрев кэша, который не смотрел на выключатель бота. Проблема
 * глубже одного крона: вызовы Anthropic разбросаны по дюжине файлов, каждый
 * создаёт клиента сам, и «мы всё выключили» приходилось доказывать обходом
 * всех мест по очереди. Один пропущенный — и деньги снова тратятся.
 *
 * Теперь создать клиента можно только здесь, и здесь же стоит выключатель.
 * Проверить, что обойти нельзя, можно одной командой:
 *
 *     grep -rn "new Anthropic(" src/        # должен находить только этот файл
 *
 * ВЫКЛЮЧЕНО ПО УМОЛЧАНИЮ. Пока платформа на паузе, безопасный режим — молчать:
 * забытая переменная окружения не должна возвращать расходы. Чтобы включить
 * AI обратно, выставьте в Vercel:
 *
 *     STAFFIX_AI_ENABLED=1
 *
 * Любое другое значение или отсутствие переменной = AI выключен, вызовы в
 * Anthropic не уходят вообще.
 */

import Anthropic from "@anthropic-ai/sdk";

export class AiDisabledError extends Error {
  constructor() {
    super("AI отключён: переменная STAFFIX_AI_ENABLED не выставлена в 1");
    this.name = "AiDisabledError";
  }
}

/** True, если вызовы к Anthropic разрешены. */
export function isAiEnabled(): boolean {
  return process.env.STAFFIX_AI_ENABLED === "1";
}

/**
 * Создаёт клиента Anthropic. Бросает `AiDisabledError`, если AI выключен —
 * ни один сетевой запрос при этом не уходит, то есть не тратится ничего.
 *
 * Вызывающие коды бота ловят ошибки и отвечают фолбэком или молчат; для них
 * это неотличимо от недоступного API.
 */
export function createAnthropic(apiKey?: string): Anthropic {
  if (!isAiEnabled()) {
    throw new AiDisabledError();
  }
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY не задан");
  }
  return new Anthropic({ apiKey: key });
}
