import { describe, it, expect } from 'vitest';
import {
  round2, lineTotal, computeTotals, discountFromRate, rateFromDiscount, clampPercent, marginPercent, formatMoney,
} from './money';

describe('round2', () => {
  it('rounds half away from zero and survives float error', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
  it('treats NaN/Infinity as 0', () => {
    expect(round2(NaN)).toBe(0);
    expect(round2(Infinity)).toBe(0);
  });
});

describe('lineTotal', () => {
  it('handles fractional quantities and missing values', () => {
    expect(lineTotal(2.5, 10.1)).toBe(25.25);
    expect(lineTotal(3, 0.1)).toBe(0.3);
    expect(lineTotal(undefined as any, 5)).toBe(0);
  });
});

describe('computeTotals', () => {
  it('computes VAT on the discounted subtotal', () => {
    const t = computeTotals({ lineNets: [100, 50], discount: 30, vatRate: 15 });
    expect(t).toEqual({ subtotal: 150, discount: 30, discountedSubtotal: 120, tax: 18, grandTotal: 138 });
  });
  it('caps a discount larger than the subtotal', () => {
    const t = computeTotals({ lineNets: [100], discount: 250, vatRate: 15 });
    expect(t.discount).toBe(100);
    expect(t.grandTotal).toBe(0);
  });
  it('ignores negative discount and clamps VAT', () => {
    expect(computeTotals({ lineNets: [100], discount: -5, vatRate: 15 }).discount).toBe(0);
    expect(computeTotals({ lineNets: [100], discount: 0, vatRate: 150 }).tax).toBe(100);
    expect(computeTotals({ lineNets: [100], discount: 0, vatRate: -5 }).tax).toBe(0);
  });
  it('grandTotal always equals discountedSubtotal + tax', () => {
    const t = computeTotals({ lineNets: [33.33, 66.67, 0.01], discount: 12.34, vatRate: 15 });
    expect(t.grandTotal).toBe(Math.round((t.discountedSubtotal + t.tax) * 100) / 100);
  });
  it('empty quote is all zeros', () => {
    expect(computeTotals({ lineNets: [], discount: 0, vatRate: 15 }).grandTotal).toBe(0);
  });
});

describe('discount helpers', () => {
  it('round-trips rate and amount', () => {
    expect(discountFromRate(200, 10)).toBe(20);
    expect(rateFromDiscount(200, 20)).toBe(10);
    expect(rateFromDiscount(0, 20)).toBe(0);
  });
  it('clamps percentages', () => {
    expect(clampPercent(120)).toBe(100);
    expect(clampPercent(-3)).toBe(0);
    expect(clampPercent(NaN)).toBe(0);
  });
});

describe('margin and format', () => {
  it('margin is profit over sale', () => {
    expect(marginPercent(200, 50)).toBe(25);
    expect(marginPercent(0, 50)).toBe(0);
  });
  it('formats with currency', () => {
    expect(formatMoney(1234.5, 'SAR')).toBe('SAR 1,234.50');
    expect(formatMoney(NaN, 'USD')).toBe('USD 0.00');
  });
});
