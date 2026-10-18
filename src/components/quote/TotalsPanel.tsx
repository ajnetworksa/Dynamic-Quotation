import React from 'react';
import { clampPercent, rateFromDiscount, discountFromRate } from '../../lib/money';

export type DiscountMode = 'amount' | 'percentage' | 'both';

interface Props {
  currency: string;
  setCurrency: (c: string) => void;
  subtotal: number;
  /** Discount actually applied (capped at the subtotal). */
  discount: number;
  /** What the user typed in the amount box. */
  rawDiscount: number;
  setDiscount: (n: number) => void;
  discountMode: DiscountMode;
  setDiscountMode: (m: DiscountMode) => void;
  discountRate: number;
  setDiscountRate: (n: number) => void;
  lastDiscountEditedRef: React.MutableRefObject<'rate' | 'amount'>;
  vatRate: number;
  setVatRate: (n: number) => void;
  tax: number;
  grandTotal: number;
  themeColors: { totalsBg?: string } & Record<string, any>;
}

export const CURRENCIES = ['SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'EGP', 'JOD', 'USD', 'EUR', 'GBP'];

/** The boxed SUBTOTAL / DISCOUNT / CURRENCY / VAT / TOTAL PACKAGE block of a quote. Purely presentational. */
export default function TotalsPanel({
  currency, setCurrency, subtotal, discount, rawDiscount, setDiscount, discountMode, setDiscountMode, discountRate, setDiscountRate,
  lastDiscountEditedRef, vatRate, setVatRate, tax, grandTotal, themeColors,
}: Props) {
  return (
    <div className="border-2 border-gray-800 w-full h-fit">
      <div className="grid grid-cols-2 border-b border-gray-300 p-2 pt-0 pb-3 text-base text-up">
        <div className="font-bold">SUBTOTAL</div>
        <div className="flex justify-between items-center font-mono font-bold">
          <span>{currency}</span>
          <span>{subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
      <div className={`border-b border-gray-300 p-2 pt-1.5 pb-2 text-base hover:bg-gray-50 transition-colors group ${!discount ? 'print:hidden' : ''}`}>
        {/* Screen View: 2 lines to give inputs full width and prevent overlapping */}
        <div className="print:hidden">
          {/* Line 1: Title and Mode Toggle Badge */}
          <div className="flex items-center justify-between">
            <div className="font-bold flex items-center gap-1.5">
              <span>DISCOUNT</span>
              <button
                type="button"
                onClick={() => {
                  const nextMode: 'amount' | 'percentage' | 'both' =
                    discountMode === 'amount' ? 'percentage' :
                    discountMode === 'percentage' ? 'both' : 'amount';
                  setDiscountMode(nextMode);
                  if (nextMode === 'percentage' || nextMode === 'both') {
                    lastDiscountEditedRef.current = 'rate';
                    setDiscountRate(rateFromDiscount(subtotal, discount));
                  } else {
                    lastDiscountEditedRef.current = 'amount';
                    setDiscountRate(0);
                  }
                }}
                className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-gray-200 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                title={
                  discountMode === 'amount' ? "Switch to Percentage (%)" :
                  discountMode === 'percentage' ? `Switch to Both (% & ${currency})` :
                  `Switch to Direct Amount (${currency})`
                } aria-label={
                  discountMode === 'amount' ? "Switch to Percentage (%)" :
                  discountMode === 'percentage' ? `Switch to Both (% & ${currency})` :
                  `Switch to Direct Amount (${currency})`
                }
              >
                {discountMode === 'amount' ? currency : discountMode === 'percentage' ? '%' : 'BOTH'}
              </button>
            </div>
            <span className="text-[11px] text-gray-400 font-normal">
              {discountMode === 'both' ? `(% & ${currency})` : discountMode === 'percentage' ? '(Percentage %)' : `(Direct ${currency})`}
            </span>
          </div>

          {/* Line 2: Percentage on the left, SAR on the right */}
          <div className="flex items-center justify-between font-mono mt-1.5">
            <div>
              {discountMode === 'percentage' || discountMode === 'both' ? (
                <div className="flex items-center text-sm">
                  <input
                    type="number"
                    className="w-12 text-center outline-none bg-white border border-gray-300 rounded px-1 py-0.5 font-bold text-sm focus:border-indigo-500 shadow-sm"
                    value={discountRate || ''}
                    onChange={e => {
                      lastDiscountEditedRef.current = 'rate';
                      const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                      setDiscountRate(val);
                      setDiscount(discountFromRate(subtotal, val));
                    }}
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="0"
                  />
                  <span className="ml-1 font-bold text-gray-600">%</span>
                </div>
              ) : (
                <span className="text-xs text-gray-400 italic">{currency} only</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>{currency}</span>
              {discountMode === 'percentage' ? (
                <span className="font-bold">{discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              ) : (
                <input
                  type="number"
                  className="w-24 text-right outline-none bg-white border border-gray-300 rounded px-1.5 py-0.5 font-bold text-sm focus:border-indigo-500 shadow-sm"
                  value={rawDiscount || ''}
                  onChange={e => {
                    lastDiscountEditedRef.current = 'amount';
                    // Never accept more than the subtotal: the PDF would otherwise print a discount larger than the items.
                    const val = Math.min(Math.max(0, parseFloat(e.target.value) || 0), subtotal > 0 ? subtotal : Infinity);
                    setDiscount(val);
                    setDiscountRate(rateFromDiscount(subtotal, val));
                  }}
                  max={subtotal > 0 ? subtotal : undefined}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                />
              )}
            </div>
          </div>
        </div>

        {/* Print View: Clean single row matching Subtotal / VAT table layout */}
        <div className="hidden print:grid print:grid-cols-2 text-base items-center">
          <div className="font-bold">
            DISCOUNT {(discountMode === 'percentage' || discountMode === 'both') && discountRate > 0 ? `(${discountRate}%)` : ''}
          </div>
          <div className="flex justify-between items-center font-mono font-bold">
            <span>{currency}</span>
            <span>{discount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
      <div className="print:hidden flex items-center justify-between border-b border-gray-300 p-2 text-sm">
        <label htmlFor="quote-currency" className="font-bold">CURRENCY</label>
        <select
          id="quote-currency"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          className="border border-gray-300 rounded px-1.5 py-0.5 bg-white font-mono"
        >
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className={`grid grid-cols-[auto_1fr] md:grid-cols-2 border-b border-gray-300 p-2 pt-0 pb-3 text-base items-center hover:bg-gray-50 transition-colors group ${!vatRate ? 'print:hidden' : ''}`}>
        <div className="font-bold flex items-center whitespace-nowrap">
          VAT
          <input
            type="number"
            className="w-9 text-center outline-none bg-transparent border-b border-gray-400 mx-1 print:border-none"
            value={vatRate}
            onChange={e => setVatRate(clampPercent(parseFloat(e.target.value) || 0))}
            min="0"
            max="100"
          />%
        </div>
        <div className="flex justify-between items-center font-mono">
          <span>{currency}</span>
          <span>{tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 border-gray-300 p-2 pt-0 pb-3 text-base" style={{ backgroundColor: themeColors.totalsBg }}>
        <div className="font-bold">TOTAL PACKAGE</div>
        <div className="flex justify-between items-center font-mono font-bold text-md rounded-md bg-green-400 text-black pt-0 pb-3">
          <span className="mr-2">{currency}</span>
          <span>{grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
}
