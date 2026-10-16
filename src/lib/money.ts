// Shared money math. One implementation used by the quote form, the PDF payload, the server and exports,
// so every screen shows the same numbers. No React or Node imports: usable on both sides.

const EPS = 1e-9;

/** Round to 2 decimals, half away from zero, tolerant of binary float error (1.005 -> 1.01). */
export function round2(n: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  const sign = v < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(v) * 100 + EPS)) / 100;
}

/** qty x unit price, rounded to 2 decimals. */
export function lineTotal(qty: number, unitPrice: number): number {
  return round2((Number(qty) || 0) * (Number(unitPrice) || 0));
}

/** Clamp a percentage into 0..100 (NaN -> 0). */
export function clampPercent(p: number): number {
  const v = Number(p);
  if (!Number.isFinite(v)) return 0;
  return Math.min(100, Math.max(0, v));
}

/** Discount amount for a percentage of the subtotal. */
export function discountFromRate(subtotal: number, rate: number): number {
  return round2((Number(subtotal) || 0) * clampPercent(rate) / 100);
}

/** Percentage (2 decimals) that a discount amount represents. */
export function rateFromDiscount(subtotal: number, discount: number): number {
  const s = Number(subtotal) || 0;
  if (s <= 0) return 0;
  return round2(((Number(discount) || 0) / s) * 100);
}

export interface TotalsInput {
  /** Rounded net price of each line (qty x unit price). */
  lineNets: number[];
  /** Discount amount typed by the user (may exceed the subtotal, it is capped here). */
  discount: number;
  /** VAT percentage, 0..100. */
  vatRate: number;
}

export interface Totals {
  subtotal: number;
  /** Discount actually applied: 0 <= discount <= subtotal. */
  discount: number;
  discountedSubtotal: number;
  tax: number;
  grandTotal: number;
}

/** Totals for a quote. Every figure is rounded to 2 decimals and grandTotal === discountedSubtotal + tax exactly. */
export function computeTotals({ lineNets, discount, vatRate }: TotalsInput): Totals {
  const subtotal = round2(lineNets.reduce((s, n) => s + round2(n), 0));
  const applied = round2(Math.min(Math.max(0, Number(discount) || 0), subtotal));
  const discountedSubtotal = round2(subtotal - applied);
  const tax = round2(discountedSubtotal * clampPercent(vatRate) / 100);
  const grandTotal = round2(discountedSubtotal + tax);
  return { subtotal, discount: applied, discountedSubtotal, tax, grandTotal };
}

/** Margin % = profit / sale (not markup, which is profit / cost). */
export function marginPercent(sale: number, profit: number): number {
  const s = Number(sale) || 0;
  return s > 0 ? round2(((Number(profit) || 0) / s) * 100) : 0;
}

/** Format an amount with a currency code, e.g. "SAR 1,234.50". */
export function formatMoney(amount: number, currency = 'SAR'): string {
  const n = (Number(amount) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency} ${n}`;
}
