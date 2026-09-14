import React, { useState, useEffect } from 'react';
import {
  User, Activity, Lock, ArrowRight, AlertCircle, ShieldCheck, Timer,
  Stethoscope, Shield, Users, Eye, EyeOff, Sparkles, Database, FileText, HeartPulse
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
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: Shield,
    description: 'Tüm firmalar, test havuzu, kullanıcı yönetimi ve sistem ayarları.'
  },
  {
    username: 'doktor',
    label: 'Dr. Mehmet Özkan',
    roleTitle: 'İşyeri Hekimi',
    roleBadge: 'Hekim / Onay',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Stethoscope,
    description: 'Sağlık taraması değerlendirmeleri, bulgu inceleme ve rapor onayları.'
  },
  {
    username: 'personel',
    label: 'Ayşe Demir',
    roleTitle: 'Sağlık Memuru',
    roleBadge: 'Mobil Ekip',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100/80 p-4">
      <div className="w-full max-w-4xl my-8">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12">

          {/* ═══ LEFT: BRAND & DEMO PANEL ═══ */}
          <div className="lg:col-span-5 p-7 md:p-9 flex flex-col justify-between bg-slate-50 border-b lg:border-b-0 lg:border-r border-slate-100">
            <div>
              {/* Logo */}
              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-blue-200">
                  <HeartPulse size={24} />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-800 leading-none">{storageService.getOrgInfo().name}</h1>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">{storageService.getOrgInfo().tagline || 'Mobil Sağlık Taraması Yönetim Platformu'}</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed mb-5">
                Firmalara fiyat teklifi hazırlayın, mobil tarama operasyonlarınızı planlayın ve laboratuvar PDF sonuçlarını yapay zeka ile saniyeler içinde okutun. Tekliften rapora — tek platform.
              </p>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-1.5 mb-7">
                {FEATURES.map(f => (
                  <span key={f.label} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg">
                    <f.icon size={12} className="text-blue-500" /> {f.label}
                  </span>
                ))}
              </div>

              {/* Demo accounts */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles size={12} className="text-amber-500" />
                    Hazır Demo Hesaplar
                  </span>
                  <span className="text-[10px] text-slate-400">Şifre: <strong className="text-slate-600">123</strong></span>
                </div>

                <div className="space-y-1.5">
                  {DEMO_PRESETS.map((demo) => {
                    const Icon = demo.icon;
                    const isSelected = activeDemo === demo.username;
                    return (
                      <div
                        key={demo.username}
                        className={`p-2.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
                        }`}
                        onClick={() => handleSelectDemo(demo)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              <Icon size={15} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800 truncate">{demo.label}</span>
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
                            className="px-2.5 py-1.5 text-[10px] font-bold bg-white hover:bg-blue-600 hover:text-white text-slate-600 rounded-lg transition-all flex items-center gap-1 shrink-0 border border-slate-200 hover:border-blue-600"
                            title="Bu hesap ile tek tıkla oturum aç"
                          >
                            Giriş <ArrowRight size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Demo data loader */}
            {onLoadDemoData && (
              <div className="mt-6 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleTriggerDemoData}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                    demoLoadedNotice
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-800'
                  }`}
                >
                  <Database size={14} className={demoLoadedNotice ? 'text-emerald-500' : 'text-amber-500'} />
                  {demoLoadedNotice ? '✓ Örnek Veriler Yüklendi!' : 'Örnek Firma & Tarama Verilerini Yükle'}
                </button>
              </div>
            )}
          </div>

          {/* ═══ RIGHT: LOGIN FORM ═══ */}
          <div className="lg:col-span-7 p-7 md:p-11 flex flex-col justify-center">
            <div className="mb-7">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                <Lock size={11} /> Sistem Girişi
              </span>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight mt-3">
                Tekrar hoş geldiniz
              </h2>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Kullanıcı bilgilerinizle giriş yapın veya soldaki demo hesaplardan birini seçin.
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              {error && (
                <div className={`flex items-center gap-2.5 p-3.5 border rounded-xl text-xs font-medium ${
                  lockoutTime > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                  {lockoutTime > 0 ? <Timer size={16} className="shrink-0"/> : <AlertCircle size={16} className="shrink-0"/>}
                  <span>{error}</span>
                </div>
              )}

              {/* Active profile chip */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span className="text-slate-500">Seçili Profil:</span>
                  <span className="font-bold text-slate-800">
                    {DEMO_PRESETS.find(p => p.username === activeDemo)?.label || username}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md font-semibold">
                  @{username}
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Kullanıcı Adı
                </label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={17} />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      setActiveDemo('');
                    }}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-800 placeholder-slate-400 disabled:opacity-50"
                    placeholder="Kullanıcı adınız (örn: admin)"
                    autoFocus
                    disabled={lockoutTime > 0}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 ml-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Şifre
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Demo: <span className="font-bold text-slate-700">123</span>
                  </span>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={17} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm font-medium text-slate-800 placeholder-slate-400 disabled:opacity-50"
                    placeholder="••••••••"
                    disabled={lockoutTime > 0}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    title={showPassword ? 'Şifreyi Gizle' : 'Şifreyi Göster'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <div className="pt-2.5">
                <button
                  type="submit"
                  disabled={isLoading || lockoutTime > 0}
                  className={`w-full font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-sm group ${
                    lockoutTime > 0
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200'
                  }`}
                >
                  {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : lockoutTime > 0 ? (
                    <span>Lütfen {lockoutTime} sn bekleyin</span>
                  ) : (
                    <>
                      <span>Giriş Yap</span>
                      <ArrowRight size={17} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-9 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-1.5 font-medium">
                <ShieldCheck size={14} className="text-blue-500" />
                <span>SHA-256 Şifreli Oturum</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-slate-300" />
                <span className="text-[11px] font-mono">v2.4.0</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
