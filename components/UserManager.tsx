import React, { useState } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { Modal, modalPanel } from './Modal';
import {
  Users, UserPlus, Trash2, Key, Search, Loader2,
  Eye, EyeOff, UserCog, User, X, Check, Pencil, Tag,
  Shield, Power, Mail, Phone, Briefcase, Crown, Plus
} from 'lucide-react';
import { User as UserType, Role, AppModule, PermissionLevel, APP_MODULES, MODULE_LABELS } from '../types';
import { storageService } from '../services/storageService';
import { hashPassword } from '../utils/security';

interface UserManagerProps {
  currentUser: UserType;
}

type Tab = 'users' | 'roles';

const PERMISSION_META: Record<PermissionLevel, { label: string; color: string; dot: string }> = {
  none: { label: 'Yok', color: 'text-slate-400', dot: 'bg-slate-300' },
  view: { label: 'Görüntüle', color: 'text-blue-600', dot: 'bg-blue-500' },
  edit: { label: 'Düzenle', color: 'text-emerald-600', dot: 'bg-emerald-500' }
};

const ROLE_COLORS = [
  { name: 'blue', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  { name: 'purple', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
  { name: 'emerald', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { name: 'amber', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  { name: 'rose', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  { name: 'slate', cls: 'bg-slate-100 text-slate-700 border-slate-200' }
];

const getColorClass = (color?: string) =>
  ROLE_COLORS.find(c => c.name === color)?.cls || ROLE_COLORS[0].cls;

export const UserManager: React.FC<UserManagerProps> = ({ currentUser }) => {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UserType[]>(() => storageService.getUsers());
  const [roles, setRoles] = useState<Role[]>(() => storageService.getRoles());

  // Kullanıcı modal state
  const [userModal, setUserModal] = useState<{ mode: 'create' | 'edit'; user?: UserType } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Rol modal state
  const [roleModal, setRoleModal] = useState<{ mode: 'create' | 'edit'; role?: Role } | null>(null);
  const [deleteRoleConfirm, setDeleteRoleConfirm] = useState<string | null>(null);

  // ── Kullanıcı işlemleri ──
  const saveUser = async (data: Partial<UserType> & { password?: string }) => {
    setIsSubmitting(true);
    try {
      if (userModal?.mode === 'create') {
        if (users.some(u => u.username === data.username)) {
          setErrorMsg('Bu kullanıcı adı zaten kullanılıyor.');
          setIsSubmitting(false);
          return;
        }
        const hashedPassword = await hashPassword(data.password || '123');
        const created: UserType = {
          id: Date.now().toString(),
          username: data.username || '',
          password: hashedPassword,
          fullName: data.fullName || '',
          role: data.role || 'user',
          roleId: data.roleId,
          email: data.email,
          phone: data.phone,
          jobTitle: data.jobTitle,
          active: data.active ?? true
        };
        const updated = [...users, created];
        setUsers(updated);
        storageService.saveUsers(updated);
      } else if (userModal?.mode === 'edit' && userModal.user) {
        const updated = users.map(u =>
          u.id === userModal.user!.id
            ? {
                ...u,
                ...data,
                password: data.password ? u.password : u.password // şifre boşsa koru
              }
            : u
        );
        // Eğer şifre değiştiyse hash'le
        if (data.password) {
          const hashed = await hashPassword(data.password);
          const withHash = updated.map(u =>
            u.id === userModal.user!.id ? { ...u, password: hashed } : u
          );
          setUsers(withHash);
          storageService.saveUsers(withHash);
        } else {
          setUsers(updated);
          storageService.saveUsers(updated);
        }
      }
      setUserModal(null);
    } catch (error) {
      console.error('User save failed', error);
      setErrorMsg('Kullanıcı kaydedilirken bir hata oluştu.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      setErrorMsg('Kendi hesabınızı silemezsiniz.');
      return;
    }
    setDeleteUserConfirm(id);
  };

  const doDeleteUser = () => {
    if (!deleteUserConfirm) return;
    const updated = users.filter(u => u.id !== deleteUserConfirm);
    setUsers(updated);
    storageService.saveUsers(updated);
    setDeleteUserConfirm(null);
  };

  const toggleUserActive = (id: string) => {
    if (id === currentUser.id) return;
    const updated = users.map(u => u.id === id ? { ...u, active: !u.active } : u);
    setUsers(updated);
    storageService.saveUsers(updated);
  };

  // ── Rol işlemleri ──
  const saveRole = (data: Partial<Role>) => {
    if (roleModal?.mode === 'create') {
      const created: Role = {
        id: `role_${Date.now()}`,
        name: data.name || 'Yeni Rol',
        description: data.description,
        color: data.color || 'blue',
        permissions: data.permissions || APP_MODULES.reduce((acc, m) => ({ ...acc, [m]: 'none' as PermissionLevel }), {} as Role['permissions']),
        isSystem: false,
        createdAt: new Date().toISOString()
      };
      const updated = [...roles, created];
      setRoles(updated);
      storageService.saveRoles(updated);
    } else if (roleModal?.mode === 'edit' && roleModal.role) {
      const updated = roles.map(r =>
        r.id === roleModal.role!.id ? { ...r, ...data } : r
      );
      setRoles(updated);
      storageService.saveRoles(updated);
    }
    setRoleModal(null);
  };

  const handleDeleteRole = (id: string) => {
    const role = roles.find(r => r.id === id);
    if (role?.isSystem) {
      setErrorMsg('Sistem rolleri silinemez.');
      return;
    }
    const userCount = users.filter(u => u.roleId === id).length;
    if (userCount > 0) {
      setErrorMsg(`Bu rol ${userCount} kullanıcıya atanmış. Önce kullanıcıları başka bir role atayın.`);
      return;
    }
    setDeleteRoleConfirm(id);
  };

  const doDeleteRole = () => {
    if (!deleteRoleConfirm) return;
    const updated = roles.filter(r => r.id !== deleteRoleConfirm);
    setRoles(updated);
    storageService.saveRoles(updated);
    setDeleteRoleConfirm(null);
  };

  // ── Filtrelenmiş kullanıcılar ──
  const filteredUsers = users.filter(u =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleName = (roleId?: string) => roles.find(r => r.id === roleId)?.name;
  const getRoleColor = (roleId?: string) => roles.find(r => r.id === roleId)?.color;

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-in fade-in duration-500">

      {/* Başlık */}
      <div>
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
          <Users className="text-blue-600" /> Kullanıcı Yönetimi
        </h2>
        <p className="text-sm text-slate-500 mt-1">Personelleri yönetin, roller oluşturun ve modül bazında yetkilendirme yapın.</p>
      </div>

      {/* Tab seçici */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'users' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <User size={16} /> Personeller ({users.length})
        </button>
        <button
          onClick={() => setTab('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'roles' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Shield size={16} /> Roller ({roles.length})
        </button>
      </div>

      {/* ══════ PERSONEL TAB ══════ */}
      {tab === 'users' && (
        <>
          {/* Arama + Ekle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="İsim veya kullanıcı adı ara..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              />
            </div>
            <button
              onClick={() => setUserModal({ mode: 'create' })}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95 shrink-0"
            >
              <UserPlus size={16} /> Yeni Personel
            </button>
          </div>

          {/* Kullanıcı listesi */}
          <div className="space-y-2">
            {filteredUsers.map(user => {
              const isMe = user.id === currentUser.id;
              const isAdmin = user.role === 'super_admin';
              const roleName = isAdmin ? 'Yönetici' : getRoleName(user.roleId) || 'Personel';
              const roleColor = isAdmin ? 'purple' : getRoleColor(user.roleId);
              const colorCls = getColorClass(isAdmin ? 'purple' : roleColor);
              const isDemo = ['admin', 'doktor', 'personel'].includes(user.username);
              const canManage = !isMe && user.username !== 'admin';

              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 p-3 bg-white rounded-2xl border transition-all group ${
                    isMe ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 hover:border-slate-300'
                  } ${!user.active ? 'opacity-60' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-sm shrink-0 ${
                    isAdmin ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'
                  }`}>
                    {user.fullName.substring(0, 1).toUpperCase()}
                  </div>

                  {/* Bilgi */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-slate-800 text-sm truncate">{user.fullName}</p>
                      {isMe && <span className="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-black uppercase border border-blue-200">Sen</span>}
                      {isDemo && <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold uppercase border border-slate-200">Demo</span>}
                      {!user.active && <span className="text-[8px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold uppercase border border-red-200">Pasif</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-slate-400 font-mono">@{user.username}</p>
                      {user.jobTitle && <span className="text-xs text-slate-400">· {user.jobTitle}</span>}
                    </div>
                  </div>

                  {/* Rol rozeti */}
                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wide shrink-0 ${colorCls}`}>
                    {isAdmin ? <Crown size={11} /> : <Shield size={11} />} {roleName}
                  </span>

                  {/* Aksiyonlar */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setUserModal({ mode: 'edit', user })}
                      className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                      title="Düzenle"
                    >
                      <Pencil size={15} />
                    </button>
                    {canManage && (
                      <>
                        <button
                          onClick={() => toggleUserActive(user.id)}
                          className="p-2 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          title={user.active ? 'Pasifleştir' : 'Aktifleştir'}
                        >
                          <Power size={15} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {filteredUsers.length === 0 && (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-200">
                <Users size={22} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Kullanıcı bulunamadı.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════ ROL TAB ══════ */}
      {tab === 'roles' && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setRoleModal({ mode: 'create' })}
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-purple-200 active:scale-95"
            >
              <Plus size={16} /> Yeni Rol
            </button>
          </div>

          <div className="space-y-3">
            {roles.map(role => {
              const userCount = users.filter(u => u.roleId === role.id).length;
              const colorCls = getColorClass(role.color);
              const permCount = APP_MODULES.filter(m => role.permissions[m] !== 'none').length;

              return (
                <div key={role.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-xl ${colorCls} shrink-0`}>
                      <Shield size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 text-sm">{role.name}</p>
                        {role.isSystem && <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold uppercase border border-slate-200">Sistem</span>}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colorCls}`}>{userCount} kullanıcı</span>
                        <span className="text-[10px] text-slate-400 font-bold">{permCount}/{APP_MODULES.length} modül</span>
                      </div>
                      {role.description && <p className="text-xs text-slate-400 mt-1">{role.description}</p>}

                      {/* Yetki özeti */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {APP_MODULES.filter(m => role.permissions[m] !== 'none').map(m => (
                          <span key={m} className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${PERMISSION_META[role.permissions[m]].color} bg-slate-50`}>
                            {MODULE_LABELS[m]}: {PERMISSION_META[role.permissions[m]].label}
                          </span>
                        ))}
                        {permCount === 0 && <span className="text-[10px] text-slate-400">Hiç yetki atanmamış</span>}
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setRoleModal({ mode: 'edit', role })}
                        className="p-2 text-slate-300 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                        title="Düzenle"
                      >
                        <Pencil size={15} />
                      </button>
                      {!role.isSystem && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ══════ KULLANICI MODAL ══════ */}
      {userModal && (
        <UserModal
          mode={userModal.mode}
          user={userModal.user}
          roles={roles}
          isSubmitting={isSubmitting}
          showPassword={showPassword}
          setShowPassword={setShowPassword}
          onSave={saveUser}
          onClose={() => setUserModal(null)}
        />
      )}

      {/* ══════ ROL MODAL ══════ */}
      {roleModal && (
        <RoleModal
          mode={roleModal.mode}
          role={roleModal.role}
          onSave={saveRole}
          onClose={() => setRoleModal(null)}
        />
      )}

      {/* Confirm Modals */}
      <ConfirmModal
        open={deleteUserConfirm !== null}
        title="Kullanıcıyı Sil"
        message="Bu kullanıcıyı silmek istediğinize emin misiniz?"
        confirmLabel="Evet, Sil"
        onConfirm={doDeleteUser}
        onCancel={() => setDeleteUserConfirm(null)}
      />
      <ConfirmModal
        open={deleteRoleConfirm !== null}
        title="Rolü Sil"
        message="Bu rolü silmek istediğinize emin misiniz?"
        confirmLabel="Evet, Sil"
        onConfirm={doDeleteRole}
        onCancel={() => setDeleteRoleConfirm(null)}
      />
      <ConfirmModal
        open={errorMsg !== null}
        title="Uyarı"
        message={errorMsg || ''}
        confirmLabel="Tamam"
        variant="warning"
        onConfirm={() => setErrorMsg(null)}
        onCancel={() => setErrorMsg(null)}
      />
    </div>
  );
};

// ══════ KULLANICI MODAL KOMPONENTİ ══════
interface UserModalProps {
  mode: 'create' | 'edit';
  user?: UserType;
  roles: Role[];
  isSubmitting: boolean;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  onSave: (data: Partial<UserType> & { password?: string }) => void;
  onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ mode, user, roles, isSubmitting, showPassword, setShowPassword, onSave, onClose }) => {
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    username: user?.username || '',
    password: '',
    email: user?.email || '',
    phone: user?.phone || '',
    jobTitle: user?.jobTitle || '',
    role: user?.role || 'user',
    roleId: user?.roleId || roles[0]?.id || '',
    active: user?.active ?? true
  });

  const isEdit = mode === 'edit';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.username) return;
    if (!isEdit && !form.password) return;
    onSave({
      ...form,
      password: form.password || undefined // edit'te boşsa koru
    });
  };

  return (
    <Modal open onClose={onClose} overlayClassName="p-4 sm:p-6">
      <div className={`${modalPanel} w-full max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            {isEdit ? <><Pencil size={18} className="text-blue-500" /> Personeli Düzenle</> : <><UserPlus size={18} className="text-blue-500" /> Yeni Personel</>}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Ad Soyad + Kullanıcı Adı */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Ad Soyad</label>
              <div className="relative">
                <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                  placeholder="Ahmet Yılmaz"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Kullanıcı Adı</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-mono"
                  placeholder="ahmet.yilmaz"
                  autoComplete="off"
                  required
                />
              </div>
            </div>
          </div>

          {/* Email + Telefon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">E-posta</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                  placeholder="ahmet@firma.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Telefon</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                  placeholder="05XX XXX XX XX"
                />
              </div>
            </div>
          </div>

          {/* Görev */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Görev / Ünvan</label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                value={form.jobTitle}
                onChange={e => setForm({ ...form, jobTitle: e.target.value })}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                placeholder="İşyeri Hekimi, Hemşire, Teknisyen..."
              />
            </div>
          </div>

          {/* Şifre */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">
              {isEdit ? 'Yeni Şifre (boş bırakılırsa korunur)' : 'Şifre'}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="w-full pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                placeholder={isEdit ? '•••••• (değiştirmek için girin)' : '••••••'}
                autoComplete="new-password"
                required={!isEdit}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Yetki Seviyesi */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Yetki Seviyesi</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'super_admin' })}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${form.role === 'super_admin' ? 'border-purple-500 bg-purple-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className={`p-2 rounded-lg ${form.role === 'super_admin' ? 'bg-purple-600' : 'bg-slate-200'} text-white transition-colors`}>
                  <Crown size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${form.role === 'super_admin' ? 'text-purple-700' : 'text-slate-700'}`}>Yönetici</p>
                  <p className="text-[10px] text-slate-400">Tüm modüller + ayarlar</p>
                </div>
                {form.role === 'super_admin' && <Check size={16} className="text-purple-600" />}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, role: 'user' })}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${form.role === 'user' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className={`p-2 rounded-lg ${form.role === 'user' ? 'bg-blue-600' : 'bg-slate-200'} text-white transition-colors`}>
                  <User size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${form.role === 'user' ? 'text-blue-700' : 'text-slate-700'}`}>Personel</p>
                  <p className="text-[10px] text-slate-400">Role göre yetki</p>
                </div>
                {form.role === 'user' && <Check size={16} className="text-blue-600" />}
              </button>
            </div>
          </div>

          {/* Rol seçimi (sadece personel ise) */}
          {form.role === 'user' && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Rol Ata</label>
              <div className="relative">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <select
                  value={form.roleId}
                  onChange={e => setForm({ ...form, roleId: e.target.value })}
                  className="w-full appearance-none pl-9 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all cursor-pointer"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}{r.description ? ` — ${r.description}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Aktif/Pasif (edit modunda) */}
          {isEdit && (
            <label className="flex items-center gap-2.5 p-3 bg-slate-50 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={e => setForm({ ...form, active: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <Power size={15} className={form.active ? 'text-emerald-500' : 'text-slate-400'} />
              <span className="text-sm font-medium text-slate-700">{form.active ? 'Hesap aktif' : 'Hesap pasif (giriş yapamaz)'}</span>
            </label>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : isEdit ? <Check size={18} /> : <UserPlus size={18} />}
            {isSubmitting ? 'Kaydediliyor...' : isEdit ? 'Değişiklikleri Kaydet' : 'Kullanıcıyı Oluştur'}
          </button>
        </form>
      </div>
    </Modal>
  );
};

// ══════ ROL MODAL KOMPONENTİ ══════
interface RoleModalProps {
  mode: 'create' | 'edit';
  role?: Role;
  onSave: (data: Partial<Role>) => void;
  onClose: () => void;
}

const RoleModal: React.FC<RoleModalProps> = ({ mode, role, onSave, onClose }) => {
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [color, setColor] = useState(role?.color || 'blue');
  const [permissions, setPermissions] = useState<Role['permissions']>(
    role?.permissions || APP_MODULES.reduce((acc, m) => ({ ...acc, [m]: 'none' as PermissionLevel }), {} as Role['permissions'])
  );

  const isEdit = mode === 'edit';
  const isSystem = role?.isSystem;

  const setPermission = (module: AppModule, level: PermissionLevel) => {
    setPermissions(prev => ({ ...prev, [module]: level }));
  };

  const setAllPermission = (level: PermissionLevel) => {
    setPermissions(APP_MODULES.reduce((acc, m) => ({ ...acc, [m]: level }), {} as Role['permissions']));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSave({ name, description, color, permissions });
  };

  return (
    <Modal open onClose={onClose} overlayClassName="p-4 sm:p-6">
      <div className={`${modalPanel} w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            {isEdit ? <><Pencil size={18} className="text-purple-500" /> Rolü Düzenle</> : <><Plus size={18} className="text-purple-500" /> Yeni Rol</>}
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Rol adı + renk */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Rol Adı</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isSystem}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all disabled:opacity-60"
                placeholder="Örn: Laboratuvar Sorumlusu"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Renk</label>
              <div className="flex gap-1.5 flex-wrap">
                {ROLE_COLORS.map(c => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setColor(c.name)}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${color === c.name ? 'border-slate-800 scale-110' : 'border-transparent'} ${c.cls.split(' ')[0]}`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Açıklama */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Açıklama</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all"
              placeholder="Bu rolün yetkilerini kısaca açıklayın"
            />
          </div>

          {/* Yetki Matrisi */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase">Modül Yetkileri</label>
              <div className="flex gap-1">
                <button type="button" onClick={() => setAllPermission('view')} className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg">Tümünü Görüntüle</button>
                <button type="button" onClick={() => setAllPermission('none')} className="text-[10px] font-bold text-slate-500 hover:bg-slate-100 px-2 py-1 rounded-lg">Tümünü Kapat</button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
                <div className="col-span-5">Modül</div>
                <div className="col-span-7 grid grid-cols-3 gap-1">
                  {(Object.keys(PERMISSION_META) as PermissionLevel[]).map(level => (
                    <div key={level} className="text-center">{PERMISSION_META[level].label}</div>
                  ))}
                </div>
              </div>

              {/* Rows */}
              {APP_MODULES.map((module, idx) => (
                <div key={module} className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                  <div className="col-span-5">
                    <p className="text-sm font-medium text-slate-700">{MODULE_LABELS[module]}</p>
                  </div>
                  <div className="col-span-7 grid grid-cols-3 gap-1">
                    {(Object.keys(PERMISSION_META) as PermissionLevel[]).map(level => {
                      const isActive = permissions[module] === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setPermission(module, level)}
                          className={`py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            isActive
                              ? `${PERMISSION_META[level].color} bg-current/10 ring-1 ring-current/20`
                              : 'text-slate-300 hover:text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {PERMISSION_META[level].label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-purple-200 flex items-center justify-center gap-2 active:scale-95"
          >
            {isEdit ? <Check size={18} /> : <Plus size={18} />}
            {isEdit ? 'Değişiklikleri Kaydet' : 'Rolü Oluştur'}
          </button>
        </form>
      </div>
    </Modal>
  );
};
