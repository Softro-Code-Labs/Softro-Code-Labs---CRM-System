/**
 * Quote totals, shared by the editor (live preview) and the server (stored totals).
 * Money is worked in whole cents so totals never drift by a cent.
 *
 *   line      = quantity × unit price − line discount %
 *   subtotal  = sum of lines
 *   discount  = subtotal × quote discount %
 *   tax       = (subtotal − discount) × tax rate %
 *   total     = subtotal − discount + tax
 */
export type LineInput = { quantity: number; unitPrice: number; discountPercent: number };

const toCents = (n: number) => Math.round(n * 100);
const pct = (cents: number, percent: number) => Math.round((cents * percent) / 100);

export function lineTotalCents(line: LineInput) {
  const gross = Math.round(line.quantity * toCents(line.unitPrice));
  return gross - pct(gross, line.discountPercent || 0);
}

export function quoteTotals(lines: LineInput[], discountPercent: number, taxRate: number) {
  const lineTotals = lines.map(lineTotalCents);
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const discount = pct(subtotal, discountPercent || 0);
  const tax = pct(subtotal - discount, taxRate || 0);
  const total = subtotal - discount + tax;
  return {
    lineTotals: lineTotals.map((c) => c / 100),
    subtotal: subtotal / 100,
    discountTotal: discount / 100,
    taxTotal: tax / 100,
    total: total / 100,
  };
}

/** "1 project", "12 months", "2.5 hours". */
export function formatQuantity(quantity: number | { toString(): string }, unit: string) {
  const q = Number(quantity.toString());
  const plural = q !== 1 && unit && !/s$/i.test(unit) ? `${unit}s` : unit;
  return `${q} ${plural}`.trim();
}
