import React, { useState, useEffect } from 'react';
import {
  User, Activity, Lock, ArrowRight, AlertCircle, ShieldCheck, Timer,
  Stethoscope, Shield, Users, Eye, EyeOff, Sparkles, Database, FileText, HeartPulse,
  ChevronRight, Zap
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
  roleTitle: string;
  roleBadge: string;
  badgeColor: string;
  icon: React.ElementType;
  description: string;
}

const DEMO_PRESETS: DemoAccountInfo[] = [
  {
    username: 'admin',
    label: 'Sistem Yöneticisi',
    roleTitle: 'Süper Admin',
    roleBadge: 'Tam Yetki',
    badgeColor: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
    icon: Shield,
    description: 'Tüm firmalar, test havuzu, kullanıcı yönetimi ve sistem ayarları.'
  },
  {
    username: 'doktor',
    label: 'Dr. Mehmet Özkan',
    roleTitle: 'İşyeri Hekimi',
    roleBadge: 'Hekim / Onay',
    badgeColor: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
    icon: Stethoscope,
    description: 'Sağlık taraması değerlendirmeleri, bulgu inceleme ve rapor onayları.'
  },
  {
    username: 'personel',
    label: 'Ayşe Demir',
    roleTitle: 'Sağlık Memuru',
    roleBadge: 'Mobil Ekip',
    badgeColor: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    icon: Users,
    description: 'Mobil tarama aracı veri girişi, PDF test aktarımı ve sonuç kontrolü.'
  }
];

const FEATURES = [
  { icon: Sparkles, label: 'AI Sonuç Okuma' },
  { icon: FileText, label: 'Teklif & Planlama' },
  { icon: Stethoscope, label: 'Mobil Tarama' },
  { icon: ShieldCheck, label: '%100 Çevrimdışı' }
];

export const Login: React.FC<LoginProps> = ({ onLogin, onLoadDemoData }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string>('admin');
  const [demoLoadedNotice, setDemoLoadedNotice] = useState(false);

  // Security State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  // Countdown timer for lockout
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (lockoutTime > 0) {
      timer = setInterval(() => {
        setLockoutTime(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutTime]);

  const executeLoginWithUser = async (targetUsername: string, targetPass: string) => {
    if (lockoutTime > 0) return;

    setError('');
    setIsLoading(true);

    try {
      const users = storageService.getUsers();
      const hashedPassword = await hashPassword(targetPass);
      const user = users.find(u => u.username.toLowerCase() === targetUsername.trim().toLowerCase());

      // Realistic small delay
      await new Promise(resolve => setTimeout(resolve, 400));

      if (user && user.password === hashedPassword) {
        if (user.active === false) {
          setIsLoading(false);
          setError('Bu hesap pasifleştirilmiş. Lütfen yöneticinizle iletişime geçin.');
          return;
        }
        storageService.login(user);
        onLogin(user);
        setFailedAttempts(0);
      } else {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        setIsLoading(false);

        if (newAttempts >= 3) {
          setLockoutTime(30);
          setError('Çok fazla başarısız deneme. Lütfen 30 saniye bekleyin.');
        } else {
          setError('Kullanıcı adı veya şifre hatalı.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Giriş yapılırken bir hata oluştu.');
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLoginWithUser(username, password);
  };

  // Select demo preset to fill form
  const handleSelectDemo = (preset: DemoAccountInfo) => {
    setUsername(preset.username);
    setPassword('123');
    setActiveDemo(preset.username);
    setError('');
  };

  // Direct 1-click login with demo account
  const handleDirectDemoLogin = (preset: DemoAccountInfo) => {
    handleSelectDemo(preset);
    executeLoginWithUser(preset.username, '123');
  };

  const handleTriggerDemoData = () => {
    if (onLoadDemoData) {
      onLoadDemoData();
      setDemoLoadedNotice(true);
      setTimeout(() => setDemoLoadedNotice(false), 3000);
    }
  };

  const selectedPreset = DEMO_PRESETS.find(p => p.username === activeDemo);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-5xl relative z-10">
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/20 border border-white/20 overflow-hidden grid grid-cols-1 lg:grid-cols-12">

          {/* ═══ LEFT: BRAND & DEMO PANEL ═══ */}
          <div className="lg:col-span-5 p-8 md:p-10 flex flex-col justify-between bg-gradient-to-b from-slate-900 to-indigo-950 text-white relative overflow-hidden">
            {/* Subtle pattern overlay */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M0%200h60v60H0z%22%20fill%3D%22none%22/%3E%3Cpath%20d%3D%22M30%200v60M0%2030h60%22%20stroke%3D%22%23ffffff%22%20stroke-opacity%3D%220.03%22/%3E%3C/svg%3E')] opacity-50" />

            <div className="relative">
              {/* Logo */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                  <HeartPulse size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight leading-none">HanTech</h1>
                  <p className="text-[11px] text-slate-400 font-medium mt-1.5">Mobil Sağlık Taraması Yönetim Platformu</p>
                </div>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed mb-8">
                Firmalara fiyat teklifi hazırlayın, mobil tarama operasyonlarınızı planlayın ve laboratuvar PDF sonuçlarını yapay zeka ile saniyeler içinde okutun.
              </p>

              {/* Feature pills */}
              <div className="grid grid-cols-2 gap-2 mb-8">
                {FEATURES.map(f => (
                  <div key={f.label} className="flex items-center gap-2.5 text-[11px] font-bold text-slate-300 bg-white/5 border border-white/10 px-3 py-2.5 rounded-xl backdrop-blur-sm">
                    <f.icon size={14} className="text-blue-400 shrink-0" />
                    <span className="truncate">{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Demo accounts */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Zap size={11} className="text-amber-400" />
                    Hazır Demo Hesaplar
                  </span>
                  <span className="text-[10px] text-slate-500">Şifre: <strong className="text-slate-300">123</strong></span>
                </div>

                <div className="space-y-2">
                  {DEMO_PRESETS.map((demo) => {
                    const Icon = demo.icon;
                    const isSelected = activeDemo === demo.username;
                    return (
                      <button
                        key={demo.username}
                        type="button"
                        onClick={() => handleSelectDemo(demo)}
                        className={`w-full p-3 rounded-xl border text-left transition-all duration-200 group ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500/40 shadow-lg shadow-blue-600/10'
                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-400'
                            }`}>
                              <Icon size={16} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white truncate">{demo.label}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${demo.badgeColor}`}>
                                  {demo.roleBadge}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">@{demo.username}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectDemoLogin(demo);
                            }}
                            disabled={isLoading || lockoutTime > 0}
                            className="px-3 py-1.5 text-[10px] font-bold bg-white/10 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-all flex items-center gap-1 shrink-0 border border-white/10 hover:border-blue-500 disabled:opacity-50"
                            title="Bu hesap ile tek tıkla oturum aç"
                          >
                            Giriş <ChevronRight size={11} />
                          </button>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Demo data loader */}
            {onLoadDemoData && (
              <div className="mt-6 pt-5 border-t border-white/10 relative">
                <button
                  type="button"
                  onClick={handleTriggerDemoData}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                    demoLoadedNotice
                      ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-300'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <Database size={15} className={demoLoadedNotice ? 'text-emerald-400' : 'text-amber-400'} />
                  {demoLoadedNotice ? 'Örnek Veriler Yüklendi' : 'Örnek Firma & Tarama Verilerini Yükle'}
                </button>
              </div>
            )}
          </div>

          {/* ═══ RIGHT: LOGIN FORM ═══ */}
          <div className="lg:col-span-7 p-8 md:p-12 flex flex-col justify-center bg-white">
            <div className="mb-8">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                <Lock size={11} /> Güvenli Giriş
              </span>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mt-4">
                Tekrar hoş geldiniz
              </h2>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Kullanıcı bilgilerinizle giriş yapın veya soldaki demo hesaplardan birini seçin.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              {error && (
                <div className={`flex items-center gap-3 p-4 border rounded-xl text-sm font-medium ${
                  lockoutTime > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                  {lockoutTime > 0 ? <Timer size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
                  <span>{error}</span>
                </div>
              )}

              {/* Active profile chip */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
                  <span className="text-slate-500">Seçili Profil:</span>
                  <span className="font-bold text-slate-800">
                    {selectedPreset?.label || username}
                  </span>
                </div>
                <span className="text-xs font-mono text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg font-semibold">
                  @{username}
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 ml-1">
                  Kullanıcı Adı
                </label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setActiveDemo('');
                    }}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-800 placeholder-slate-400 disabled:opacity-50"
                    placeholder="Kullanıcı adınız (örn: admin)"
                    autoFocus
                    disabled={lockoutTime > 0}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                    Şifre
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Demo: <span className="font-bold text-slate-700">123</span>
                  </span>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-800 placeholder-slate-400 disabled:opacity-50"
                    placeholder="••••••••"
                    disabled={lockoutTime > 0}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isLoading || lockoutTime > 0}
                  className={`w-full font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-sm group ${
                    lockoutTime > 0
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40'
                  }`}
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : lockoutTime > 0 ? (
                    <span>Lütfen {lockoutTime} sn bekleyin</span>
                  ) : (
                    <>
                      <span>Giriş Yap</span>
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-10 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2 font-medium">
                <ShieldCheck size={15} className="text-blue-500" />
                <span>SHA-256 Şifreli Oturum</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-slate-300" />
                <span className="text-xs font-mono">v2.4.0</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
