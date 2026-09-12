import { useCallback, useEffect, useRef, useState } from 'react';

export const APP_ROUTES = ['home', 'dashboard', 'screenings', 'quotes', 'calendar', 'equipment', 'team', 'companies', 'config', 'users', 'ai', 'settings'] as const;
export type AppRoute = (typeof APP_ROUTES)[number];

export const DEFAULT_ROUTE: AppRoute = 'home';

const ADMIN_ROUTES: readonly string[] = ['users', 'ai'];

const parseHash = (): string =>
    window.location.hash.replace(/^#\/?/, '').split('?')[0];

export const resolveRoute = (hash: string, isSuperAdmin: boolean): AppRoute => {
    const base = hash.split('/')[0]; // alt rotalar (örn. quotes/quo_1) üst rotaya düşer
    if (!isSuperAdmin && ADMIN_ROUTES.includes(base)) return DEFAULT_ROUTE;
    return (APP_ROUTES as readonly string[]).includes(base) ? (base as AppRoute) : DEFAULT_ROUTE;
};

export const useHashRoute = () => {
    const [hash, setHash] = useState(parseHash);
    // Oturum içinde ziyaret edilen rotalar — uygulama içi "geri" butonları
    // tarayıcı geçmişinde gerçekten bir önceki sayfaya dönebilsin diye izlenir
    const stackRef = useRef<string[]>([parseHash()]);
    const selfBackRef = useRef(false); // goBack tetiklediğimiz geçişler işaretlenir

    useEffect(() => {
        const onHashChange = () => {
            const h = parseHash();
            setHash(h);
            const s = stackRef.current;
            if (selfBackRef.current) {
                // Kendi geri dönüşümüz — hedefi tekrar yığınla eklemiyoruz
                selfBackRef.current = false;
            } else if (s[s.length - 1] !== h) {
                s.push(h);
            }
        };
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    const navigate = useCallback((route: string) => {
        if (parseHash() !== route) {
            window.location.hash = `/${route}`;
        }
    }, []);

    /**
     * Uygulama içi "geri" butonu: oturumda daha önce ziyaret edilmiş bir sayfa
     * varsa tarayıcı geçmişiyle oraya döner (liste filtresi/konumu korunur);
     * yoksa (örn. derin linkle açılmış oturum) verilen üst rotaya gider.
     */
    const goBack = useCallback((fallback: string) => {
        if (stackRef.current.length > 1) {
            stackRef.current.pop(); // mevcut girdiyi at
            selfBackRef.current = true;
            window.history.back();
        } else if (parseHash() !== fallback) {
            window.location.hash = `/${fallback}`;
        }
    }, []);

    return { hash, navigate, goBack };
};
