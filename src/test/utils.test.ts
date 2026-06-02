import { describe, it, expect } from 'vitest';

describe('phone validation regex (SMS endpoint)', () => {
  const phoneRegex = /^\+?[0-9]{7,15}$/;

  it('accepts valid local number', () => {
    expect(phoneRegex.test('9841234567')).toBe(true);
  });

  it('accepts valid international number', () => {
    expect(phoneRegex.test('+9779841234567')).toBe(true);
  });

  it('rejects letters', () => {
    expect(phoneRegex.test('abc123')).toBe(false);
  });

  it('rejects too-short numbers', () => {
    expect(phoneRegex.test('123')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(phoneRegex.test('')).toBe(false);
  });
});
