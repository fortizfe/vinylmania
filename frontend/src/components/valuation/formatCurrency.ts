/**
 * Formats a monetary amount in the currency Discogs returned the price
 * suggestions in (FR-019 — the user's own Discogs account currency; no
 * conversion). Every figure in Block 2 goes through this one function so the
 * whole screen stays in a single currency.
 *
 * `currency` is `null` until the first disc is priced; in that window we still
 * want a stable number, so fall back to a plain grouped number.
 */
export function formatCurrency(value: number, currency: string | null): string {
  if (!currency) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
  }).format(value);
}
