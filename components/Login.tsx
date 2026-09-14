import React, { useState, useEffect } from 'react';
import {
  User, Lock, ArrowRight, AlertCircle, ShieldCheck, Timer,
  Stethoscope, Shield, Users, Eye, EyeOff, Database, HeartPulse, ChevronRight
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { hashPassword } from '../utils/security';
import { User as UserType } from '../types';

interface LoginProps {
  onLogin: (user: UserType) => void;
  onLoadDemoData?: () => void;
}

interface DemoAccountInfo {
  username: string;
  label: string;
  roleBadge: string;
  badgeColor: string;
  icon: React.ElementType;
}

const DEMO_PRESETS: DemoAccountInfo[] = [
  { username: 'admin', label: 'Yönetici', roleBadge: 'Tam Yetki', badgeColor: 'text-purple-600 bg-purple-50 border-purple-200', icon: Shield },
  { username: 'doktor', label: 'Dr. Mehmet Özkan', roleBadge: 'Hekim', badgeColor: 'text-blue-600 bg-blue-50 border-blue-200', icon: Stethoscope },
  { username: 'personel', label: 'Ayşe Demir', roleBadge: 'Mobil Ekip', badgeColor: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: Users },
];

export const Login: React.FC<LoginProps> = ({ onLogin, onLoadDemoData }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string>('admin');
  const [demoLoadedNotice, setDemoLoadedNotice] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  useEffect(() => {
    if (lockoutTime <= 0) return;
    const timer = setInterval(() => setLockoutTime(p => p - 1), 1000);
    return () => clearInterval(timer);
  }, [lockoutTime]);

  const executeLoginWithUser = async (targetUsername: string, targetPass: string) => {
    if (lockoutTime > 0) return;
    setError('');
    setIsLoading(true);
    try {
      const users = storageService.getUsers();
      const hashedPassword = await hashPassword(targetPass);
      const user = users.find(u => u.username.toLowerCase() === targetUsername.trim().toLowerCase());
      await new Promise(r => setTimeout(r, 400));
      if (user && user.password === hashedPassword) {
        if (user.active === false) { setIsLoading(false); setError('Bu hesap pasifleştirilmiş. Yöneticinizle iletişime geçin.'); return; }
        storageService.login(user);
        onLogin(user);
        setFailedAttempts(0);
      } else {
        const n = failedAttempts + 1;
        setFailedAttempts(n);
        setIsLoading(false);
        if (n >= 3) { setLockoutTime(30); setError('Çok fazla başarısız deneme. 30 saniye bekleyin.'); }
        else setError('Kullanıcı adı veya şifre hatalı.');
      }
    } catch { setError('Giriş yapılırken bir hata oluştu.'); setIsLoading(false); }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); executeLoginWithUser(username, password); };
  const selectDemo = (p: DemoAccountInfo) => { setUsername(p.username); setPassword('123'); setActiveDemo(p.username); setError(''); };
  const triggerDemoData = () => { if (onLoadDemoData) { onLoadDemoData(); setDemoLoadedNotice(true); setTimeout(() => setDemoLoadedNotice(false), 3000); } };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ═══ SOL: MARKA PANEL ═══ */}
      <div className="hidden lg:flex flex-col justify-between bg-slate-900 text-white p-12 relative overflow-hidden">
        {/* Dekoratif arka plan */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <HeartPulse size={22} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight leading-none">HanTech</h1>
              <p className="text-[10px] text-slate-400 mt-1">Mobil Sağlık Taraması</p>
            </div>
          </div>
        </div>

        {/* Ana mesaj */}
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-black leading-tight mb-4">
            Tekliften rapora<br />
            <span className="text-blue-400">tek platform.</span>
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            Firmalara fiyat teklifi hazırlayın, mobil tarama operasyonlarınızı planlayın ve laboratuvar PDF sonuçlarını yapay zeka ile saniyeler içinde okutun.
          </p>
        </div>

        {/* Alt bilgi */}
        <div className="relative z-10 flex items-center gap-6 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-blue-400" /> SHA-256 Güvenlik</span>
          <span className="flex items-center gap-1.5"><Database size={14} className="text-blue-400" /> Çevrimdışı Çalışır</span>
        </div>
      </div>

      {/* ═══ SAĞ: FORM PANEL ═══ */}
      <div className="flex flex-col justify-center bg-slate-50 p-6 sm:p-12 min-h-screen lg:min-h-0">
        <div className="w-full max-w-sm mx-auto">
          {/* Mobil logo */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white">
              <HeartPulse size={20} />
            </div>
            <h1 className="text-lg font-black text-slate-900">HanTech</h1>
          </div>

          {/* Başlık */}
          <div className="mb-8">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Giriş Yap</h2>
            <p className="text-slate-500 text-sm mt-1.5">Devam etmek için bilgilerinizi girin.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className={`flex items-center gap-2.5 p-3 border rounded-lg text-xs font-medium ${
                lockoutTime > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-600'
              }`}>
                {lockoutTime > 0 ? <Timer size={15} className="shrink-0" /> : <AlertCircle size={15} className="shrink-0" />}
                <span>{error}</span>
              </div>
            )}

            {/* Kullanıcı adı */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Kullanıcı Adı</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="text" value={username} autoFocus disabled={lockoutTime > 0} required
                  onChange={(e) => { setUsername(e.target.value); setActiveDemo(''); }}
                  placeholder="admin"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm text-slate-800 placeholder-slate-300 disabled:opacity-50"
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600">Şifre</label>
                <span className="text-[11px] text-slate-400">Demo: <strong className="text-slate-600">123</strong></span>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type={showPassword ? 'text' : 'password'} value={password} disabled={lockoutTime > 0} required
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm text-slate-800 placeholder-slate-300 disabled:opacity-50"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  title={showPassword ? 'Gizle' : 'Göster'}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Giriş butonu */}
            <button type="submit" disabled={isLoading || lockoutTime > 0}
              className={`w-full font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-sm ${
                lockoutTime > 0 ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20'
              }`}>
              {isLoading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : lockoutTime > 0 ? <span>{lockoutTime} sn bekleyin</span>
              : <>Giriş Yap <ArrowRight size={16} /></>}
            </button>
          </form>

          {/* Ayırıcı */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Hızlı Giriş</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* Demo hesaplar */}
          <div className="space-y-2">
            {DEMO_PRESETS.map((demo) => {
              const Icon = demo.icon;
              const isActive = activeDemo === demo.username;
              return (
                <button key={demo.username} type="button" onClick={() => selectDemo(demo)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                    isActive ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 truncate">{demo.label}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${demo.badgeColor}`}>{demo.roleBadge}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">@{demo.username}</span>
                  </div>
                  <ChevronRight size={16} className={`shrink-0 transition-colors ${isActive ? 'text-blue-500' : 'text-slate-300'}`} />
                </button>
              );
            })}
          </div>

          {/* Demo veri */}
          {onLoadDemoData && (
            <button type="button" onClick={triggerDemoData}
              className={`w-full mt-5 py-2.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                demoLoadedNotice ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}>
              <Database size={14} className={demoLoadedNotice ? 'text-emerald-500' : 'text-amber-500'} />
              {demoLoadedNotice ? 'Örnek Veriler Yüklendi' : 'Örnek Verileri Yükle'}
            </button>
          )}

          {/* Alt bilgi */}
          <p className="text-center text-[11px] text-slate-400 mt-8">
            HanTech OSGB · Mobil Sağlık Taraması Yönetim Platformu
          </p>
        </div>
      </div>
    </div>
  );
};
