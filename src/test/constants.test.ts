import { describe, it, expect } from 'vitest';

describe('constants', () => {
  it('MAIN_ADMIN_EMAIL reads from env', async () => {
    const { MAIN_ADMIN_EMAIL } = await import('../constants');
    expect(typeof MAIN_ADMIN_EMAIL).toBe('string');
  });
});
