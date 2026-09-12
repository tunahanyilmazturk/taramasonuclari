import { describe, it, expect } from 'vitest';
import { hashPassword, DEFAULT_ADMIN_HASH } from './security';

describe('hashPassword', () => {
  it('"123" için bilinen SHA-256 değerini üretir', async () => {
    expect(await hashPassword('123')).toBe(DEFAULT_ADMIN_HASH);
  });

  it('deterministik ve 64 karakterlik hex döner', async () => {
    const h1 = await hashPassword('parola-1');
    const h2 = await hashPassword('parola-1');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('farklı parolalar farklı hash üretir', async () => {
    expect(await hashPassword('a')).not.toBe(await hashPassword('b'));
  });
});
