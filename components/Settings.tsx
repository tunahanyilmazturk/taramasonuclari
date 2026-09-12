import React, { useRef, useState, useMemo } from 'react';
import { ConfirmModal } from './ConfirmModal';
import {
  Download, Upload, Trash2, Database, ShieldCheck, AlertTriangle, RefreshCw,
  FlaskConical, History, X, HardDrive, ServerCrash, Smartphone,
  Lock, Key, Search, Cpu, Activity, UserCircle, FileSignature, Stethoscope, Save,
  Sparkles, Users, Building2, Palette, Sun, Moon, Monitor, Type, Zap, PanelLeftClose, Rows3
} from 'lucide-react';
import { AppState, User, AuditLog, ReportSettings, OrgInfo, AppearanceSettings, SettingsTab } from '../types';
import { storageService } from '../services/storageService';
import { updateAppearance, ACCENTS } from '../services/appearance';
import { hashPassword } from '../utils/security';
import { AiSettings } from './AiSettings';
import { UserManager } from './UserManager';

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

  // Password Change State
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; action: () => void } | null>(null);

  // Global Rapor Ayarları (tüm firmaların çıktılarında ortak antet/imza)
  const [reportForm, setReportForm] = useState<ReportSettings>(() => storageService.getReportSettings());

  // Kurum bilgileri — antet, imza ve marka gösteriminde kullanılır
  const [orgForm, setOrgForm] = useState<OrgInfo>(() => storageService.getOrgInfo());

  // Görünüm ayarları — değişiklik anında uygulanır + kaydedilir
  const [appearance, setAppearance] = useState<AppearanceSettings>(() => storageService.getAppearance());
  const updateAppearancePref = (patch: Partial<AppearanceSettings>) => setAppearance(updateAppearance(patch));

  const saveOrg = () => {
      const cleaned = { ...orgForm, name: orgForm.name.trim() || 'HanTech OSGB' };
      storageService.saveOrgInfo(cleaned);
      setOrgForm(cleaned);
      onOrgSaved?.(cleaned);
      if (currentUser) storageService.addLog(currentUser, 'ORG_UPDATE', 'Kurum bilgileri güncellendi.');
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
      
      if(currentUser) storageService.addLog(currentUser, 'BACKUP', 'Sistem yedeği indirildi.');
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
                if(currentUser) storageService.addLog(currentUser, 'RESTORE', 'Sistem yedeği geri yüklendi.');
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
          if(currentUser) storageService.addLog(currentUser, 'RESET', 'Fabrika ayarlarına dönüldü.');
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
      
      storageService.addLog(currentUser, 'PASSWORD_CHANGE', 'Kullanıcı şifresini değiştirdi.');
      addNotification('success', 'Şifreniz güncellendi.');
      setPassData({ current: '', new: '', confirm: '' });
  };

  const handleSaveReportSettings = () => {
      storageService.saveReportSettings(reportForm);
      if (currentUser) storageService.addLog(currentUser, 'SETTINGS', 'Global rapor ayarları güncellendi.');
      addNotification('success', 'Rapor ayarları kaydedildi.');
  };

  const filteredLogs = auditLogs.filter(log => 
      log.action.toLowerCase().includes(logSearch.toLowerCase()) || 
      log.username.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(logSearch.toLowerCase())
  );

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
          
          {/* --- SYSTEM TAB --- */}
          {activeTab === 'system' && (
              <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-bottom-4 duration-300">
                  
                  {/* LEFT COL: Storage & Info */}
                  <div className="lg:col-span-1 space-y-6">
                      {/* Storage Widget */}
                      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 relative overflow-hidden group">
                          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                              <HardDrive size={64} className="text-slate-900"/>
                          </div>
                          <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                              <Cpu size={16} className="text-blue-500"/> Sistem Durumu
                          </h4>
                          
                          <div className="space-y-4">
                              <div>
                                  <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
                                      <span>Depolama</span>
                                      <span>{storageStats.percentage.toFixed(1)}%</span>
                                  </div>
                                  <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
                                      <div className={`h-full rounded-full transition-all duration-1000 ${storageStats.color}`} style={{ width: `${storageStats.percentage}%` }}></div>
                                  </div>
                                  <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-medium">
                                      <span>{storageStats.kb} KB Kullanılıyor</span>
                                      <span>Limit: {storageStats.limitStr}</span>
                                  </div>
                              </div>

                              <div className="pt-4 border-t border-slate-200">
                                   <div className="flex items-center gap-3 mb-2">
                                       <div className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                       <span className="text-sm font-bold text-slate-700">{navigator.onLine ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
                                   </div>
                                   <p className="text-xs text-slate-400">Veriler tarayıcı hafızasında saklanır.</p>
                              </div>
                          </div>
                      </div>

                      {/* App Info */}
                      <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center space-y-2">
                          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-slate-200">
                              <Smartphone size={24} />
                          </div>
                          <h3 className="font-black text-slate-800">{orgForm.name}</h3>
                          <p className="text-[10px] text-slate-400 font-medium">{orgForm.tagline || 'Mobil Sağlık Taraması Yönetim Platformu'}</p>
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-md border border-slate-200">v1.0.3-stable</span>
                          <p className="text-xs text-slate-400 mt-2">&copy; {new Date().getFullYear()} {orgForm.name}</p>
                      </div>
                  </div>

                  {/* RIGHT COL: Actions */}
                  <div className="lg:col-span-2 space-y-6">
                      
                      {/* Data Operations */}
                      <div>
                          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                              <RefreshCw size={16} className="text-slate-400"/> Veri Operasyonları
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <button 
                                onClick={handleBackup}
                                className="group flex flex-col items-center text-center p-6 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:ring-1 hover:ring-blue-500 transition-all shadow-sm hover:shadow-md"
                              >
                                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                      <Download size={24}/>
                                  </div>
                                  <h4 className="font-bold text-slate-800">Yedekle</h4>
                                  <p className="text-xs text-slate-500 mt-1 px-4">Tüm sistemi JSON formatında indir.</p>
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
                                  <p className="text-xs text-slate-500 mt-1 px-4">Yedek dosyasından verileri kurtar.</p>
                              </button>
                          </div>
                      </div>

                      {/* Demo Data Banner */}
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-1 shadow-lg">
                          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-6">
                              <div className="flex items-center gap-4 text-white">
                                  <div className="p-3 bg-white/20 rounded-xl"><FlaskConical size={24}/></div>
                                  <div>
                                      <h4 className="font-bold text-lg">Demo Modu</h4>
                                      <p className="text-indigo-100 text-xs opacity-80">Sistemi test etmek için örnek veri yükleyin.</p>
                                  </div>
                              </div>
                              <button 
                                onClick={() => {
                                    setConfirmAction({
                                        title: 'Demo Veri Yükle',
                                        message: 'Mevcut verilerin üzerine Demo verileri eklenecek. Devam edilsin mi?',
                                        action: () => {
                                            onLoadDemo();
                                            if(currentUser) storageService.addLog(currentUser, 'DEMO_LOAD', 'Örnek veriler yüklendi.');
                                        }
                                    });
                                }}
                                className="px-5 py-2.5 bg-white text-indigo-600 font-bold text-sm rounded-xl hover:bg-indigo-50 transition-colors shadow-md whitespace-nowrap"
                              >
                                  Örnek Veri Yükle
                              </button>
                          </div>
                      </div>

                      {/* Rapor Ayarları — tüm firmaların çıktılarında kullanılır */}
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

                      {/* Danger Zone */}
                      <div className="pt-6">
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
              </div>
          )}

          {/* --- KURUM BİLGİLERİ TAB --- */}
          {activeTab === 'org' && (
              <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <div className="mb-6">
                      <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Building2 size={18} className="text-blue-600"/> Kurum Bilgileri</h3>
                      <p className="text-xs text-slate-500 mt-1">Bu bilgiler teklif/rapor antetlerinde, imza bloklarında ve uygulama markasında kullanılır.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
                      <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Kurum Adı *</label>
                          <input type="text" value={orgForm.name} onChange={e => setOrgForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="ör. HanTech OSGB"
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                      </div>
                      <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Kısa Açıklama / Slogan</label>
                          <input type="text" value={orgForm.tagline ?? ''} onChange={e => setOrgForm(p => ({ ...p, tagline: e.target.value }))}
                            placeholder="ör. Mobil Sağlık Hizmetleri"
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                      </div>
                      <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Telefon</label>
                          <input type="text" value={orgForm.phone ?? ''} onChange={e => setOrgForm(p => ({ ...p, phone: e.target.value }))}
                            placeholder="0850 000 00 00"
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                      </div>
                      <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">E-posta</label>
                          <input type="email" value={orgForm.email ?? ''} onChange={e => setOrgForm(p => ({ ...p, email: e.target.value }))}
                            placeholder="info@kurum.com"
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                      </div>
                      <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Web Sitesi</label>
                          <input type="text" value={orgForm.web ?? ''} onChange={e => setOrgForm(p => ({ ...p, web: e.target.value }))}
                            placeholder="www.kurum.com"
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                      </div>
                      <div className="md:col-span-2">
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Adres</label>
                          <textarea value={orgForm.address ?? ''} onChange={e => setOrgForm(p => ({ ...p, address: e.target.value }))}
                            rows={2} placeholder="Kurum adresi"
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all resize-none" />
                      </div>
                      <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Vergi Dairesi</label>
                          <input type="text" value={orgForm.taxOffice ?? ''} onChange={e => setOrgForm(p => ({ ...p, taxOffice: e.target.value }))}
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                      </div>
                      <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Vergi No</label>
                          <input type="text" value={orgForm.taxNumber ?? ''} onChange={e => setOrgForm(p => ({ ...p, taxNumber: e.target.value }))}
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                      </div>
                      <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">İmza Yetkilisi</label>
                          <input type="text" value={orgForm.signerName ?? ''} onChange={e => setOrgForm(p => ({ ...p, signerName: e.target.value }))}
                            placeholder="Ad Soyad"
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                      </div>
                      <div>
                          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Yetkili Unvanı</label>
                          <input type="text" value={orgForm.signerTitle ?? ''} onChange={e => setOrgForm(p => ({ ...p, signerTitle: e.target.value }))}
                            placeholder="ör. Genel Müdür"
                            className="mt-1 w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all" />
                      </div>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                      <button onClick={saveOrg}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95">
                          <Save size={15}/> Kaydet
                      </button>
                      <p className="text-[10px] text-slate-400">Kaydedince menü markası, teklif ve rapor antetleri anında güncellenir.</p>
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
                      {/* TEMA */}
                      <section>
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Tema</h4>
                          <div className="grid grid-cols-3 gap-3">
                              {([
                                  { id: 'light', label: 'Açık', desc: 'Klasik aydınlık görünüm', icon: Sun },
                                  { id: 'dark', label: 'Koyu', desc: 'Göz yormayan gece modu', icon: Moon },
                                  { id: 'system', label: 'Sistem', desc: 'Cihaz temasını takip et', icon: Monitor }
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
                      </section>

                      {/* VURGU RENGİ */}
                      <section>
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Vurgu Rengi</h4>
                          <div className="flex flex-wrap gap-3">
                              {(Object.keys(ACCENTS) as (keyof typeof ACCENTS)[]).map(key => (
                                  <button
                                      key={key}
                                      onClick={() => updateAppearancePref({ accent: key })}
                                      className={`flex items-center gap-2.5 pl-2 pr-3.5 py-2 rounded-2xl border-2 transition-all ${
                                          appearance.accent === key ? 'border-slate-800 bg-slate-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
                                      }`}
                                      title={ACCENTS[key].label}
                                  >
                                      <span className="w-6 h-6 rounded-full shadow-inner ring-2 ring-white" style={{ background: `linear-gradient(135deg, ${ACCENTS[key].p['400']}, ${ACCENTS[key].p['600']})` }} />
                                      <span className="text-xs font-bold text-slate-700">{ACCENTS[key].label}</span>
                                  </button>
                              ))}
                          </div>
                      </section>

                      {/* YAZI ÖLÇEĞİ */}
                      <section>
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Type size={13}/> Yazı Ölçeği</h4>
                          <div className="inline-flex bg-slate-100 rounded-2xl p-1 gap-1">
                              {([
                                  { id: 'sm', label: 'Küçük' },
                                  { id: 'md', label: 'Normal' },
                                  { id: 'lg', label: 'Büyük' }
                              ] as const).map(f => (
                                  <button
                                      key={f.id}
                                      onClick={() => updateAppearancePref({ fontScale: f.id })}
                                      className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                                          appearance.fontScale === f.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                      }`}
                                  >
                                      {f.label}
                                  </button>
                              ))}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2">Tüm arayüz yazıları ve boşluklar orantılı ölçeklenir.</p>
                      </section>

                      {/* DİĞER TERCİHLER */}
                      <section>
                          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Davranış</h4>
                          <div className="space-y-2.5">
                              {([
                                  { key: 'compact' as const, icon: Rows3, label: 'Kompakt Görünüm', desc: 'Tablolar ve kartlarda daha sıkı boşluklar' },
                                  { key: 'reduceMotion' as const, icon: Zap, label: 'Animasyonları Azalt', desc: 'Geçiş ve hareket efektlerini kapatır' },
                                  { key: 'sidebarCollapsed' as const, icon: PanelLeftClose, label: 'Daraltılmış Sidebar', desc: 'Uygulama ikon-only menüyle başlar' }
                              ]).map(opt => (
                                  <label key={opt.key} className="flex items-center justify-between gap-4 p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 cursor-pointer transition-colors bg-white">
                                      <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0"><opt.icon size={16}/></div>
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
              <div className="flex flex-col h-[600px] animate-in fade-in slide-in-from-bottom-4 duration-300">
                  {/* Toolbar */}
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-slate-50/50 rounded-t-3xl">
                      <div className="flex items-center gap-3">
                           <div className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 shadow-sm"><History size={18}/></div>
                           <span className="font-bold text-slate-700 text-sm">{filteredLogs.length} Kayıt</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                          <div className="relative">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                              <input 
                                type="text" 
                                placeholder="Loglarda ara..." 
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 border-slate-200 rounded-xl text-xs bg-white focus:ring-blue-500 w-48 sm:w-64"
                              />
                          </div>
                          {filteredLogs.length > 0 && (
                              <button 
                                onClick={handleClearLogs}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                title="Kayıtları Temizle"
                              >
                                  <Trash2 size={16} />
                              </button>
                          )}
                      </div>
                  </div>

                  {/* Table */}
                  <div className="flex-1 overflow-auto custom-scrollbar">
                      <table className="w-full text-left text-sm border-collapse">
                          <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 shadow-sm">
                              <tr>
                                  <th className="px-6 py-3 border-b border-slate-200">Zaman</th>
                                  <th className="px-6 py-3 border-b border-slate-200">Kullanıcı</th>
                                  <th className="px-6 py-3 border-b border-slate-200">İşlem</th>
                                  <th className="px-6 py-3 border-b border-slate-200">Detay</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                              {filteredLogs.length > 0 ? (
                                  filteredLogs.map((log, idx) => (
                                      <tr key={log.id} className={`hover:bg-blue-50/50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                          <td className="px-6 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                              {new Date(log.timestamp).toLocaleString('tr-TR')}
                                          </td>
                                          <td className="px-6 py-3">
                                              <div className="flex items-center gap-2">
                                                  <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600">
                                                      {log.username.charAt(0).toUpperCase()}
                                                  </div>
                                                  <span className="font-bold text-slate-700 text-xs">{log.username}</span>
                                              </div>
                                          </td>
                                          <td className="px-6 py-3">
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                                                  log.action === 'LOGIN' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                  log.action === 'LOGOUT' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                                                  log.action === 'DELETE_RECORD' || log.action === 'RESET' ? 'bg-red-50 text-red-700 border-red-100' :
                                                  'bg-blue-50 text-blue-700 border-blue-100'
                                              }`}>
                                                  {log.action}
                                              </span>
                                          </td>
                                          <td className="px-6 py-3 text-slate-600 text-xs truncate max-w-xs" title={log.details}>
                                              {log.details}
                                          </td>
                                      </tr>
                                  ))
                              ) : (
                                  <tr>
                                      <td colSpan={4} className="py-20 text-center text-slate-400 flex flex-col items-center justify-center">
                                          <Search size={32} className="mb-2 opacity-20"/>
                                          <p className="text-xs">Kayıt bulunamadı.</p>
                                      </td>
                                  </tr>
                              )}
                          </tbody>
                      </table>
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