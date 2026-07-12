import { describe, it, expect } from 'vitest';
import { computeQuoteTotals, QuoteLineInput } from './index';

describe('computeQuoteTotals', () => {
  it('returns all zeros for empty lines', () => {
    const result = computeQuoteTotals([], {});
    expect(result).toEqual({
      labour: 0,
      materials: 0,
      callout: 0,
      discount: 0,
      subtotal: 0,
      vat: 0,
      total: 0,
    });
  });

  it('splits labour and material buckets and calculates qty × unitPrice', () => {
    const lines: QuoteLineInput[] = [
      { category: 'LABOUR', quantity: 2, unitPrice: 500 },
      { category: 'LABOUR', quantity: 1, unitPrice: 1000 },
      { category: 'MATERIAL', quantity: 5, unitPrice: 200 },
    ];
    const result = computeQuoteTotals(lines, {});
    expect(result.labour).toBe(2000);
    expect(result.materials).toBe(1000);
    expect(result.subtotal).toBe(3000);
  });

  it('treats undefined calloutFee as 0', () => {
    const result = computeQuoteTotals([], { calloutFee: undefined });
    expect(result.callout).toBe(0);
  });

  it('subtracts discount with a floor at 0, making VAT and total also 0', () => {
    const lines: QuoteLineInput[] = [
      { category: 'LABOUR', quantity: 1, unitPrice: 500 },
    ];
    const result = computeQuoteTotals(lines, {
      discount: 1000,
      applyVat: true,
    });
    expect(result.subtotal).toBe(0);
    expect(result.vat).toBe(0);
    expect(result.total).toBe(0);
  });

  it('applies 18% VAT after discount', () => {
    const lines: QuoteLineInput[] = [
      { category: 'LABOUR', quantity: 1, unitPrice: 2000 },
    ];
    const result = computeQuoteTotals(lines, {
      discount: 1000,
      applyVat: true,
    });
    expect(result.subtotal).toBe(1000);
    expect(result.vat).toBe(180); // 18% of 1000
    expect(result.total).toBe(1180);
  });

  it('does not apply VAT if applyVat is false or undefined', () => {
    const lines: QuoteLineInput[] = [
      { category: 'LABOUR', quantity: 1, unitPrice: 1000 },
    ];
    const resultFalse = computeQuoteTotals(lines, { applyVat: false });
    expect(resultFalse.vat).toBe(0);

    const resultUndef = computeQuoteTotals(lines, {});
    expect(resultUndef.vat).toBe(0);
  });

  it('treats NaN or non-numeric quantity/unitPrice as 0', () => {
    const lines: QuoteLineInput[] = [
      { category: 'LABOUR', quantity: NaN, unitPrice: 1000 },
      {
        category: 'MATERIAL',
        quantity: 1,
        unitPrice: 'invalid' as unknown as number,
      },
    ];
    const result = computeQuoteTotals(lines, {});
    expect(result.labour).toBe(0);
    expect(result.materials).toBe(0);
    expect(result.subtotal).toBe(0);
  });
});
