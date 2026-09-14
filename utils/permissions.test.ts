import { describe, expect, it } from 'vitest';
import { APP_MODULES, Role, User } from '../types';
import { canAccessModule, getUserPermissions, routeModule } from './permissions';

const user: User = {
  id: 'u1', username: 'personel', password: 'hash', fullName: 'Personel', role: 'user', roleId: 'r1'
};

const role: Role = {
  id: 'r1', name: 'Personel', permissions: APP_MODULES.reduce((acc, module) => {
    acc[module] = module === 'quotes' ? 'none' : 'view';
    return acc;
  }, {} as Role['permissions']), createdAt: new Date().toISOString()
};

describe('permissions', () => {
  it('super admin tüm modüllere erişebilir', () => {
    const permissions = getUserPermissions({ ...user, role: 'super_admin' }, [role]);
    expect(APP_MODULES.every(module => canAccessModule(permissions, module))).toBe(true);
  });

  it('rol izinleri none olan modülü kapatır', () => {
    const permissions = getUserPermissions(user, [role]);
    expect(canAccessModule(permissions, 'quotes')).toBe(false);
    expect(canAccessModule(permissions, 'calendar')).toBe(true);
  });

  it('alt rotayı ilgili uygulama modülüne çözer', () => {
    expect(routeModule('quotes/new')).toBe('quotes');
    expect(routeModule('settings/ai')).toBeNull();
  });
});
