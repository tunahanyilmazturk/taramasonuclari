import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { HomeDashboard } from './components/HomeDashboard';
import { TestConfig } from './components/TestConfig';
import { CompanyManager } from './components/CompanyManager';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { ConfirmModal } from './components/ConfirmModal';
import { Screenings } from './components/modules/Screenings';
import { Quotes } from './components/modules/Quotes';
import { Calendar } from './components/modules/Calendar';
import { Equipment } from './components/modules/Equipment';
import { Team } from './components/modules/Team';
import { TestDefinition, PatientRecord, Company, AppState, Notification, User, OrgInfo, SettingsTab, SETTINGS_TAB_IDS } from './types';
import { storageService } from './services/storageService';
import { useHashRoute, resolveRoute } from './utils/router';
import { DEFAULT_TESTS } from './constants';
import { generateDemoData } from './services/demoDataService';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

// Auto-Logout Time in Milliseconds (10 Minutes)
const AUTO_LOGOUT_TIME = 10 * 60 * 1000;

function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(() => storageService.getCurrentUser());

  // URL tabanlı sayfa yönetimi (#/dashboard, #/companies, ...)
  const { hash, navigate } = useHashRoute();
  const activeTab = resolveRoute(hash, currentUser?.role === 'super_admin');

  // Ayarlar alt sekmesi — #/settings/<tab> veya eski #/users, #/ai deep-link'leri
  const settingsSub = hash.split('/')[1];
  let settingsTab: SettingsTab | undefined =
    activeTab === 'settings'
      ? ((SETTINGS_TAB_IDS as readonly string[]).includes(settingsSub ?? '') ? settingsSub as SettingsTab : undefined)
      : activeTab === 'users' ? 'users'
      : activeTab === 'ai' ? 'ai'
      : undefined;
  if (settingsTab && (settingsTab === 'users' || settingsTab === 'logs') && currentUser?.role !== 'super_admin') {
    settingsTab = undefined; // adminOnly sekmeler — yetkisiz deep-link'i engelle
  }

  // Geçersiz veya yetkisiz URL'leri geçerli rotaya çevir (geçmişi kirletmeden)
  // Alt rotalar (örn. #/quotes/quo_1) üst rota geçerliyse korunur
  useEffect(() => {
    const base = hash.split('/')[0];
    if (currentUser && hash && base !== activeTab) {
      window.location.replace(`#/${activeTab}`);
    }
  }, [currentUser, hash, activeTab]);

  // Data state (localStorage senkron okunur)
  const [masterTests, setMasterTests] = useState<TestDefinition[]>(() => storageService.getTests());
  const [companies, setCompanies] = useState<Company[]>(() => storageService.getCompanies());
  const [records, setRecords] = useState<PatientRecord[]>(() => storageService.getRecords());
  const [orgInfo, setOrgInfo] = useState<OrgInfo>(() => storageService.getOrgInfo());
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Onay modal state'leri
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', variant: 'danger', onConfirm: () => {} });

  const showConfirm = useCallback((title: string, message: string, onConfirm: () => void, variant: 'danger' | 'warning' | 'info' = 'danger') => {
    setConfirmState({ open: true, title, message, variant, onConfirm: () => { onConfirm(); setConfirmState(prev => ({ ...prev, open: false })); } });
  }, []);

  // --- OPTIMIZATION: DEBOUNCED SAVING ---
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      storageService.saveTests(masterTests);
      storageService.saveCompanies(companies);
      storageService.saveRecords(records);
    }, 1000); 

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [masterTests, companies, records]);

  // Toast System
  const addNotification = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString() + Math.random();
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Auth Handlers
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    storageService.addLog(user, 'LOGIN', 'Kullanıcı giriş yaptı.');
    addNotification('success', `Hoşgeldiniz, ${user.fullName}`);
  };

  const handleLogout = useCallback(() => {
    if (currentUser) {
        storageService.addLog(currentUser, 'LOGOUT', 'Kullanıcı çıkış yaptı.');
    }
    storageService.logout();
    setCurrentUser(null);
    navigate('dashboard');
  }, [currentUser, navigate]);

  // --- SECURITY: AUTO LOGOUT ON INACTIVITY ---
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetLogoutTimer = useCallback(() => {
      if (!currentUser) return;

      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);

      logoutTimerRef.current = setTimeout(() => {
          if (currentUser) storageService.addLog(currentUser, 'AUTO_LOGOUT', 'İnaktiflik nedeniyle otomatik çıkış.');
          handleLogout();
          addNotification('info', 'Güvenlik gereği, uzun süre işlem yapmadığınız için oturumunuz kapatıldı.');
      }, AUTO_LOGOUT_TIME);
  }, [currentUser, handleLogout]);

  useEffect(() => {
      if (currentUser) {
          // Attach listeners
          const events = ['mousemove', 'keydown', 'click', 'scroll'];
          const handler = () => resetLogoutTimer();
          
          events.forEach(event => window.addEventListener(event, handler));
          
          // Initial start
          resetLogoutTimer();

          return () => {
              events.forEach(event => window.removeEventListener(event, handler));
              if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
          };
      }
  }, [currentUser, resetLogoutTimer]);


  const handleAddRecord = (record: PatientRecord) => {
    setRecords(prev => [record, ...prev]);
    addNotification('success', `${record.patientName} başarıyla eklendi.`);
  };

  // --- NEW: BATCH ADD FOR PERFORMANCE ---
  const handleAddRecords = (newRecords: PatientRecord[]) => {
    setRecords(prev => [...newRecords, ...prev]);
    // Don't spam notifications for batch
    if (newRecords.length === 1) {
        addNotification('success', `${newRecords[0].patientName} eklendi.`);
    } else {
        if(currentUser) storageService.addLog(currentUser, 'BATCH_UPLOAD', `${newRecords.length} adet kayıt yüklendi.`);
        addNotification('success', `${newRecords.length} kayıt başarıyla işlendi.`);
    }
  };

  const handleUpdateRecord = (updatedRecord: PatientRecord) => {
    setRecords(prev => prev.map(r => r.id === updatedRecord.id ? updatedRecord : r));
  };

  const handleToggleReview = (recordId: string) => {
      setRecords(prev => prev.map(r => 
          r.id === recordId ? { ...r, isReviewed: !r.isReviewed } : r
      ));
  };

  // Updated to accept skipConfirm for bulk operations
  const handleDeleteRecord = (recordId: string, skipConfirm = false) => {
    const record = records.find(r => r.id === recordId);
    const doDelete = () => {
      setRecords(prev => prev.filter(r => r.id !== recordId));
      if(currentUser && record) storageService.addLog(currentUser, 'DELETE_RECORD', `${record.patientName} kaydı silindi.`);
      addNotification('success', 'Kayıt silindi.');
    };
    if (skipConfirm) {
      doDelete();
    } else {
      showConfirm('Kayıt Sil', `"${record?.patientName || 'Bu kayıt'}" silmek istediğinize emin misiniz?`, doDelete);
    }
  };

  const handleClearRecords = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    const count = records.filter(r => r.companyId === companyId).length;
    showConfirm(
      'Kayıtları Temizle',
      `"${company?.name || 'Bu firma'}" için ${count} kayıt silinecek. Emin misiniz?`,
      () => {
        setRecords(prev => prev.filter(r => r.companyId !== companyId));
        if(currentUser && company) storageService.addLog(currentUser, 'CLEAR_RECORDS', `${company.name} firmasının ${count} kaydı temizlendi.`);
        addNotification('success', 'Tüm kayıtlar temizlendi.');
      }
    );
  };

  const handleRestoreState = (state: AppState) => {
      setMasterTests(state.tests);
      setCompanies(state.companies);
      setRecords(state.records);
      // Restore users if present in backup (security consideration: usually sensitive, but here explicit)
      if (state.users) {
          storageService.saveUsers(state.users);
      }
      // Mobil tarama modülleri (yedekte varsa geri yükle)
      if (state.screenings) storageService.saveScreenings(state.screenings);
      if (state.quotes) storageService.saveQuotes(state.quotes);
      if (state.events) storageService.saveEvents(state.events);
      if (state.equipment) storageService.saveEquipment(state.equipment);
      if (state.team) storageService.saveTeam(state.team);
      if (state.orgInfo) {
          storageService.saveOrgInfo(state.orgInfo);
          setOrgInfo(state.orgInfo);
      }
  };

  const handleResetState = () => {
      setMasterTests(DEFAULT_TESTS);
      setCompanies([]);
      setRecords([]);
      localStorage.clear();
      window.location.reload(); 
  };

  const handleLoadDemoData = () => {
      try {
          const demoState = generateDemoData();
          setMasterTests(demoState.tests);
          setCompanies(demoState.companies);
          setRecords(demoState.records);
          // Mobil tarama modüllerinin örnek verileri
          if (demoState.screenings) storageService.saveScreenings(demoState.screenings);
          if (demoState.quotes) storageService.saveQuotes(demoState.quotes);
          if (demoState.events) storageService.saveEvents(demoState.events);
          if (demoState.equipment) storageService.saveEquipment(demoState.equipment);
          if (demoState.team) storageService.saveTeam(demoState.team);
          addNotification('success', 'Örnek veriler yüklendi. Sonuçlar sayfasına göz atın!');
          navigate('dashboard'); 
      } catch (error) {
          console.error(error);
          addNotification('error', 'Örnek veri yüklenirken bir hata oluştu.');
      }
  };

  // AUTH GUARD
  if (!currentUser) {
    return (
      <Login
        onLogin={handleLogin}
        onLoadDemoData={handleLoadDemoData}
      />
    );
  }

  return (
    <>
    <Layout 
      activeTab={activeTab} 
      onTabChange={navigate}
      currentUser={currentUser}
      onLogout={handleLogout}
      stats={{ records: records.length, companies: companies.length, tests: masterTests.length, users: storageService.getUsers().length }}
      companies={companies}
      records={records}
      org={orgInfo}
    >
      
      {/* MODERN TOAST CONTAINER */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 z-[100] flex flex-col gap-3 pointer-events-none sm:items-end">
        {notifications.map(n => (
          <div 
            key={n.id} 
            className={`pointer-events-auto w-full sm:min-w-[320px] sm:max-w-md backdrop-blur-xl shadow-2xl rounded-2xl p-4 flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-300 ring-1 ${
                n.type === 'success' ? 'bg-white/90 ring-green-500/20 text-slate-800' :
                n.type === 'error' ? 'bg-red-50/95 ring-red-500/20 text-red-900' : 
                'bg-slate-800/90 ring-white/10 text-white'
            }`}
          >
             <div className={`p-2 rounded-full shrink-0 ${
                 n.type === 'success' ? 'bg-green-100 text-green-600' :
                 n.type === 'error' ? 'bg-red-100 text-red-600' : 
                 'bg-white/20 text-white'
             }`}>
                {n.type === 'success' && <CheckCircle size={20} strokeWidth={2.5} />}
                {n.type === 'error' && <AlertTriangle size={20} strokeWidth={2.5} />}
                {n.type === 'info' && <Info size={20} strokeWidth={2.5} />}
             </div>
             <div className="flex-1">
                 <p className="text-sm font-semibold leading-tight">{n.message}</p>
             </div>
             <button 
                onClick={() => removeNotification(n.id)} 
                className={`p-1 rounded-full transition-colors ${
                    n.type === 'info' ? 'hover:bg-white/20 text-slate-300 hover:text-white' : 'hover:bg-black/5 text-slate-400 hover:text-slate-600'
                }`}
             >
                 <X size={16} />
             </button>
          </div>
        ))}
      </div>

      {activeTab === 'home' && (
        <HomeDashboard
          companies={companies}
          records={records}
          currentUser={currentUser}
          onNavigate={navigate}
          onLoadDemo={handleLoadDemoData}
        />
      )}

      {activeTab === 'dashboard' && (
        <Dashboard 
          companies={companies}
          allTests={masterTests}
          records={records}
          onAddRecord={handleAddRecord}
          onAddRecords={handleAddRecords} 
          onUpdateRecord={handleUpdateRecord}
          onToggleReview={handleToggleReview}
          onDeleteRecord={handleDeleteRecord}
          onClearRecords={handleClearRecords}
          onUpdateCompanyTests={(companyId, tests) => {
              setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, tests } : c));
          }}
          onLoadDemo={handleLoadDemoData}
          onNavigate={navigate}
          detailRecordId={activeTab === 'dashboard' ? hash.split('/')[1] : undefined}
        />
      )}
      
      {activeTab === 'screenings' && <Screenings companies={companies} allTests={masterTests} />}
      {activeTab === 'quotes' && (
        <Quotes
          companies={companies}
          allTests={masterTests}
          onGoToDashboard={() => navigate('dashboard')}
          detailQuoteId={hash.startsWith('quotes/') ? hash.split('/')[1] : undefined}
          onNavigate={navigate}
        />
      )}
      {activeTab === 'calendar' && <Calendar onGoToDashboard={() => navigate('dashboard')} />}
      {activeTab === 'equipment' && <Equipment onGoToDashboard={() => navigate('dashboard')} />}
      {activeTab === 'team' && <Team onGoToDashboard={() => navigate('dashboard')} />}

      {activeTab === 'companies' && (
        <CompanyManager 
          companies={companies}
          records={records}
          allTests={masterTests}
          onUpdateCompanies={setCompanies}
        />
      )}

      {activeTab === 'config' && (
        <TestConfig 
          tests={masterTests}
          onUpdateTests={(tests) => {
              setMasterTests(tests);
              addNotification('success', 'Test tanımları güncellendi.');
          }}
        />
      )}

      {/* Ayarlar — kullanıcılar, AI ve veri yönetimi tek çatı altında */}
      {(activeTab === 'settings' || activeTab === 'users' || activeTab === 'ai') && (
          <Settings
             initialTab={settingsTab}
             onNavigate={navigate}
             fullState={{
                 companies, tests: masterTests, records,
                 users: storageService.getUsers(),
                 screenings: storageService.getScreenings(),
                 quotes: storageService.getQuotes(),
                 events: storageService.getEvents(),
                 equipment: storageService.getEquipment(),
                 team: storageService.getTeam(),
                 orgInfo
             }}
             onRestore={handleRestoreState}
             onReset={handleResetState}
             onLoadDemo={handleLoadDemoData}
             addNotification={addNotification}
             onOrgSaved={setOrgInfo}
          />
      )}
    </Layout>

    {/* Global Confirm Modal */}
    <ConfirmModal
      open={confirmState.open}
      title={confirmState.title}
      message={confirmState.message}
      variant={confirmState.variant}
      onConfirm={confirmState.onConfirm}
      onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
    />
    </>
  );
}

export default App;