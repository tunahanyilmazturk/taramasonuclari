import { describe, it, expect } from 'vitest';
import { resolveRoute, APP_ROUTES, DEFAULT_ROUTE } from './router';

describe('resolveRoute', () => {
    it('boş hash varsayılan rotaya düşer', () => {
        expect(resolveRoute('', false)).toBe(DEFAULT_ROUTE);
        expect(resolveRoute('', true)).toBe(DEFAULT_ROUTE);
    });

    it('bilinmeyen hash varsayılan rotaya düşer', () => {
        expect(resolveRoute('bilinmeyen-sayfa', true)).toBe(DEFAULT_ROUTE);
        expect(resolveRoute('///', true)).toBe(DEFAULT_ROUTE);
    });

    it('tüm geçerli rotaları korur', () => {
        for (const route of APP_ROUTES) {
            expect(resolveRoute(route, true)).toBe(route);
        }
    });

    it('admin rotalarını super_admin olmayan kullanıcıya kapatır', () => {
        expect(resolveRoute('users', false)).toBe(DEFAULT_ROUTE);
        expect(resolveRoute('ai', false)).toBe(DEFAULT_ROUTE);
    });

    it('super_admin admin rotalarına erişebilir', () => {
        expect(resolveRoute('users', true)).toBe('users');
        expect(resolveRoute('ai', true)).toBe('ai');
    });
});
