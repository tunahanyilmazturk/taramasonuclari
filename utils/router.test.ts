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

    it('alt rotalar üst rotaya düşer (örn. teklif detayı)', () => {
        expect(resolveRoute('quotes/quo_1', false)).toBe('quotes');
        expect(resolveRoute('quotes/quo_1', true)).toBe('quotes');
        expect(resolveRoute('companies/comp_9', false)).toBe('companies');
    });

    it('settings alt sekmeleri settings rotasına düşer', () => {
        expect(resolveRoute('settings/org', false)).toBe('settings');
        expect(resolveRoute('settings/users', false)).toBe('settings');
        expect(resolveRoute('settings/logs', true)).toBe('settings');
    });

    it('dashboard kayıt detayı dashboard rotasına düşer', () => {
        expect(resolveRoute('dashboard/rec_123', false)).toBe('dashboard');
        expect(resolveRoute('dashboard/rec_123', true)).toBe('dashboard');
    });
});
