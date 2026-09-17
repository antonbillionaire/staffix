/**
 * Цены Anthropic API — единственное место в коде, где они заданы.
 *
 * ⚠️ НЕ ПРАВИТЬ ПО ПАМЯТИ. Только с официального прайса Anthropic
 * (в Claude Code его отдаёт skill `claude-api`). При обновлении —
 * менять дату в CHECKED_AT ниже.
 *
 * Проверено: 17 сентября 2026 через skill `claude-api`.
 *   Claude Sonnet 5   (claude-sonnet-5)          — $2.00 input / $10.00 output за 1M
 *   Claude Haiku 4.5  (claude-haiku-4-5-20251001) — $1.00 input / $5.00 output за 1M
 *
 * Ставки кэша выводятся из base input по множителям Anthropic:
 *   cache read      = 0.1× input   (чтение из кэша)
 *   cache write 5m  = 1.25× input  (запись с TTL 5 минут)
 *   cache write 1h  = 2× input     (запись с TTL 1 час)
 *
 * Мы используем 1h TTL для stable-блока и 5m для docs/variable
 * (см. cache-strategy.ts), поэтому в расчёте нужны обе ставки записи.
 * Отличить их по данным usage нельзя — Anthropic отдаёт один счётчик
 * cache_creation_input_tokens. Считаем по 1h: stable-блок самый крупный,
 * даёт основную часть записи, так что ошибка в меньшую сторону невелика.
 */

export const PRICING_CHECKED_AT = "2026-09-17";

interface ModelPrice {
  /** $ за 1M входных токенов (не из кэша) */
  input: number;
  /** $ за 1M выходных токенов */
  output: number;
  /** $ за 1M токенов, прочитанных из кэша */
  cacheRead: number;
  /** $ за 1M токенов, записанных в кэш с TTL 1 час */
  cacheWrite1h: number;
  /** $ за 1M токенов, записанных в кэш с TTL 5 минут */
  cacheWrite5m: number;
}

/** Собирает полный прайс модели из базовых input/output по множителям Anthropic. */
function priceFrom(input: number, output: number): ModelPrice {
  return {
    input,
    output,
    cacheRead: input * 0.1,
    cacheWrite1h: input * 2,
    cacheWrite5m: input * 1.25,
  };
}

/**
 * Ключи — точные model id, которые мы передаём в Anthropic SDK.
 * Если модель не найдена, costUsd не считается (см. estimateCostUsd).
 */
export const MODEL_PRICING: Record<string, ModelPrice> = {
  "claude-sonnet-5": priceFrom(2.0, 10.0),
  "claude-haiku-4-5-20251001": priceFrom(1.0, 5.0),
  // Алиас без даты — на случай если где-то передаётся короткая форма
  "claude-haiku-4-5": priceFrom(1.0, 5.0),
};

export interface TokenUsage {
  tokensInput: number;
  tokensOutput: number;
  tokensCacheRead: number;
  tokensCacheCreate: number;
}

/**
 * Стоимость оборота в долларах.
 *
 * Возвращает null для неизвестной модели — лучше пустая ячейка в отчёте,
 * чем цифра, посчитанная по чужому прайсу. Когда появится новая модель,
 * null в статистике сразу покажет, что прайс пора дополнить.
 */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const price = MODEL_PRICING[model];
  if (!price) return null;

  const cost =
    (usage.tokensInput * price.input +
      usage.tokensOutput * price.output +
      usage.tokensCacheRead * price.cacheRead +
      usage.tokensCacheCreate * price.cacheWrite1h) /
    1_000_000;

  // 6 знаков — столько же, сколько в Decimal(10,6) у AiTurn.costUsd
  return Math.round(cost * 1_000_000) / 1_000_000;
}
