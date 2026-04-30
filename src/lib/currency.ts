/**
 * Money formatting helpers.
 *
 * For now Staffix is sold only in Uzbekistan, so all amounts are in сум.
 * When we add other countries (KZ/RU/KG/...) — switch this single helper
 * over to read Business.country and pick the right currency label.
 *
 * Existing per-country logic in src/lib/ai-memory.ts (currencyLabel) and
 * src/lib/sales-tools.ts (currencyLabel) keeps the AI prompt smart for
 * any country in the data, but in the dashboard UI we display a single
 * currency to keep things simple.
 */

const DEFAULT_CURRENCY_LABEL = "сум";

/**
 * Format a numeric amount (e.g. 200000) as a localised string with the
 * default currency label. Examples:
 *   formatMoney(200000) // "200 000 сум"
 *   formatMoney(0)      // "0 сум"
 */
export function formatMoney(amount: number): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) return `0 ${DEFAULT_CURRENCY_LABEL}`;
  return `${Math.round(amount).toLocaleString("ru-RU")} ${DEFAULT_CURRENCY_LABEL}`;
}

/**
 * Currency suffix only — useful when the number is rendered separately.
 *   formatCurrencySuffix() // " сум"
 */
export function getCurrencySuffix(): string {
  return ` ${DEFAULT_CURRENCY_LABEL}`;
}
