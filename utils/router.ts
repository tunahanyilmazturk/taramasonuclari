import { useCallback, useEffect, useState } from 'react';

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

    useEffect(() => {
        const onHashChange = () => setHash(parseHash());
        window.addEventListener('hashchange', onHashChange);
        return () => window.removeEventListener('hashchange', onHashChange);
    }, []);

    const navigate = useCallback((route: string) => {
        if (parseHash() !== route) {
            window.location.hash = `/${route}`;
        }
    }, []);

    return { hash, navigate };
};
