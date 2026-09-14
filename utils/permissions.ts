import { APP_MODULES, AppModule, ModulePermissions, PermissionLevel, Role, User } from '../types';

export const EMPTY_PERMISSIONS: ModulePermissions = APP_MODULES.reduce((acc, module) => {
  acc[module] = 'none';
  return acc;
}, {} as ModulePermissions);

export const getUserPermissions = (user: User, roles: Role[]): ModulePermissions => {
  if (user.role === 'super_admin') {
    return APP_MODULES.reduce((acc, module) => {
      acc[module] = 'edit';
      return acc;
    }, {} as ModulePermissions);
  }
  return roles.find(item => item.id === user.roleId)?.permissions ?? EMPTY_PERMISSIONS;
};

export const canAccessModule = (permissions: ModulePermissions, module: AppModule): boolean => permissions[module] !== 'none';
export const canEditModule = (permissions: ModulePermissions, module: AppModule): boolean => permissions[module] === 'edit';

export const routeModule = (route: string): AppModule | null => {
  const base = route.split('/')[0];
  return (APP_MODULES as readonly string[]).includes(base) ? base as AppModule : null;
};

export const permissionLevel = (permissions: ModulePermissions, module: AppModule): PermissionLevel => permissions[module] ?? 'none';
