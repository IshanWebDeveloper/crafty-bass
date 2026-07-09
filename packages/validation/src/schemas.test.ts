import { describe, it, expect } from 'vitest';
import { CreateJobSchema, CreateQuoteSchema, FundEscrowSchema } from './index';

describe('CreateJobSchema', () => {
  it('enforces budgetMax >= budgetMin and correctly assigns path', () => {
    const invalid = CreateJobSchema.safeParse({
      title: 'Valid title here',
      description: 'Valid description that is long enough',
      budgetMin: 5000,
      budgetMax: 1000, // Invalid: max < min
      scheduledFor: new Date().toISOString(),
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0].path).toEqual(['budgetMax']);
    }
  });

  it('enforces title min length', () => {
    const invalid = CreateJobSchema.safeParse({
      title: 'ab', // Too short
      description: 'Valid description that is long enough',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0].path).toEqual(['title']);
    }
  });

  it('enforces lat/lng bounds and coercion', () => {
    const valid = CreateJobSchema.safeParse({
      title: 'Valid title here',
      description: 'Valid description that is long enough',
      latitude: '80.5', // Coerced to number
      longitude: -180,
    });
    expect(valid.success).toBe(true);

    const invalidLat = CreateJobSchema.safeParse({
      title: 'Valid title here',
      description: 'Valid description that is long enough',
      latitude: 91, // Out of bounds
    });
    expect(invalidLat.success).toBe(false);
  });
});

describe('CreateQuoteSchema', () => {
  it('requires at least 1 line item and sets defaults', () => {
    const invalid = CreateQuoteSchema.safeParse({
      lineItems: [],
    });
    expect(invalid.success).toBe(false);

    const valid = CreateQuoteSchema.safeParse({
      lineItems: [{ category: 'LABOUR', name: 'Plumbing fix' }],
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.applyVat).toBe(false);
      expect(valid.data.validityDays).toBe(14);
      expect(valid.data.currency).toBe('LKR');
      expect(valid.data.lineItems[0].quantity).toBe(1);
      expect(valid.data.lineItems[0].unitPrice).toBe(0);
    }
  });
});

describe('FundEscrowSchema', () => {
  it('requires stripePaymentMethodId when paymentMethod is card', () => {
    const invalid = FundEscrowSchema.safeParse({
      paymentMethod: 'card',
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(invalid.error.issues[0].path).toEqual(['stripePaymentMethodId']);
    }

    const valid = FundEscrowSchema.safeParse({
      paymentMethod: 'card',
      stripePaymentMethodId: 'pm_12345',
    });
    expect(valid.success).toBe(true);
  });

  it('does not require stripePaymentMethodId for paypal or local', () => {
    const validPaypal = FundEscrowSchema.safeParse({
      paymentMethod: 'paypal',
    });
    expect(validPaypal.success).toBe(true);

    const validLocal = FundEscrowSchema.safeParse({
      paymentMethod: 'local',
    });
    expect(validLocal.success).toBe(true);
  });
});
