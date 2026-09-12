import React, { useState, useMemo } from 'react';
import { ConfirmModal } from './ConfirmModal';
import {
  Users, UserPlus, Trash2, ShieldCheck, Key, Search, Loader2,
  Eye, EyeOff, CheckCircle2, UserCog, User, AlertTriangle
} from 'lucide-react';
import { User as UserType } from '../types';
import { storageService } from '../services/storageService';
import { hashPassword } from '../utils/security';

interface UserManagerProps {
  currentUser: UserType;
}

export const UserManager: React.FC<UserManagerProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<UserType[]>(() => storageService.getUsers());
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', fullName: '', role: 'user' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stats = useMemo(() => {
      return {
          total: users.length,
          admins: users.filter(u => u.role === 'super_admin').length,
          users: users.filter(u => u.role === 'user').length
      };
  }, [users]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.fullName) return;

    if (users.some(u => u.username === newUser.username)) {
      setErrorMsg("Bu kullanıcı adı zaten kullanılıyor.");
      return;
    }

    setIsSubmitting(true);

    try {
        const hashedPassword = await hashPassword(newUser.password);

        const createdUser: UserType = {
            id: Date.now().toString(),
            username: newUser.username,
            password: hashedPassword,
            fullName: newUser.fullName,
            role: newUser.role as 'user' | 'super_admin'
        };

        const updatedUsers = [...users, createdUser];
        setUsers(updatedUsers);
        storageService.saveUsers(updatedUsers);
        
        setIsCreating(false);
        setNewUser({ username: '', password: '', fullName: '', role: 'user' });
        setShowPassword(false);
    } catch (error) {
        console.error("User creation failed", error);
        setErrorMsg("Kullanıcı oluşturulurken bir hata oluştu.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      setErrorMsg("Kendi hesabınızı silemezsiniz.");
      return;
    }
    setDeleteConfirm(id);
  };

  const doDeleteUser = () => {
    if (!deleteConfirm) return;
    const updatedUsers = users.filter(u => u.id !== deleteConfirm);
    setUsers(updatedUsers);
    storageService.saveUsers(updatedUsers);
    setDeleteConfirm(null);
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-20 max-w-7xl mx-auto">
      
      {/* HEADER & STATS */}
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-lg shadow-slate-200">
                <Users size={24}/>
            </div>
            Kullanıcı Yönetimi
          </h2>
          <p className="text-slate-500 mt-2 text-base ml-16">Sisteme erişimi olan personelleri yönetin ve yetkilendirin.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-20 h-20 bg-blue-50 rounded-bl-full -mr-4 -mt-4"></div>
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center relative z-10">
                    <Users size={24} />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Toplam Personel</p>
                    <h3 className="text-2xl font-black text-slate-800">{stats.total}</h3>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-20 h-20 bg-purple-50 rounded-bl-full -mr-4 -mt-4"></div>
                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center relative z-10">
                    <ShieldCheck size={24} />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Yöneticiler</p>
                    <h3 className="text-2xl font-black text-slate-800">{stats.admins}</h3>
                </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-20 h-20 bg-emerald-50 rounded-bl-full -mr-4 -mt-4"></div>
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center relative z-10">
                    <User size={24} />
                </div>
                <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Standart Kullanıcılar</p>
                    <h3 className="text-2xl font-black text-slate-800">{stats.users}</h3>
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: CREATE USER FORM */}
        <div className={`lg:col-span-4 transition-all duration-300 ${isCreating ? 'block' : 'hidden lg:block'}`}>
             <div className="bg-white rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden lg:sticky lg:top-20">
                 <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                     <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <UserPlus size={20} className="text-blue-400"/> Yeni Personel
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Sisteme yeni bir kullanıcı ekleyin.</p>
                     </div>
                 </div>
                 
                 <form onSubmit={handleCreateUser} className="p-6 space-y-5">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Ad Soyad</label>
                            <div className="relative">
                                <UserCog className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    value={newUser.fullName}
                                    onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                                    className="w-full pl-10 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-3 bg-slate-50 focus:bg-white transition-all font-medium"
                                    placeholder="Örn: Ahmet Yılmaz"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Kullanıcı Adı</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type="text" 
                                    value={newUser.username}
                                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                                    className="w-full pl-10 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-3 bg-slate-50 focus:bg-white transition-all font-medium"
                                    placeholder="ahmet.yilmaz"
                                    autoComplete="off"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Şifre</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={newUser.password}
                                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                                    className="w-full pl-10 pr-10 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-3 bg-slate-50 focus:bg-white transition-all font-medium"
                                    placeholder="••••••"
                                    autoComplete="new-password"
                                    required
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Yetki Seviyesi</label>
                            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setNewUser({...newUser, role: 'user'})}
                                    className={`flex flex-col items-center justify-center py-3 rounded-lg text-xs font-bold transition-all ${newUser.role === 'user' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                                >
                                    <User size={18} className="mb-1"/>
                                    Personel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNewUser({...newUser, role: 'super_admin'})}
                                    className={`flex flex-col items-center justify-center py-3 rounded-lg text-xs font-bold transition-all ${newUser.role === 'super_admin' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}
                                >
                                    <ShieldCheck size={18} className="mb-1"/>
                                    Yönetici
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            disabled={isSubmitting} 
                            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <UserPlus size={18}/>}
                            {isSubmitting ? 'Oluşturuluyor...' : 'Kullanıcıyı Oluştur'}
                        </button>
                    </div>
                 </form>
             </div>
        </div>

        {/* RIGHT COLUMN: USER LIST */}
        <div className="lg:col-span-8 flex flex-col h-full">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
                {/* TOOLBAR */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700">Kayıtlı Kullanıcılar</span>
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-blue-200">{users.length}</span>
                    </div>
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input 
                                type="text" 
                                placeholder="İsim veya kullanıcı adı ara..." 
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-shadow"
                            />
                        </div>
                        <button 
                            onClick={() => setIsCreating(!isCreating)}
                            className="lg:hidden p-2 bg-slate-900 text-white rounded-xl shadow-sm hover:bg-slate-800"
                        >
                            <UserPlus size={18} />
                        </button>
                    </div>
                </div>

                {/* TABLE */}
                <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-slate-50/80 backdrop-blur text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 border-b border-slate-100">Personel Bilgisi</th>
                                <th className="px-6 py-4 border-b border-slate-100">Erişim Yetkisi</th>
                                <th className="px-6 py-4 border-b border-slate-100">Durum</th>
                                <th className="px-6 py-4 border-b border-slate-100 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map(user => {
                                    const isMe = user.id === currentUser.id;
                                    const isAdmin = user.role === 'super_admin';
                                    
                                    return (
                                        <tr key={user.id} className={`group transition-colors ${isMe ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white text-sm font-black shadow-sm ${isAdmin ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-blue-400 to-blue-600'}`}>
                                                        {user.fullName.substring(0, 1).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 flex items-center gap-2">
                                                            {user.fullName}
                                                            {isMe && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold border border-blue-200">SEN</span>}
                                                            {['admin', 'doktor', 'personel'].includes(user.username) && <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-medium border border-slate-200">Demo</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">@{user.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {isAdmin ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-purple-100 text-purple-600 rounded-lg">
                                                            <ShieldCheck size={14}/>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">Süper Admin</p>
                                                            <p className="text-[10px] text-slate-400">Tam Erişim</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-slate-100 text-slate-600 rounded-lg">
                                                            <User size={14}/>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">Personel</p>
                                                            <p className="text-[10px] text-slate-400">Kısıtlı Erişim</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 size={14} className="text-emerald-500"/>
                                                    <span className="text-xs font-medium text-slate-600">Aktif & Güvenli</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {!isMe && user.username !== 'admin' && (
                                                    <button 
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                                        title="Kullanıcıyı Sil"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
                                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                            <AlertTriangle size={24} className="opacity-20"/>
                                        </div>
                                        <p className="text-sm font-medium">Aradığınız kriterlere uygun kullanıcı bulunamadı.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      </div>

      {/* Confirm Modals */}
      <ConfirmModal
        open={deleteConfirm !== null}
        title="Kullanıcıyı Sil"
        message="Bu kullanıcıyı silmek istediğinize emin misiniz?"
        confirmLabel="Evet, Sil"
        onConfirm={doDeleteUser}
        onCancel={() => setDeleteConfirm(null)}
      />
      <ConfirmModal
        open={errorMsg !== null}
        title="Hata"
        message={errorMsg || ''}
        confirmLabel="Tamam"
        variant="warning"
        onConfirm={() => setErrorMsg(null)}
        onCancel={() => setErrorMsg(null)}
      />
    </div>
  );
};