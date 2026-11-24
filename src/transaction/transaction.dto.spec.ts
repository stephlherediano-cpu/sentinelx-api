
import { describe, expect, it } from 'vitest';
import { transactionSchema } from './transaction.dto';

const validTransaction = {
  chainId: 56,
  from: '0x1111111111111111111111111111111111111111',
  to: '0x2222222222222222222222222222222222222222',
  value: '0',
  data: '0x',
};

describe('SentinelX Transaction DTO Validation', () => {
  it('accepts a valid BNB Chain transaction', () => {
    expect(transactionSchema.safeParse(validTransaction).success).toBe(true);
  });

  it('accepts supported chain IDs', () => {
    for (const chainId of [56, 1, 137, 42161]) {
      const result = transactionSchema.safeParse({
        ...validTransaction,
        chainId,
      });

      expect(result.success).toBe(true);
    }
  });

  it('rejects unsupported chain IDs', () => {
    const result = transactionSchema.safeParse({
      ...validTransaction,
      chainId: 999,
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid sender addresses', () => {
    const result = transactionSchema.safeParse({
      ...validTransaction,
      from: '0x1234',
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid recipient addresses', () => {
    const result = transactionSchema.safeParse({
      ...validTransaction,
      to: 'invalid-address',
    });

    expect(result.success).toBe(false);
  });

  it('rejects malformed calldata', () => {
    const result = transactionSchema.safeParse({
      ...validTransaction,
      data: '0x123',
    });

    expect(result.success).toBe(false);
  });

  it('rejects unexpected fields', () => {
    const result = transactionSchema.safeParse({
      ...validTransaction,
      privateKey: 'not-allowed',
    });

    expect(result.success).toBe(false);
  });

  it('rejects oversized calldata', () => {
    const result = transactionSchema.safeParse({
      ...validTransaction,
      data: '0x' + 'aa'.repeat(100001),
    });

    expect(result.success).toBe(false);
  });
});
