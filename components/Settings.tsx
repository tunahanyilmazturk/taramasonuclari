import React, { useRef, useState, useMemo } from 'react';
import { ConfirmModal } from './ConfirmModal';
import {
  Download, Upload, Trash2, Database, ShieldCheck, AlertTriangle, RefreshCw,
  FlaskConical, History, X, HardDrive, ServerCrash, Smartphone,
  Lock, Key, Search, Activity, UserCircle, FileSignature, Stethoscope, Save,
  Sparkles, Users, Building2, Palette, Sun, Moon, Type, Zap, PanelLeftClose, Rows3,
  Image as ImageIcon, FileImage, Phone, Mail, Globe, MapPin, Briefcase, Hash, UserCheck
} from 'lucide-react';
import { AppState, User, AuditLog, ReportSettings, OrgInfo, AppearanceSettings, SettingsTab } from '../types';
import { storageService } from '../services/storageService';
import { updateAppearance, ACCENTS } from '../services/appearance';
import { hashPassword } from '../utils/security';
import { AiSettings } from './AiSettings';
import { UserManager } from './UserManager';
import { resizeToBlob, getImageUrl, deleteImage } from '../services/logoStorage';

interface SettingsProps {
  fullState: AppState;
  onRestore: (state: AppState) => void;
  onReset: () => void;
  onLoadDemo: () => void;
  addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
  initialTab?: SettingsTab; // #/settings/<tab> veya eski #/users, #/ai deep-link'lerinden gelen sekme
  onNavigate?: (route: string) => void;
  onOrgSaved?: (org: OrgInfo) => void; // kurum bilgisi kaydedilince Layout'un canlı güncellenmesi için
}

// İkonlu etiket + input wrapper
const Field: React.FC<{ label: string; icon: React.ComponentType<{ size?: number; className?: string }>; required?: boolean; children: React.ReactNode }> = ({ label, icon: Icon, required, children }) => (
  <div>
    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
      <Icon size={11} /> {label}{required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
        <Icon size={15} />
      </span>
      {children}
    </div>
  </div>
);

export const Settings: React.FC<SettingsProps> = ({ fullState, onRestore, onReset, onLoadDemo, addNotification, initialTab, onNavigate, onOrgSaved }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');
  // Sekme URL'den kontrol edilir (initialTab) — yoksa iç state'e düşer
  const [internalTab, setInternalTab] = useState<SettingsTab>(initialTab ?? 'system');
  const activeTab = initialTab ?? internalTab;

  // Auth & Logs
  const [currentUser, setCurrentUser] = useState<User | null>(storageService.getCurrentUser());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => (initialTab === 'logs' ? storageService.getLogs() : []));
  const [logSearch, setLogSearch] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('all');
  const [logSeverityFilter, setLogSeverityFilter] = useState<string>('all');
  const [logDateFilter, setLogDateFilter] = useState<string>('all');

  // Password Change State
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  // Profile Form State
  const [profileForm, setProfileForm] = useState({
    fullName: currentUser?.fullName || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    jobTitle: currentUser?.jobTitle || ''
  });
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; action: () => void } | null>(null);

  // Global Rapor Ayarları (tüm firmaların çıktılarında ortak antet/imza)
  const [reportForm, setReportForm] = useState<ReportSettings>(() => storageService.getReportSettings());

  // Kurum bilgileri — antet, imza ve marka gösteriminde kullanılır
  const [orgForm, setOrgForm] = useState<OrgInfo>(() => storageService.getOrgInfo());
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [sigUploading, setSigUploading] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const sigInputRef = React.useRef<HTMLInputElement>(null);

  // Logo ve imza görüntülerini yükle
  React.useEffect(() => {
    let cancelled = false;
    const loadImages = async () => {
      if (orgForm.logoKey) {
        const url = await getImageUrl(orgForm.logoKey);
        if (!cancelled && url) setLogoUrl(url);
      } else if (!cancelled) {
        setLogoUrl(null);
      }
      if (orgForm.signatureKey) {
        const url = await getImageUrl(orgForm.signatureKey);
        if (!cancelled && url) setSignatureUrl(url);
      } else if (!cancelled) {
        setSignatureUrl(null);
      }
    };
    loadImages();
    return () => { cancelled = true; };
  }, [orgForm.logoKey, orgForm.signatureKey]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { addNotification('error', 'Lütfen bir görsel dosyası seçin.'); return; }
    setLogoUploading(true);
    try {
      const blob = await resizeToBlob(file, 400);
      if (!blob) throw new Error('Boyutlandırma başarısız');
      const key = 'org_logo';
      await deleteImage(key); // eskisini sil
      const { saveImage } = await import('../services/logoStorage');
      await saveImage(key, blob);
      setOrgForm(p => ({ ...p, logoKey: key }));
      addNotification('success', 'Logo yüklendi. Kaydet butonuna basın.');
    } catch (err) {
      console.error(err);
      addNotification('error', 'Logo yüklenirken hata oluştu.');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { addNotification('error', 'Lütfen bir görsel dosyası seçin.'); return; }
    setSigUploading(true);
    try {
      const blob = await resizeToBlob(file, 300);
      if (!blob) throw new Error('Boyutlandırma başarısız');
      const key = 'org_signature';
      await deleteImage(key);
      const { saveImage } = await import('../services/logoStorage');
      await saveImage(key, blob);
      setOrgForm(p => ({ ...p, signatureKey: key }));
      addNotification('success', 'İmza yüklendi. Kaydet butonuna basın.');
    } catch (err) {
      console.error(err);
      addNotification('error', 'İmza yüklenirken hata oluştu.');
    } finally {
      setSigUploading(false);
      if (sigInputRef.current) sigInputRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (orgForm.logoKey) await deleteImage(orgForm.logoKey);
    setOrgForm(p => ({ ...p, logoKey: undefined }));
    setLogoUrl(null);
  };

  const handleRemoveSignature = async () => {
    if (orgForm.signatureKey) await deleteImage(orgForm.signatureKey);
    setOrgForm(p => ({ ...p, signatureKey: undefined }));
    setSignatureUrl(null);
  };

  // Görünüm ayarları — değişiklik anında uygulanır + kaydedilir
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => storageService.getAppearance());
  const updateAppearancePref = (patch: Partial<AppearanceSettings>) => setAppearance(updateAppearance(patch));

  const saveOrg = () => {
      const cleaned = { ...orgForm, name: orgForm.name.trim() || 'HanTech OSGB' };
      storageService.saveOrgInfo(cleaned);
      setOrgForm(cleaned);
      onOrgSaved?.(cleaned);
      if (currentUser) storageService.addLog(currentUser, 'ORG_UPDATE', 'Kurum bilgileri güncellendi.', { category: 'system', severity: 'info' });
      addNotification('success', 'Kurum bilgileri kaydedildi — antet ve marka alanları güncellendi.');
  };

  const handleTabChange = (tab: SettingsTab) => {
      setInternalTab(tab);
      if (tab === 'logs') {
          setAuditLogs(storageService.getLogs());
      }
      onNavigate?.(`settings/${tab}`); // sekmeyi URL'ye yansıt — yenilemede/paylaşımda korunur
  };

  // --- STORAGE CALCULATION ---
  const storageStats = useMemo(() => {
      const jsonString = JSON.stringify(fullState);
      const bytes = new Blob([jsonString]).size;
      const kb = (bytes / 1024).toFixed(2);
      
      // LocalStorage limit is typically around 5MB (5242880 bytes)
      const limit = 5 * 1024 * 1024; 
      const percentage = Math.min(100, (bytes / limit) * 100);
      
      let color = 'bg-blue-500';
      if (percentage > 60) color = 'bg-orange-500';
      if (percentage > 90) color = 'bg-red-500';

      return { kb, percentage, color, bytes, limitStr: '5 MB' };
  }, [fullState]);

  const handleBackup = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullState, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `HanTech_Yedek_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      if(currentUser) storageService.addLog(currentUser, 'BACKUP', 'Sistem yedeği indirildi.', { category: 'system', severity: 'info' });
      addNotification('success', 'Yedekleme dosyası indirildi.');
    } catch {
      addNotification('error', 'Yedekleme oluşturulurken hata oluştu.');
    }
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.companies || !json.tests || !json.records) {
          throw new Error("Geçersiz yedek dosyası formatı.");
        }
        setConfirmAction({
            title: 'Verileri Geri Yükle',
            message: 'Mevcut verilerin üzerine yazılacak. Devam etmek istiyor musunuz?',
            action: () => {
                onRestore(json);
                if(currentUser) storageService.addLog(currentUser, 'RESTORE', 'Sistem yedeği geri yüklendi.', { category: 'system', severity: 'warning' });
                addNotification('success', 'Veriler başarıyla geri yüklendi.');
            }
        });
      } catch (err) {
        console.error(err);
        addNotification('error', 'Dosya okunamadı veya format hatalı.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleFactoryResetConfirm = () => {
      if (resetConfirmationText === 'SIFIRLA') {
          if(currentUser) storageService.addLog(currentUser, 'RESET', 'Fabrika ayarlarına dönüldü.', { category: 'system', severity: 'danger' });
          onReset();
          addNotification('info', 'Sistem sıfırlandı.');
          setShowResetConfirm(false);
          setResetConfirmationText('');
      } else {
          addNotification('error', 'Hatalı doğrulama metni.');
      }
  };

  const handleClearLogs = () => {
      setConfirmAction({
          title: 'Kayıtları Temizle',
          message: 'Tüm işlem kayıtları silinecek. Emin misiniz?',
          action: () => {
              storageService.clearLogs();
              setAuditLogs([]);
              addNotification('success', 'İşlem kütüğü temizlendi.');
          }
      });
  };

  const handleSaveProfile = () => {
      if (!currentUser) return;
      const cleaned = { ...profileForm, fullName: profileForm.fullName.trim() || currentUser.fullName };
      setProfileForm(cleaned);
      const allUsers = storageService.getUsers();
      const updatedUsers = allUsers.map(u => u.id === currentUser.id ? { ...u, ...cleaned } : u);
      storageService.saveUsers(updatedUsers);
      const updatedUser = { ...currentUser, ...cleaned };
      storageService.login(updatedUser);
      setCurrentUser(updatedUser);
      storageService.addLog(currentUser, 'PROFILE_UPDATE', 'Profil bilgileri güncellendi.', { category: 'user', severity: 'info' });
      addNotification('success', 'Profil bilgileriniz kaydedildi.');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentUser) return;
      if (passData.new !== passData.confirm) {
          addNotification('error', 'Yeni şifreler uyuşmuyor.');
          return;
      }
      if (passData.new.length < 4) {
          addNotification('error', 'Şifre çok kısa.');
          return;
      }

      // Verify old password
      const oldHash = await hashPassword(passData.current);
      if (oldHash !== currentUser.password) {
          addNotification('error', 'Mevcut şifre hatalı.');
          return;
      }

      // Update
      const newHash = await hashPassword(passData.new);
      const allUsers = storageService.getUsers();
      const updatedUsers = allUsers.map(u => u.id === currentUser.id ? { ...u, password: newHash } : u);
      
      storageService.saveUsers(updatedUsers);
      
      // Update session
      const updatedUser = { ...currentUser, password: newHash };
      storageService.login(updatedUser);
      setCurrentUser(updatedUser);
      
      storageService.addLog(currentUser, 'PASSWORD_CHANGE', 'Kullanıcı şifresini değiştirdi.', { category: 'user', severity: 'warning' });
      addNotification('success', 'Şifreniz güncellendi.');
      setPassData({ current: '', new: '', confirm: '' });
  };

  const handleSaveReportSettings = () => {
      storageService.saveReportSettings(reportForm);
      if (currentUser) storageService.addLog(currentUser, 'SETTINGS', 'Global rapor ayarları güncellendi.', { category: 'system', severity: 'info' });
      addNotification('success', 'Rapor ayarları kaydedildi.');
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchSearch = log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.username.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(logSearch.toLowerCase());
    const matchCategory = logCategoryFilter === 'all' || (log.category || 'system') === logCategoryFilter;
    const matchSeverity = logSeverityFilter === 'all' || (log.severity || 'info') === logSeverityFilter;
    let matchDate = true;
    if (logDateFilter !== 'all') {
      const logDate = new Date(log.timestamp);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const logDay = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
      const diffDays = Math.floor((today.getTime() - logDay.getTime()) / (1000 * 60 * 60 * 24));
      if (logDateFilter === 'today') matchDate = diffDays === 0;
      else if (logDateFilter === 'week') matchDate = diffDays <= 7;
      else if (logDateFilter === 'month') matchDate = diffDays <= 30;
    }
    return matchSearch && matchCategory && matchSeverity && matchDate;
  });

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="mb-8">
          <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-3 bg-slate-900 rounded-2xl text-white shadow-lg shadow-slate-200">
                 <Database size={24} />
            </div>
            Ayarlar
          </h2>
          <p className="text-slate-500 mt-2 text-base ml-16">
            Veri yönetimi, AI yapılandırması, güvenlik ve sistem günlükleri.
          </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* SIDEBAR — bölüm menüsü */}
      <aside className="w-full lg:w-60 shrink-0">
        <div className="bg-white border border-slate-200 rounded-2xl p-2 lg:sticky lg:top-20 flex lg:flex-col gap-1 overflow-x-auto">
          {[
              { id: 'profile', icon: UserCircle, label: 'Profilim', desc: 'Kişisel bilgiler' },
              { id: 'system', icon: HardDrive, label: 'Sistem & Veri', desc: 'Depolama, yedek, rapor' },
              { id: 'org', icon: Building2, label: 'Kurum Bilgileri', desc: 'Antet, iletişim, imza' },
              { id: 'appearance', icon: Palette, label: 'Görünüm', desc: 'Tema, renk, yoğunluk' },
              { id: 'ai', icon: Sparkles, label: 'AI & API', desc: 'Sağlayıcı, anahtar, modeller' },
              { id: 'users', icon: Users, label: 'Kullanıcılar', desc: 'Hesap & rol yönetimi', adminOnly: true },
              { id: 'security', icon: ShieldCheck, label: 'Güvenlik', desc: 'Şifre, oturum' },
              { id: 'logs', icon: History, label: 'İşlem Kayıtları', desc: 'Audit log', adminOnly: true }
          ].map(tab => {
              if (tab.adminOnly && currentUser?.role !== 'super_admin') return null;
              const isActive = activeTab === tab.id;
              return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id as SettingsTab)}
                    className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl transition-all shrink-0 lg:shrink ${
                        isActive
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                      <tab.icon size={17} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                      <div className="min-w-0">
                        <p className={`text-sm font-bold leading-tight ${isActive ? 'text-white' : 'text-slate-700'}`}>{tab.label}</p>
                        <p className={`text-[10px] leading-tight hidden lg:block ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>{tab.desc}</p>
                      </div>
                  </button>
              )
          })}
        </div>
      </aside>

      {/* CONTENT AREA */}
      <div className="flex-1 min-w-0 bg-white rounded-3xl shadow-sm border border-slate-200 p-1 min-h-[500px]">

          {/* --- PROFILE TAB --- */}
          {activeTab === 'profile' && (
              <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-3xl">
                  <div className="mb-6">
                      <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><UserCircle size={18} className="text-blue-600"/> Profilim</h3>
                      <p className="text-xs text-slate-500 mt-1">Kayıtlı kişisel bilgilerinizi düzenleyin. Bu bilgiler kayıt oluştururken ve raporlarda kullanılır.</p>
                  </div>

                  <div className="space-y-5">
                      {/* Profil kartı */}
                      <section className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl border border-blue-100 p-5">
                          <div className="flex items-center gap-4">
                              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-md shrink-0 ${currentUser?.role === 'super_admin' ? 'bg-gradient-to-br from-purple-500 to-indigo-600' : 'bg-gradient-to-br from-blue-500 to-blue-600'}`}>
                                  {currentUser?.fullName.substring(0, 1).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                  <p className="font-black text-slate-800 text-lg truncate">{currentUser?.fullName}</p>
                                  <p className="text-sm text-slate-500 font-mono">@{currentUser?.username}</p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${currentUser?.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                          {currentUser?.role === 'super_admin' ? 'Yönetici' : 'Personel'}
                                      </span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase flex items-center gap-1">
                                          <Activity size={9}/> Aktif
                                      </span>
                                  </div>
                              </div>
                          </div>
                      </section>

                      {/* Kişisel bilgiler formu */}
                      <section className="bg-white rounded-2xl border border-slate-200 p-5">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Kişisel Bilgiler</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Field label="Ad Soyad" icon={UserCircle} required>
                                  <input type="text" value={profileForm.fullName} onChange={e => setProfileForm(p => ({ ...p, fullName: e.target.value }))}
                                      placeholder="Ad Soyad"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="Görev / Ünvan" icon={Briefcase}>
                                  <input type="text" value={profileForm.jobTitle} onChange={e => setProfileForm(p => ({ ...p, jobTitle: e.target.value }))}
                                      placeholder="ör. İşyeri Hekimi"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="E-posta" icon={Mail}>
                                  <input type="email" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))}
                                      placeholder="ad@kurum.com"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="Telefon" icon={Phone}>
                                  <input type="tel" value={profileForm.phone} onChange={e => setProfileForm(p => ({ ...p, phone: e.target.value }))}
                                      placeholder="05XX XXX XX XX"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                          </div>
                          <div className="mt-5 flex items-center gap-3">
                              <button onClick={handleSaveProfile}
                                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95">
                                  <Save size={15}/> Kaydet
                              </button>
                              <button onClick={() => setProfileForm({ fullName: currentUser?.fullName || '', email: currentUser?.email || '', phone: currentUser?.phone || '', jobTitle: currentUser?.jobTitle || '' })}
                                  className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl px-3.5 py-2.5 transition-colors">
                                  Sıfırla
                              </button>
                          </div>
                      </section>

                      {/* Hesap bilgileri (salt okunur) */}
                      <section className="bg-white rounded-2xl border border-slate-200 p-5">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Hesap Bilgileri</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                  <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center text-slate-500 shrink-0"><UserCircle size={16}/></div>
                                  <div className="min-w-0">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase">Kullanıcı Adı</p>
                                      <p className="text-sm font-bold text-slate-700 font-mono truncate">{currentUser?.username}</p>
                                  </div>
                              </div>
                              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${currentUser?.role === 'super_admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                      <ShieldCheck size={16}/>
                                  </div>
                                  <div className="min-w-0">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase">Yetki Seviyesi</p>
                                      <p className="text-sm font-bold text-slate-700">{currentUser?.role === 'super_admin' ? 'Yönetici' : 'Personel'}</p>
                                  </div>
                              </div>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-3">Kullanıcı adı ve yetki seviyesi yöneticiler tarafından değiştirilebilir. Şifrenizi <button onClick={() => handleTabChange('security')} className="text-blue-600 font-bold underline">Güvenlik</button> sekmesinden değiştirebilirsiniz.</p>
                      </section>
                  </div>
              </div>
          )}

          {/* --- SYSTEM TAB --- */}
          {activeTab === 'system' && (
              <div className="p-6 md:p-8 space-y-8 animate-in slide-in-from-bottom-4 duration-300">

                  {/* ── SİSTEM DURUMU — yatay şerit ── */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Depolama */}
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                          <div className="flex items-center gap-2 mb-3">
                              <HardDrive size={16} className="text-blue-500"/>
                              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Depolama</h4>
                          </div>
                          <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden mb-2">
                              <div className={`h-full rounded-full transition-all duration-1000 ${storageStats.color}`} style={{ width: `${storageStats.percentage}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                              <span>{storageStats.kb} KB</span>
                              <span>Limit: {storageStats.limitStr}</span>
                          </div>
                      </div>
                      {/* Bağlantı */}
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                          <div className="flex items-center gap-2 mb-3">
                              <Activity size={16} className="text-emerald-500"/>
                              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Bağlantı</h4>
                          </div>
                          <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              <span className="text-sm font-bold text-slate-700">{navigator.onLine ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1">Veriler tarayıcı hafızasında saklanır.</p>
                      </div>
                      {/* Uygulama */}
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                          <div className="flex items-center gap-2 mb-3">
                              <Smartphone size={16} className="text-slate-500"/>
                              <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Uygulama</h4>
                          </div>
                          <p className="text-sm font-black text-slate-800 truncate">{orgForm.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded border border-slate-200">v1.0.3</span>
                              <span className="text-[10px] text-slate-400 truncate">{orgForm.tagline || 'Mobil Sağlık Platformu'}</span>
                          </div>
                      </div>
                  </div>

                  {/* ── VERİ OPERASYONLARI ── */}
                  <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                          <RefreshCw size={16} className="text-slate-400"/> Veri Operasyonları
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <button
                              onClick={handleBackup}
                              className="group flex flex-col items-center text-center p-6 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:ring-1 hover:ring-blue-500 transition-all shadow-sm hover:shadow-md"
                          >
                              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                  <Download size={24}/>
                              </div>
                              <h4 className="font-bold text-slate-800">Yedekle</h4>
                              <p className="text-xs text-slate-500 mt-1 px-2">Tüm sistemi JSON indir.</p>
                          </button>
                          <button
                              onClick={handleRestoreClick}
                              className="group flex flex-col items-center text-center p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500 transition-all shadow-sm hover:shadow-md relative"
                          >
                              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
                              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                  <Upload size={24}/>
                              </div>
                              <h4 className="font-bold text-slate-800">Geri Yükle</h4>
                              <p className="text-xs text-slate-500 mt-1 px-2">Yedekten verileri kurtar.</p>
                          </button>
                          <button
                              onClick={() => {
                                  setConfirmAction({
                                      title: 'Demo Veri Yükle',
                                      message: 'Mevcut verilerin üzerine Demo verileri eklenecek. Devam edilsin mi?',
                                      action: () => {
                                          onLoadDemo();
                                          if(currentUser) storageService.addLog(currentUser, 'DEMO_LOAD', 'Örnek veriler yüklendi.', { category: 'data', severity: 'info' });
                                      }
                                  });
                              }}
                              className="group flex flex-col items-center text-center p-6 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all shadow-sm hover:shadow-md"
                          >
                              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                  <FlaskConical size={24}/>
                              </div>
                              <h4 className="font-bold text-slate-800">Demo Veri</h4>
                              <p className="text-xs text-slate-500 mt-1 px-2">Sistemi test et, örnek yükle.</p>
                          </button>
                      </div>
                  </div>

                  {/* ── RAPOR AYARLARI ── */}
                  <div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                          <FileSignature size={16} className="text-slate-400"/> Rapor Ayarları
                      </h3>
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                          <p className="text-xs text-slate-500 mb-5">
                              Hasta raporlarının üst başlığı ve imza blokları buradan tüm firmalar için ortak ayarlanır.
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Rapor Üst Başlığı</label>
                                  <input
                                      type="text"
                                      value={reportForm.title ?? ''}
                                      onChange={(e) => setReportForm(prev => ({ ...prev, title: e.target.value }))}
                                      className="w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all"
                                      placeholder="SAĞLIK TARAMASI RAPORU"
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide"><Stethoscope size={10} className="inline mr-1"/>İşyeri Hekimi</label>
                                  <input
                                      type="text"
                                      value={reportForm.doctorName ?? ''}
                                      onChange={(e) => setReportForm(prev => ({ ...prev, doctorName: e.target.value }))}
                                      className="w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all"
                                      placeholder="Dr. Adı Soyadı"
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Hekim Unvanı</label>
                                  <input
                                      type="text"
                                      value={reportForm.doctorTitle ?? ''}
                                      onChange={(e) => setReportForm(prev => ({ ...prev, doctorTitle: e.target.value }))}
                                      className="w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all"
                                      placeholder="İşyeri Hekimi"
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide"><ShieldCheck size={10} className="inline mr-1"/>Lab. Sorumlusu</label>
                                  <input
                                      type="text"
                                      value={reportForm.labTechName ?? ''}
                                      onChange={(e) => setReportForm(prev => ({ ...prev, labTechName: e.target.value }))}
                                      className="w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all"
                                      placeholder="Lab. Sorumlusu Adı"
                                  />
                              </div>
                              <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Lab. Unvanı</label>
                                  <input
                                      type="text"
                                      value={reportForm.labTechTitle ?? ''}
                                      onChange={(e) => setReportForm(prev => ({ ...prev, labTechTitle: e.target.value }))}
                                      className="w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all"
                                      placeholder="Laboratuvar Sorumlusu"
                                  />
                              </div>
                          </div>
                          <div className="flex justify-end mt-5">
                              <button
                                  onClick={handleSaveReportSettings}
                                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95"
                              >
                                  <Save size={14}/> Kaydet
                              </button>
                          </div>
                      </div>
                  </div>

                  {/* ── TEHLİKELİ BÖLGE ── */}
                  <div>
                      <h3 className="text-sm font-bold text-red-600 uppercase tracking-widest flex items-center gap-2 mb-4">
                          <AlertTriangle size={16}/> Tehlikeli Bölge
                      </h3>
                      <div className={`border rounded-2xl p-6 transition-all ${showResetConfirm ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-white border-slate-200'}`}>
                          {!showResetConfirm ? (
                              <div className="flex items-center justify-between">
                                  <div>
                                      <h4 className="font-bold text-slate-800">Fabrika Ayarlarına Dön</h4>
                                      <p className="text-xs text-slate-500 mt-1">Tüm veriler kalıcı olarak silinecektir.</p>
                                  </div>
                                  <button
                                      onClick={() => setShowResetConfirm(true)}
                                      className="px-5 py-2 bg-white border border-red-200 text-red-600 font-bold text-sm rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                  >
                                      <Trash2 size={16} className="inline mr-2"/>
                                      Sıfırla
                                  </button>
                              </div>
                          ) : (
                              <div className="text-center animate-in zoom-in-95 duration-200">
                                  <ServerCrash size={32} className="text-red-500 mx-auto mb-3" />
                                  <h4 className="font-bold text-red-900 mb-1">Emin misiniz?</h4>
                                  <p className="text-sm text-red-700 mb-4">Onaylamak için kutuya <span className="font-bold">SIFIRLA</span> yazın.</p>
                                  <div className="flex gap-2 max-w-sm mx-auto">
                                      <input
                                          type="text"
                                          className="flex-1 border-red-300 rounded-xl text-center font-bold text-sm uppercase focus:ring-red-500 focus:border-red-500"
                                          placeholder="SIFIRLA"
                                          value={resetConfirmationText}
                                          onChange={(e) => setResetConfirmationText(e.target.value)}
                                          autoFocus
                                      />
                                      <button
                                          onClick={handleFactoryResetConfirm}
                                          disabled={resetConfirmationText !== 'SIFIRLA'}
                                          className="px-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                          Onayla
                                      </button>
                                      <button
                                          onClick={() => { setShowResetConfirm(false); setResetConfirmationText(''); }}
                                          className="p-2.5 bg-white border border-red-200 text-red-400 rounded-xl hover:text-red-600"
                                      >
                                          <X size={18}/>
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

              </div>
          )}

          {/* --- KURUM BİLGİLERİ TAB --- */}
          {activeTab === 'org' && (
              <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-4xl">
                  <div className="mb-6">
                      <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Building2 size={18} className="text-blue-600"/> Kurum Bilgileri</h3>
                      <p className="text-xs text-slate-500 mt-1">Bu bilgiler teklif/rapor antetlerinde, imza bloklarında, PDF çıktılarında ve uygulama markasında kullanılır.</p>
                  </div>

                  <div className="space-y-5">
                      {/* ── 1. Logo & Marka ── */}
                      <section className="bg-white rounded-2xl border border-slate-200 p-5">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-1.5"><ImageIcon size={13}/> Logo & Marka</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                              {/* Logo yükleme */}
                              <div>
                                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">Kurum Logosu</label>
                                  <div className="flex items-center gap-3">
                                      <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
                                          {logoUploading ? (
                                              <RefreshCw size={20} className="text-slate-400 animate-spin" />
                                          ) : logoUrl ? (
                                              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                          ) : (
                                              <ImageIcon size={24} className="text-slate-300" />
                                          )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                                          <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                                              className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors mb-1.5 flex items-center gap-1.5">
                                              <Upload size={13}/> {logoUrl ? 'Değiştir' : 'Yükle'}
                                          </button>
                                          {logoUrl && (
                                              <button onClick={handleRemoveLogo} className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors flex items-center gap-1.5">
                                                  <Trash2 size={13}/> Kaldır
                                              </button>
                                          )}
                                          <p className="text-[10px] text-slate-400 mt-1.5">PNG/JPG, maks 400px. Şeffaf arka plan önerilir.</p>
                                      </div>
                                  </div>
                              </div>

                              {/* İmza görüntüsü */}
                              <div>
                                  <label className="block text-[11px] font-bold text-slate-400 uppercase mb-2">İmza Görüntüsü</label>
                                  <div className="flex items-center gap-3">
                                      <div className="w-32 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
                                          {sigUploading ? (
                                              <RefreshCw size={20} className="text-slate-400 animate-spin" />
                                          ) : signatureUrl ? (
                                              <img src={signatureUrl} alt="İmza" className="w-full h-full object-contain" />
                                          ) : (
                                              <FileImage size={24} className="text-slate-300" />
                                          )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <input ref={sigInputRef} type="file" accept="image/*" onChange={handleSignatureUpload} className="hidden" />
                                          <button onClick={() => sigInputRef.current?.click()} disabled={sigUploading}
                                              className="text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors mb-1.5 flex items-center gap-1.5">
                                              <Upload size={13}/> {signatureUrl ? 'Değiştir' : 'Yükle'}
                                          </button>
                                          {signatureUrl && (
                                              <button onClick={handleRemoveSignature} className="text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg px-3 py-2 transition-colors flex items-center gap-1.5">
                                                  <Trash2 size={13}/> Kaldır
                                              </button>
                                          )}
                                          <p className="text-[10px] text-slate-400 mt-1.5">Şeffaf PNG. İmza bloklarında kullanılır.</p>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </section>

                      {/* ── 2. Antet Önizleme ── */}
                      <section className="bg-white rounded-2xl border border-slate-200 p-5">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Antet Önizleme (PDF/Teklif)</h4>
                          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                              <div className="flex items-center justify-between gap-4 pb-4 border-b-2 border-slate-100">
                                  <div className="flex items-center gap-3 min-w-0">
                                      {logoUrl ? (
                                          <img src={logoUrl} alt="Logo" className="w-14 h-14 object-contain shrink-0" />
                                      ) : (
                                          <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center text-white shrink-0">
                                              <Activity size={24} />
                                          </div>
                                      )}
                                      <div className="min-w-0">
                                          <p className="font-black text-slate-800 text-base truncate">{orgForm.name || 'HanTech OSGB'}</p>
                                          <p className="text-[11px] text-slate-500 truncate">{orgForm.tagline || 'Mobil Sağlık Hizmetleri'}</p>
                                      </div>
                                  </div>
                                  <div className="text-right text-[10px] text-slate-500 shrink-0">
                                      {orgForm.phone && <p className="flex items-center gap-1 justify-end"><Phone size={9}/>{orgForm.phone}</p>}
                                      {orgForm.email && <p className="flex items-center gap-1 justify-end"><Mail size={9}/>{orgForm.email}</p>}
                                      {orgForm.web && <p className="flex items-center gap-1 justify-end"><Globe size={9}/>{orgForm.web}</p>}
                                  </div>
                              </div>
                              {orgForm.address && <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1"><MapPin size={9}/>{orgForm.address}</p>}
                          </div>
                      </section>

                      {/* ── 3. Kurum Kimliği ── */}
                      <section className="bg-white rounded-2xl border border-slate-200 p-5">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Kurum Kimliği</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Field label="Kurum Adı *" icon={Building2} required>
                                  <input type="text" value={orgForm.name} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))}
                                      placeholder="ör. HanTech OSGB"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="Kısa Açıklama / Slogan" icon={Sparkles}>
                                  <input type="text" value={orgForm.tagline ?? ''} onChange={e => setOrgForm(p => ({ ...p, tagline: e.target.value }))}
                                      placeholder="ör. Mobil Sağlık Hizmetleri"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                          </div>
                      </section>

                      {/* ── 4. İletişim ── */}
                      <section className="bg-white rounded-2xl border border-slate-200 p-5">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">İletişim Bilgileri</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Field label="Telefon" icon={Phone}>
                                  <input type="text" value={orgForm.phone ?? ''} onChange={e => setOrgForm(p => ({ ...p, phone: e.target.value }))}
                                      placeholder="0850 000 00 00"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="E-posta" icon={Mail}>
                                  <input type="email" value={orgForm.email ?? ''} onChange={e => setOrgForm(p => ({ ...p, email: e.target.value }))}
                                      placeholder="info@kurum.com"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="Web Sitesi" icon={Globe}>
                                  <input type="text" value={orgForm.web ?? ''} onChange={e => setOrgForm(p => ({ ...p, web: e.target.value }))}
                                      placeholder="www.kurum.com"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="Adres" icon={MapPin}>
                                  <input type="text" value={orgForm.address ?? ''} onChange={e => setOrgForm(p => ({ ...p, address: e.target.value }))}
                                      placeholder="Kurum adresi"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                          </div>
                      </section>

                      {/* ── 5. Vergi & İmza ── */}
                      <section className="bg-white rounded-2xl border border-slate-200 p-5">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Vergi & İmza Yetkilisi</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <Field label="Vergi Dairesi" icon={Building2}>
                                  <input type="text" value={orgForm.taxOffice ?? ''} onChange={e => setOrgForm(p => ({ ...p, taxOffice: e.target.value }))}
                                      placeholder="ör. Çankaya V.D."
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="Vergi No" icon={Hash}>
                                  <input type="text" value={orgForm.taxNumber ?? ''} onChange={e => setOrgForm(p => ({ ...p, taxNumber: e.target.value }))}
                                      placeholder="1234567890"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="İmza Yetkilisi" icon={UserCheck}>
                                  <input type="text" value={orgForm.signerName ?? ''} onChange={e => setOrgForm(p => ({ ...p, signerName: e.target.value }))}
                                      placeholder="Ad Soyad"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                              <Field label="Yetkili Unvanı" icon={Briefcase}>
                                  <input type="text" value={orgForm.signerTitle ?? ''} onChange={e => setOrgForm(p => ({ ...p, signerTitle: e.target.value }))}
                                      placeholder="ör. Genel Müdür"
                                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                              </Field>
                          </div>
                      </section>

                      {/* ── Kaydet ── */}
                      <div className="flex items-center gap-3 pt-2">
                          <button onClick={saveOrg}
                              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95">
                              <Save size={15}/> Kaydet
                          </button>
                          <p className="text-[10px] text-slate-400">Kaydedince menü markası, teklif ve rapor antetleri anında güncellenir.</p>
                      </div>
                  </div>
              </div>
          )}

          {/* --- GÖRÜNÜM TAB --- */}
          {activeTab === 'appearance' && (
              <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
                      <div>
                          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Palette size={18} className="text-blue-600"/> Görünüm Ayarları</h3>
                          <p className="text-xs text-slate-500 mt-1">Tema, renk ve yoğunluk tercihleri — değişiklikler anında uygulanır ve bu tarayıcıda saklanır.</p>
                      </div>
                      <button
                          onClick={() => { setAppearance(updateAppearance({ theme:'light', accent:'blue', fontScale:'md', compact:false, reduceMotion:false, sidebarCollapsed:false })); addNotification('info', 'Görünüm ayarları varsayılana döndürüldü.'); }}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl px-3.5 py-2 transition-colors"
                      >
                          Varsayılana Dön
                      </button>
                  </div>

                  <div className="space-y-7 max-w-3xl">
                      {/* TEMA — 3 seçenek (system eklendi) */}
                      <section>
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Tema</h4>
                          <div className="grid grid-cols-3 gap-3">
                              {([
                                  { id: 'light', label: 'Açık', desc: 'Klasik aydınlık', icon: Sun },
                                  { id: 'dark', label: 'Koyu', desc: 'Gece modu', icon: Moon },
                                  { id: 'system', label: 'Sistem', desc: 'İşletim sistemi takip', icon: Smartphone }
                              ] as const).map(t => (
                                  <button
                                      key={t.id}
                                      onClick={() => updateAppearancePref({ theme: t.id })}
                                      className={`relative flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all ${
                                          appearance.theme === t.id
                                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                                              : 'border-slate-200 hover:border-slate-300 bg-white'
                                      }`}
                                  >
                                      <t.icon size={20} className={appearance.theme === t.id ? 'text-blue-600' : 'text-slate-400'} />
                                      <span className={`text-sm font-bold ${appearance.theme === t.id ? 'text-blue-700' : 'text-slate-700'}`}>{t.label}</span>
                                      <span className="text-[10px] text-slate-400 text-center leading-tight">{t.desc}</span>
                                      {appearance.theme === t.id && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500" />}
                                  </button>
                              ))}
                          </div>
                          {appearance.theme === 'system' && (
                              <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5">
                                  <Smartphone size={11} /> Şu an aktif: <b>{window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'Koyu' : 'Açık'}</b> (işletim sistemi tercihine göre otomatik)
                              </p>
                          )}
                      </section>

                      {/* VURGU RENGİ — önizlemeli kart */}
                      <section>
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Vurgu Rengi</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                              {(Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]).map(key => {
                                  const isActive = appearance.accent === key;
                                  return (
                                      <button
                                          key={key}
                                          onClick={() => updateAppearancePref({ accent: key })}
                                          className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all overflow-hidden ${
                                              isActive ? 'border-slate-800 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'
                                          }`}
                                          title={ACCENTS[key].label}
                                      >
                                          {/* Önizleme bandı */}
                                          <div className="w-full h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${ACCENTS[key].p['400']}, ${ACCENTS[key].p['600']})` }} />
                                          <span className="text-xs font-bold text-slate-700">{ACCENTS[key].label}</span>
                                          {isActive && (
                                              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center shadow">
                                                  <span className="w-2 h-2 rounded-full" style={{ background: ACCENTS[key].p['600'] }} />
                                              </span>
                                          )}
                                      </button>
                                  );
                              })}
                          </div>
                      </section>

                      {/* YAZI ÖLÇEĞİ — önizlemeli */}
                      <section>
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Type size={13}/> Yazı Ölçeği</h4>
                          <div className="grid grid-cols-3 gap-3">
                              {([
                                  { id: 'sm', label: 'Küçük', sample: 'Aa', size: 'text-xs' },
                                  { id: 'md', label: 'Normal', sample: 'Aa', size: 'text-sm' },
                                  { id: 'lg', label: 'Büyük', sample: 'Aa', size: 'text-base' }
                              ] as const).map(f => (
                                  <button
                                      key={f.id}
                                      onClick={() => updateAppearancePref({ fontScale: f.id })}
                                      className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all ${
                                          appearance.fontScale === f.id
                                              ? 'border-blue-500 bg-blue-50 shadow-sm'
                                              : 'border-slate-200 hover:border-slate-300 bg-white'
                                      }`}
                                  >
                                      <span className={`font-black text-slate-700 ${f.size}`}>{f.sample}</span>
                                      <span className={`text-xs font-bold ${appearance.fontScale === f.id ? 'text-blue-700' : 'text-slate-600'}`}>{f.label}</span>
                                  </button>
                              ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">Tüm arayüz yazıları ve boşluklar orantılı ölçeklenir.</p>
                      </section>

                      {/* DİĞER TERCİHLER — gelişmiş toggle kartları */}
                      <section>
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Davranış</h4>
                          <div className="space-y-2.5">
                              {([
                                  { key: 'compact' as const, icon: Rows3, label: 'Kompakt Görünüm', desc: 'Tablolar ve kartlarda daha sıkı boşluklar', color: 'bg-blue-100 text-blue-600' },
                                  { key: 'reduceMotion' as const, icon: Zap, label: 'Animasyonları Azalt', desc: 'Geçiş ve hareket efektlerini kapatır', color: 'bg-amber-100 text-amber-600' },
                                  { key: 'sidebarCollapsed' as const, icon: PanelLeftClose, label: 'Daraltılmış Sidebar', desc: 'Uygulama ikon-only menüyle başlar', color: 'bg-purple-100 text-purple-600' }
                              ]).map(opt => (
                                  <label key={opt.key} className="flex items-center justify-between gap-4 p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors bg-white">
                                      <div className="flex items-center gap-3 min-w-0">
                                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${opt.color}`}><opt.icon size={16}/></div>
                                          <div className="min-w-0">
                                              <p className="text-sm font-bold text-slate-700">{opt.label}</p>
                                              <p className="text-[10px] text-slate-400">{opt.desc}</p>
                                          </div>
                                      </div>
                                      <button
                                          type="button"
                                          onClick={(e) => { e.preventDefault(); updateAppearancePref({ [opt.key]: !appearance[opt.key] }); }}
                                          className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${appearance[opt.key] ? 'bg-blue-500' : 'bg-slate-300'}`}
                                      >
                                          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${appearance[opt.key] ? 'left-6' : 'left-1'}`} />
                                      </button>
                                  </label>
                              ))}
                          </div>
                      </section>

                      {/* Önizleme kartı */}
                      <section className="pt-2">
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Önizleme</h4>
                          <div className="rounded-2xl border border-slate-200 overflow-hidden">
                              <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                                  <div className="flex items-center gap-2 mb-2">
                                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: `linear-gradient(135deg, ${ACCENTS[appearance.accent].p['400']}, ${ACCENTS[appearance.accent].p['600']})` }}>
                                          <Palette size={16} />
                                      </div>
                                      <div>
                                          <p className="text-sm font-bold text-slate-800">Örnek Kart Başlığı</p>
                                          <p className="text-[10px] text-slate-400">Bu kart seçili tema ve renk ile görünür</p>
                                      </div>
                                  </div>
                                  <p className="text-xs text-slate-500 leading-relaxed">Bu bir örnek metindir. Yazı ölçeği seçiminize göre boyutlanır ve vurgu rengi butonlarda kullanılır.</p>
                              </div>
                              <div className="p-4 flex items-center gap-2 flex-wrap">
                                  <button className="px-4 py-2 text-white text-xs font-bold rounded-xl shadow-sm" style={{ background: ACCENTS[appearance.accent].p['600'] }}>Birincil Buton</button>
                                  <button className="px-4 py-2 text-xs font-bold rounded-xl border-2" style={{ borderColor: ACCENTS[appearance.accent].p['400'], color: ACCENTS[appearance.accent].p['700'] }}>İkincil Buton</button>
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white" style={{ background: ACCENTS[appearance.accent].p['500'] }}>Rozet</span>
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: ACCENTS[appearance.accent].p['100'], color: ACCENTS[appearance.accent].p['700'] }}>Etiket</span>
                              </div>
                          </div>
                      </section>
                  </div>
              </div>
          )}

          {/* --- AI & API TAB --- */}
          {activeTab === 'ai' && (
              <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <AiSettings addNotification={addNotification} />
              </div>
          )}

          {/* --- USERS TAB (sadece super_admin) --- */}
          {activeTab === 'users' && currentUser?.role === 'super_admin' && (
              <div className="p-4 md:p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <UserManager currentUser={currentUser} />
              </div>
          )}

          {/* --- SECURITY TAB --- */}
          {activeTab === 'security' && (
              <div className="p-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
                  
                  {/* Session Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 mb-8 flex items-center gap-4">
                       <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-400 border border-slate-100">
                           <UserCircle size={40} />
                       </div>
                       <div className="flex-1">
                           <h4 className="font-bold text-slate-800 text-lg">{currentUser?.fullName}</h4>
                           <p className="text-sm text-slate-500 font-mono">@{currentUser?.username}</p>
                           <div className="flex items-center gap-2 mt-2">
                               <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${currentUser?.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                   {currentUser?.role === 'super_admin' ? 'Yönetici' : 'Kullanıcı'}
                               </span>
                               <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                                   <Activity size={10} /> Aktif Oturum
                               </span>
                           </div>
                       </div>
                  </div>

                  {/* Password Form */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-lg shadow-slate-100">
                      <div className="flex flex-col items-center mb-6 text-center">
                          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                              <Lock size={24} />
                          </div>
                          <h3 className="text-xl font-bold text-slate-900">Şifre Değiştir</h3>
                          <p className="text-slate-500 text-sm mt-1">Hesap güvenliğinizi sağlamak için düzenli olarak şifrenizi güncelleyin.</p>
                      </div>

                      <form onSubmit={handleChangePassword} className="space-y-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 uppercase">Mevcut Şifre</label>
                              <div className="relative">
                                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                                  <input 
                                    type="password" 
                                    value={passData.current}
                                    onChange={(e) => setPassData({...passData, current: e.target.value})}
                                    className="w-full pl-10 border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition-all bg-slate-50 focus:bg-white"
                                    placeholder="••••••"
                                  />
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 uppercase">Yeni Şifre</label>
                                  <input 
                                    type="password" 
                                    value={passData.new}
                                    onChange={(e) => setPassData({...passData, new: e.target.value})}
                                    className="w-full border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition-all bg-slate-50 focus:bg-white"
                                    placeholder="En az 4 karakter"
                                  />
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1 uppercase">Tekrar</label>
                                  <input 
                                    type="password" 
                                    value={passData.confirm}
                                    onChange={(e) => setPassData({...passData, confirm: e.target.value})}
                                    className="w-full border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition-all bg-slate-50 focus:bg-white"
                                    placeholder="••••••"
                                  />
                              </div>
                          </div>
                          
                          <button 
                            type="submit"
                            className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-200 transition-all mt-4 flex items-center justify-center gap-2 active:scale-95"
                          >
                              Şifreyi Güncelle
                          </button>
                      </form>
                  </div>
              </div>
          )}

          {/* --- LOGS TAB --- */}
          {activeTab === 'logs' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">

                  {/* İstatistik şeridi */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Toplam', value: auditLogs.length, color: 'blue', icon: Activity },
                      { label: 'Bugün', value: auditLogs.filter(l => { const d = new Date(l.timestamp); const n = new Date(); return d.toDateString() === n.toDateString(); }).length, color: 'emerald', icon: Activity },
                      { label: 'Kritik', value: auditLogs.filter(l => l.severity === 'danger' || l.severity === 'warning').length, color: 'amber', icon: AlertTriangle },
                      { label: 'Silinen', value: auditLogs.filter(l => l.action.includes('DELETE') || l.action.includes('CLEAR') || l.action.includes('RESET')).length, color: 'red', icon: Trash2 }
                    ].map(s => {
                      const Icon = s.icon;
                      const colorMap: Record<string, string> = {
                        blue: 'bg-blue-50 text-blue-600',
                        emerald: 'bg-emerald-50 text-emerald-600',
                        amber: 'bg-amber-50 text-amber-600',
                        red: 'bg-red-50 text-red-600'
                      };
                      return (
                        <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-2.5">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colorMap[s.color]}`}><Icon size={16} /></div>
                          <div><p className="text-lg font-black text-slate-800 tabular-nums leading-none">{s.value}</p><p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{s.label}</p></div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Filtre toolbar */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-3">
                    {/* Arama + temizle */}
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="İşlem, kullanıcı veya detay ara..."
                          value={logSearch}
                          onChange={(e) => setLogSearch(e.target.value)}
                          className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                        />
                      </div>
                      {auditLogs.length > 0 && (
                        <button onClick={handleClearLogs} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-slate-200 hover:border-red-200" title="Kayıtları Temizle">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Filtre çipleri */}
                    <div className="flex flex-wrap gap-2">
                      {/* Kategori */}
                      <select value={logCategoryFilter} onChange={e => setLogCategoryFilter(e.target.value)} className="appearance-none px-3 py-1.5 pr-8 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 cursor-pointer focus:ring-2 focus:ring-blue-100 outline-none">
                        <option value="all">Tüm Kategoriler</option>
                        <option value="auth">Oturum</option>
                        <option value="data">Veri</option>
                        <option value="system">Sistem</option>
                        <option value="user">Kullanıcı</option>
                        <option value="ai">AI</option>
                      </select>
                      {/* Önem */}
                      <select value={logSeverityFilter} onChange={e => setLogSeverityFilter(e.target.value)} className="appearance-none px-3 py-1.5 pr-8 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 cursor-pointer focus:ring-2 focus:ring-blue-100 outline-none">
                        <option value="all">Tüm Seviyeler</option>
                        <option value="info">Bilgi</option>
                        <option value="success">Başarılı</option>
                        <option value="warning">Uyarı</option>
                        <option value="danger">Kritik</option>
                      </select>
                      {/* Tarih */}
                      <select value={logDateFilter} onChange={e => setLogDateFilter(e.target.value)} className="appearance-none px-3 py-1.5 pr-8 text-xs font-bold border border-slate-200 rounded-lg bg-slate-50 cursor-pointer focus:ring-2 focus:ring-blue-100 outline-none">
                        <option value="all">Tüm Zamanlar</option>
                        <option value="today">Bugün</option>
                        <option value="week">Son 7 Gün</option>
                        <option value="month">Son 30 Gün</option>
                      </select>
                      <span className="ml-auto text-xs text-slate-400 font-bold self-center">{filteredLogs.length} kayıt</span>
                    </div>
                  </div>

                  {/* Kayıt listesi */}
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="max-h-[500px] overflow-y-auto">
                      {filteredLogs.length > 0 ? (
                        <div className="divide-y divide-slate-50">
                          {filteredLogs.map((log, idx) => {
                            const cat = log.category || 'system';
                            const sev = log.severity || 'info';
                            const catMeta: Record<string, { label: string; color: string }> = {
                              auth: { label: 'Oturum', color: 'bg-emerald-100 text-emerald-700' },
                              data: { label: 'Veri', color: 'bg-blue-100 text-blue-700' },
                              system: { label: 'Sistem', color: 'bg-slate-100 text-slate-600' },
                              user: { label: 'Kullanıcı', color: 'bg-purple-100 text-purple-700' },
                              ai: { label: 'AI', color: 'bg-indigo-100 text-indigo-700' }
                            };
                            const sevMeta: Record<string, { label: string; color: string; dot: string }> = {
                              info: { label: 'Bilgi', color: 'text-slate-500', dot: 'bg-slate-400' },
                              success: { label: 'Başarılı', color: 'text-emerald-600', dot: 'bg-emerald-500' },
                              warning: { label: 'Uyarı', color: 'text-amber-600', dot: 'bg-amber-500' },
                              danger: { label: 'Kritik', color: 'text-red-600', dot: 'bg-red-500' }
                            };
                            const date = new Date(log.timestamp);
                            const today = new Date();
                            const isToday = date.toDateString() === today.toDateString();
                            const timeStr = isToday
                              ? date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
                              : date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' + date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                            return (
                              <div key={log.id} className={`flex items-start gap-3 p-3 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                {/* Severity dot */}
                                <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${sevMeta[sev].dot}`} />

                                {/* Zaman */}
                                <div className="w-28 shrink-0 pt-0.5">
                                  <p className="text-[11px] font-mono text-slate-500 whitespace-nowrap">{timeStr}</p>
                                </div>

                                {/* Kullanıcı */}
                                <div className="w-32 shrink-0 flex items-center gap-2 pt-0.5">
                                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                                    {log.username.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-bold text-slate-700 text-xs truncate">{log.username}</span>
                                </div>

                                {/* Kategori + işlem */}
                                <div className="flex-1 min-w-0 pt-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${catMeta[cat].color}`}>{catMeta[cat].label}</span>
                                    <span className={`text-[10px] font-bold uppercase ${sevMeta[sev].color}`}>{log.action}</span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1 truncate" title={log.details}>{log.details}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-16 text-center text-slate-400">
                          <Search size={28} className="mx-auto mb-2 opacity-20" />
                          <p className="text-sm font-medium">Kayıt bulunamadı.</p>
                          <p className="text-xs mt-1">Filtreleri değiştirin veya temizleyin.</p>
                        </div>
                      )}
                    </div>
                  </div>
              </div>
          )}
      </div>
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmAction !== null}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        confirmLabel="Evet"
        onConfirm={() => { confirmAction?.action(); setConfirmAction(null); }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};