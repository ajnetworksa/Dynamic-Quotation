// =============================================================================
// pricing.ts — ONE place for the internal cost / markup analysis (BASE, B.TOTAL, TTL PROFIT)
// =============================================================================
// Used by the Quote editor sidebar, the editor's "Export Excel" and every Excel export in
// Tracking (separate files, Detailed Summary). Before 2026-11-03 Tracking had its own copy of
// these rules that differed from the editor (no "materials" rule, wrong filter keys, profit
// calculated from TOTAL PACKAGE incl. VAT) → different B.TOTAL / TTL PROFIT for the same quote.
//
// Rules per line item (first match wins):
//   EXCL  description contains an "Excluded" keyword        → no base, no profit (ignored)
//   ZM    description contains a "Zero Markup" keyword      → base = sale price (profit 0)
//   MAN   has a manual price AND (description contains "materials" OR no database price)
//                                                            → base = manual price
//   DB    has a database (original) price                  → base = original price
//   --    nothing known                                     → base 0 (whole sale counts as profit)
// B.TOTAL    = Σ base totals
// TTL PROFIT = Σ (net price − base total) over all non-EXCL lines  (before discount & VAT)
// =============================================================================

export type MuFilters = { zeroMarkup: string[]; excluded: string[] };
export type PricingRule = 'EXCL' | 'ZM' | 'MAN' | 'DB' | '--';

export interface PricedItemLike {
  description?: string | null;
  qty?: number | string | null;
  unit_price?: number | null;
  net_price?: number | null;
  original_price?: number | null;
  manual_price?: number | null;
}

const toList = (v: any): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim() !== '') : []);

/** Accepts the stored settings value (string or object) in the format Settings saves: { zeroMarkup, excluded }. */
export function normalizeMuFilters(raw: any): MuFilters {
  let v = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { v = null; }
  }
  return {
    zeroMarkup: toList(v?.zeroMarkup ?? v?.zm),
    excluded: toList(v?.excluded ?? v?.excl),
  };
}

export function getItemRule(item: PricedItemLike, filters: MuFilters): PricingRule {
  const desc = (item.description || '').toLowerCase();
  if (filters.excluded.some((kw) => desc.includes(kw.toLowerCase()))) return 'EXCL';
  if (filters.zeroMarkup.some((kw) => desc.includes(kw.toLowerCase()))) return 'ZM';

  const hasManual = item.manual_price !== undefined && item.manual_price !== null;
  const hasDB = item.original_price !== undefined && item.original_price !== null;
  // Only overwrite the base price with the manual price for 'materials' lines (or when no DB price exists)
  const isSpecial = desc.includes('materials');

  if (hasManual && (isSpecial || !hasDB)) return 'MAN';
  if (hasDB) return 'DB';
  return '--';
}

export interface ItemAnalysis {
  rule: PricingRule;
  /** BASE column (per unit) as shown in the sidebar / Excel */
  displayBase: number;
  /** TOTAL column as shown in the sidebar / Excel */
  displayTotal: number;
  /** contribution to B.TOTAL */
  baseContribution: number;
  /** contribution to TTL PROFIT */
  profitContribution: number;
  /** "Manual" column value */
  manualValue: number | null | undefined;
}

export function analyzeItem(item: PricedItemLike, filters: MuFilters): ItemAnalysis {
  const rule = getItemRule(item, filters);
  const qty = Number(item.qty) || 0;
  const sale = Number(item.net_price) || 0;
  const manualValue = item.manual_price !== undefined && item.manual_price !== null ? item.manual_price : item.unit_price;

  if (rule === 'EXCL') {
    return { rule, displayBase: 0, displayTotal: 0, baseContribution: 0, profitContribution: 0, manualValue };
  }
  if (rule === 'ZM') {
    return { rule, displayBase: Number(item.unit_price) || 0, displayTotal: sale, baseContribution: sale, profitContribution: 0, manualValue };
  }
  let unitBase = 0;
  if (rule === 'MAN') unitBase = Number(item.manual_price) || 0;
  else if (rule === 'DB') unitBase = Number(item.original_price) || 0;
  const total = unitBase * qty;
  return { rule, displayBase: unitBase, displayTotal: total, baseContribution: total, profitContribution: sale - total, manualValue };
}

export function analyzeItems(items: PricedItemLike[], filters: MuFilters) {
  const rows = (items || []).map((it) => analyzeItem(it, filters));
  const baseTotal = rows.reduce((s, r) => s + r.baseContribution, 0);
  const markupProfit = rows.reduce((s, r) => s + r.profitContribution, 0);
  return { rows, baseTotal, markupProfit };
}

// -----------------------------------------------------------------------------
// Cost refresh — what the Quote editor does when a saved quote is opened:
// if the product's price in the Product DB changed since the quote was made, BASE uses
// TODAY's cost, and the line's sale price is frozen as a manual price (so it doesn't move).
// Exports must apply the same step to show the same B.TOTAL / TTL PROFIT as the editor.
// -----------------------------------------------------------------------------
export interface CostRefreshResult {
  original_price: number | null | undefined;
  manual_price: number | undefined;
  costShift?: 'up' | 'down';
}

export function refreshItemCost(
  item: { product_id?: number | null; original_price?: number | null; manual_price?: number | null; unit_price?: number | null },
  productPriceById: Map<number, number> | Record<number, number>,
  markup: number,
): CostRefreshResult {
  let original_price: any = item.original_price;
  let manual_price: number | undefined = item.manual_price !== null && item.manual_price !== undefined ? item.manual_price : undefined;
  let costShift: 'up' | 'down' | undefined;

  if (item.product_id) {
    const dbPrice = productPriceById instanceof Map ? productPriceById.get(item.product_id) : (productPriceById as any)[item.product_id];
    if (dbPrice !== undefined) {
      if (original_price !== dbPrice && original_price !== undefined) {
        costShift = dbPrice > original_price ? 'up' : 'down';
        original_price = dbPrice;
        const expectedNewUnitPrice = dbPrice * (1 + markup / 100);
        const currentUnitPrice: any = item.unit_price;
        if (manual_price === undefined && Math.abs(currentUnitPrice - expectedNewUnitPrice) > 0.01) {
          manual_price = Math.round(currentUnitPrice * 100) / 100;
        }
      }
    }
  }
  if (manual_price !== undefined) manual_price = Math.round(manual_price * 100) / 100;
  // original_price is returned as-is (may be null) — callers decide how to treat null, exactly as before
  return { original_price, manual_price, costShift };
}

/** Items prepared exactly like the editor shows them (cost refresh + unit/net price), for analysis/export. */
// costMarkup / priceMarkup mirror QuoteForm.fetchQuote exactly (it treats a stored markup of 0 differently in the two steps)
export function prepareItemsLikeEditor(items: any[], productPriceById: Map<number, number>, costMarkup: number, priceMarkup: number = costMarkup) {
  return (items || []).map((item: any) => {
    const { original_price, manual_price } = refreshItemCost(item, productPriceById, costMarkup);
    let unit_price = item.unit_price || 0;
    if (manual_price !== undefined) unit_price = manual_price;
    else if (original_price !== undefined) unit_price = Math.round((original_price as number) * (1 + priceMarkup / 100) * 100) / 100;
    return { ...item, original_price: original_price !== null ? original_price : undefined, manual_price, unit_price, net_price: Math.round(unit_price * (item.qty || 1) * 100) / 100 };
  });
}

// -----------------------------------------------------------------------------
// Cost visibility — "Price Analysis" permission (canOverridePrice)
// Users without it must not see BASE / Manual / markup / B.TOTAL / TTL PROFIT in Excel exports
// (before 2026-11-03 these columns were exported for everybody, only the sidebar was hidden).
// -----------------------------------------------------------------------------
export function canSeeCost(user: any): boolean {
  return user?.role === 'admin' || !!user?.permissions?.canOverridePrice;
}

/** Clears the internal cost columns (values + styling) of an ExcelJS worksheet, columns fromCol..toCol (1-based). */
export function clearCostColumns(ws: any, fromCol: number, toCol: number) {
  ws.eachRow({ includeEmpty: true }, (row: any) => {
    for (let c = fromCol; c <= toCol; c++) {
      const cell = row.getCell(c);
      cell.value = null;
      cell.style = {};
    }
  });
}
