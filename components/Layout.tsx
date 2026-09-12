import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Activity, LayoutDashboard, Building2, Menu, ChevronLeft, ChevronRight, ChevronDown, LogOut, FlaskConical, Settings as SettingsIcon, Search, Bell, FileText, UserCheck, Stethoscope, CalendarDays, Package, HardHat, Home, type LucideIcon } from 'lucide-react';
import { User, Company, PatientRecord, OrgInfo } from '../types';
import { storageService } from '../services/storageService';
import { updateAppearance } from '../services/appearance';

interface SidebarStats {
    records: number;
    companies: number;
    tests: number;
    users?: number;
}

interface NavItem {
    id: string;
    icon: LucideIcon;
    label: string;
    badge?: number;
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser: User;
  onLogout: () => void;
  stats?: SidebarStats;
  companies?: Company[];
  records?: PatientRecord[];
  org?: OrgInfo;
}

const getInitials = (name: string) =>
    name.split(' ').map(part => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

/** Sayfa başlığı + breadcrumb grubu */
const PAGE_META: Record<string, { title: string; group: string }> = {
    home: { title: 'Dashboard', group: 'Genel' },
    dashboard: { title: 'Sonuçlar', group: 'Genel' },
    screenings: { title: 'Taramalar', group: 'Mobil Tarama' },
    quotes: { title: 'Teklifler', group: 'Mobil Tarama' },
    calendar: { title: 'Takvim', group: 'Mobil Tarama' },
    equipment: { title: 'Ekipman', group: 'Mobil Tarama' },
    team: { title: 'Ekip', group: 'Mobil Tarama' },
    companies: { title: 'Firmalar', group: 'Yönetim' },
    config: { title: 'Test Havuzu', group: 'Yönetim' },
    users: { title: 'Ayarlar', group: 'Sistem' },
    ai: { title: 'Ayarlar', group: 'Sistem' },
    settings: { title: 'Ayarlar', group: 'Sistem' }
};

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange, currentUser, onLogout, stats, companies = [], records = [], org }) => {
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [isDesktopCollapsed, setDesktopCollapsed] = useState(() => storageService.getAppearance().sidebarCollapsed);
  const [edgeTooltip, setEdgeTooltip] = useState<{ label: string; badge?: number; top: number } | null>(null);

  // Topbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const isSuperAdmin = currentUser.role === 'super_admin';
  const pageMeta = PAGE_META[activeTab] ?? { title: 'Sonuçlar', group: 'Genel' };

  // Canlı saat — dakikada bir güncellenir
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Arama kutusu dışına tıklanınca kapat
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
        if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
            setSearchFocused(false);
        }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Bekleyen incelemeler → bildirim
  const pendingReviews = useMemo(() => records.filter(r => !r.isReviewed), [records]);

  // Global arama sonuçları
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return null;
    return {
        companies: companies.filter(c => c.name.toLowerCase().includes(q)).slice(0, 4),
        records: records.filter(r =>
            r.patientName.toLowerCase().includes(q) ||
            r.registrationNumber?.toLowerCase().includes(q)
        ).slice(0, 6)
    };
  }, [searchQuery, companies, records]);

  const companyNameOf = (companyId: string) =>
    companies.find(c => c.id === companyId)?.name ?? '—';

  const goTo = (tab: string) => {
    setSearchQuery('');
    setSearchFocused(false);
    setNotifOpen(false);
    setUserMenuOpen(false);
    onTabChange(tab);
  };

  const toggleDesktop = () => {
      const next = !isDesktopCollapsed;
      setDesktopCollapsed(next);
      updateAppearance({ sidebarCollapsed: next }); // tercihi hatırla
  };

  const showEdgeTooltip = (e: React.SyntheticEvent, item: NavItem) => {
      if (!isDesktopCollapsed) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setEdgeTooltip({ label: item.label, badge: item.badge, top: rect.top + rect.height / 2 });
  };

  const navGroups: NavGroup[] = [
    {
      label: 'Genel',
      items: [
        { id: 'home', icon: Home, label: 'Dashboard' },
        { id: 'dashboard', icon: LayoutDashboard, label: 'Sonuçlar', badge: stats?.records }
      ]
    },
    {
      label: 'Mobil Tarama',
      items: [
        { id: 'screenings', icon: Stethoscope, label: 'Taramalar' },
        { id: 'quotes', icon: FileText, label: 'Teklifler' },
        { id: 'calendar', icon: CalendarDays, label: 'Takvim' },
        { id: 'equipment', icon: Package, label: 'Ekipman' },
        { id: 'team', icon: HardHat, label: 'Ekip' }
      ]
    },
    {
      label: 'Yönetim',
      items: [
        { id: 'companies', icon: Building2, label: 'Firmalar', badge: stats?.companies },
        { id: 'config', icon: FlaskConical, label: 'Test Havuzu', badge: stats?.tests }
      ]
    },
    {
      label: 'Sistem',
      items: [
        { id: 'settings', icon: SettingsIcon, label: 'Ayarlar' }
      ]
    }
  ];

  const renderNavLink = (item: NavItem) => {
    const isActive = activeTab === item.id;
    return (
      <a
        key={item.id}
        href={`#/${item.id}`}
        onClick={() => { onTabChange(item.id); setMobileOpen(false); }}
        onMouseEnter={(e) => showEdgeTooltip(e, item)}
        onMouseLeave={() => setEdgeTooltip(null)}
        onFocus={(e) => showEdgeTooltip(e, item)}
        onBlur={() => setEdgeTooltip(null)}
        className={`relative flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-300 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            isActive
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50/60 text-blue-700 shadow-sm shadow-blue-100/50 ring-1 ring-blue-100'
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        } ${isDesktopCollapsed ? 'justify-center px-0' : ''}`}
      >
        {/* Active Indicator Bar */}
        {isActive && (
          <div className={`absolute top-1/2 -translate-y-1/2 h-6 w-1 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shadow-sm shadow-blue-300 ${isDesktopCollapsed ? '-left-4' : 'left-0'}`} />
        )}

        <item.icon
            size={22}
            className={`shrink-0 transition-transform duration-300 ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'} ${isActive ? 'scale-110' : 'group-hover:scale-105'}`}
            strokeWidth={isActive ? 2.5 : 2}
        />
        
        {!isDesktopCollapsed && (
            <>
              <span className={`flex-1 tracking-wide ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums transition-colors ${
                  isActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                }`}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </>
        )}

        {/* Collapsed badge dot */}
        {isDesktopCollapsed && typeof item.badge === 'number' && item.badge > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white" />
        )}
      </a>
    );
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden bg-slate-50">
      
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed md:sticky top-0 h-screen z-50 
          bg-white/80 backdrop-blur-xl border-r border-slate-200/60
          shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isDesktopCollapsed ? 'w-[88px]' : 'w-72'}
        `}
      >
        {/* Header */}
        <div className={`h-20 flex items-center ${isDesktopCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
          <a href="#/home" className="flex items-center gap-3.5">
            <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity duration-500"></div>
                <div className="relative w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white shadow-inner border border-white/10 shrink-0">
                    <Activity size={22} className="drop-shadow-sm" />
                </div>
            </div>
            {!isDesktopCollapsed && (
              <div className="flex flex-col animate-in fade-in slide-in-from-left-2 duration-500 min-w-0">
                  <h1 className="font-bold text-xl tracking-tight text-slate-900 leading-none truncate max-w-[170px]">{org?.name || 'HanTech'}</h1>
                  <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest mt-1 truncate max-w-[170px]">{org?.tagline || 'Mobil Sağlık'}</span>
              </div>
            )}
          </a>
          
          {/* Mobile Close */}
          <button 
            onClick={() => setMobileOpen(false)} 
            className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.label}>
              {!isDesktopCollapsed && (
                <p className="px-3.5 mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {group.label}
                </p>
              )}
              {isDesktopCollapsed && <div className="mx-3 mb-2 h-px bg-slate-200/70" />}
              <div className="space-y-1.5">
                {group.items.map((item) => renderNavLink(item))}
              </div>
            </div>
          ))}
        </nav>
        
        {/* Collapsed Nav Tooltip — nav'ın overflow'u dışında, aside seviyesinde */}
        {isDesktopCollapsed && edgeTooltip && (
            <div
                className="pointer-events-none fixed left-24 z-[70] -translate-y-1/2 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-150"
                style={{ top: edgeTooltip.top }}
            >
                {edgeTooltip.label}
                {typeof edgeTooltip.badge === 'number' && edgeTooltip.badge > 0 && (
                    <span className="ml-1.5 text-blue-300 tabular-nums">({edgeTooltip.badge})</span>
                )}
            </div>
        )}

        {/* User Footer */}
        <div className={`p-4 mt-auto border-t border-slate-100 bg-slate-50/50 ${isDesktopCollapsed ? 'items-center' : ''}`}>
             <div className={`flex items-center gap-3 ${isDesktopCollapsed ? 'justify-center' : ''}`}>
                 <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shrink-0 border-2 border-white shadow-sm ${
                     isSuperAdmin ? 'bg-gradient-to-tr from-purple-500 to-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                 }`}>
                     {getInitials(currentUser.fullName)}
                     <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" title="Çevrimiçi" />
                 </div>
                 {!isDesktopCollapsed && (
                     <div className="flex-1 min-w-0">
                         <p className="text-sm font-bold text-slate-800 truncate">{currentUser.fullName}</p>
                         <span className={`inline-block mt-0.5 px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wide ${
                             isSuperAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-500'
                         }`}>
                             {isSuperAdmin ? 'Yönetici' : 'Personel'}
                         </span>
                     </div>
                 )}
                 {!isDesktopCollapsed && (
                     <button 
                        onClick={onLogout}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Çıkış Yap"
                     >
                         <LogOut size={18} />
                     </button>
                 )}
             </div>
             {/* Collapsed Logout */}
             {isDesktopCollapsed && (
                 <button 
                    onClick={onLogout}
                    className="w-full mt-4 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex justify-center"
                    title="Çıkış Yap"
                 >
                     <LogOut size={18} />
                 </button>
             )}
        </div>

        {/* Edge Collapse Handle */}
        <button
            onClick={toggleDesktop}
            className="hidden md:flex absolute top-1/2 -translate-y-1/2 -right-3.5 z-[60] w-7 h-7 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 shadow-md shadow-slate-300/50 hover:text-blue-600 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-200/50 hover:scale-110 active:scale-95 transition-all duration-300"
            title={isDesktopCollapsed ? 'Menüyü Genişlet' : 'Menüyü Daralt'}
        >
            {isDesktopCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 h-screen overflow-y-auto overflow-x-hidden scroll-smooth">

        {/* ═══ TOPBAR ═══ */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/70 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 h-16 px-4 md:px-6">

            {/* Mobile: hamburger + logo */}
            <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
                <Menu size={20} />
            </button>
            <div className="md:hidden flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Activity size={17}/></div>
                <span className="font-bold text-slate-800">{org?.name || 'HanTech'}</span>
            </div>

            {/* Desktop: breadcrumb + sayfa başlığı */}
            <div className="hidden md:block min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span>{org?.name || 'HanTech OSGB'}</span>
                    <ChevronRight size={10} />
                    <span className="text-blue-600">{pageMeta.group}</span>
                </div>
                <h1 className="text-base font-black text-slate-800 tracking-tight leading-tight truncate">{pageMeta.title}</h1>
            </div>

            <div className="flex-1" />

            {/* Global arama */}
            <div ref={searchBoxRef} className="relative hidden sm:block w-56 lg:w-72">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setSearchQuery(''); setSearchFocused(false); } }}
                    placeholder="Firma veya hasta ara..."
                    className="w-full pl-9 pr-9 py-2 text-xs bg-slate-100/80 border border-transparent rounded-xl focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-100 outline-none transition-all placeholder-slate-400"
                />
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:flex items-center px-1.5 py-0.5 text-[9px] font-bold text-slate-400 bg-white border border-slate-200 rounded-md shadow-sm">ESC</kbd>

                {/* Arama sonuçları */}
                {searchFocused && searchResults && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        {searchResults.companies.length === 0 && searchResults.records.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">Sonuç bulunamadı</div>
                        ) : (
                            <div className="max-h-80 overflow-y-auto py-2">
                                {searchResults.companies.length > 0 && (
                                    <div className="px-3 pt-1 pb-1">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">Firmalar</p>
                                        {searchResults.companies.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => goTo('companies')}
                                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                                            >
                                                <Building2 size={14} className="text-slate-400 shrink-0" />
                                                <span className="text-xs font-semibold text-slate-700 truncate">{c.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {searchResults.records.length > 0 && (
                                    <div className="px-3 pt-1 pb-1 border-t border-slate-100">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1 mt-1">Hasta Kayıtları</p>
                                        {searchResults.records.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => goTo('dashboard')}
                                                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                                            >
                                                <FileText size={14} className="text-slate-400 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-slate-700 truncate">{r.patientName}</p>
                                                    <p className="text-[10px] text-slate-400 truncate">{companyNameOf(r.companyId)} • {r.date}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Saat + tarih */}
            <div className="hidden xl:flex flex-col items-end leading-tight mr-1">
                <span className="text-sm font-black text-slate-700 tabular-nums">
                    {now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-[10px] font-semibold text-slate-400 capitalize">
                    {now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}
                </span>
            </div>

            {/* Bildirimler */}
            <div className="relative">
                <button
                    onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
                    className={`relative p-2.5 rounded-xl transition-all ${notifOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
                    title="Bildirimler"
                >
                    <Bell size={18} />
                    {pendingReviews.length > 0 && (
                        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white tabular-nums">
                            {pendingReviews.length > 9 ? '9+' : pendingReviews.length}
                        </span>
                    )}
                </button>

                {notifOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-xs font-bold text-slate-800">Bildirimler</h3>
                                {pendingReviews.length > 0 && (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{pendingReviews.length} bekleyen</span>
                                )}
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                                {pendingReviews.length === 0 ? (
                                    <div className="p-6 text-center">
                                        <UserCheck size={24} className="mx-auto text-emerald-400 mb-2" />
                                        <p className="text-xs font-semibold text-slate-600">Tüm kayıtlar incelendi</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Bekleyen inceleme yok</p>
                                    </div>
                                ) : (
                                    pendingReviews.slice(0, 8).map(r => (
                                        <button
                                            key={r.id}
                                            onClick={() => goTo('dashboard')}
                                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors border-b border-slate-50 last:border-0"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
                                                <FileText size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-slate-700 truncate">{r.patientName}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{companyNameOf(r.companyId)} • {r.date}</p>
                                                <p className="text-[9px] font-bold text-amber-500 mt-0.5 uppercase tracking-wide">İnceleme bekliyor</p>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                            {pendingReviews.length > 0 && (
                                <button
                                    onClick={() => goTo('dashboard')}
                                    className="w-full py-2.5 text-[11px] font-bold text-blue-600 hover:bg-blue-50 transition-colors border-t border-slate-100"
                                >
                                    Tümünü Gör
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Kullanıcı menüsü */}
            <div className="relative">
                <button
                    onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
                    className={`flex items-center gap-2.5 pl-1.5 pr-2 py-1.5 rounded-xl transition-all border ${userMenuOpen ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-100 border-transparent'}`}
                >
                    <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                        isSuperAdmin ? 'bg-gradient-to-tr from-purple-500 to-purple-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                        {getInitials(currentUser.fullName)}
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                    </div>
                    <div className="hidden md:block text-left leading-tight">
                        <p className="text-xs font-bold text-slate-800 truncate max-w-[120px]">{currentUser.fullName}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{isSuperAdmin ? 'Yönetici' : 'Personel'}</p>
                    </div>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {userMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/60 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                <p className="text-xs font-bold text-slate-800">{currentUser.fullName}</p>
                                <p className="text-[10px] text-slate-400 font-mono">@{currentUser.username}</p>
                            </div>
                            <div className="py-1.5">
                                <button
                                    onClick={() => goTo('settings')}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                                >
                                    <SettingsIcon size={14} className="text-slate-400" /> Ayarlar
                                </button>
                            </div>
                            <div className="border-t border-slate-100 py-1.5">
                                <button
                                    onClick={onLogout}
                                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <LogOut size={14} /> Çıkış Yap
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

          </div>
        </header>

        <div className="p-4 md:p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
          {children}
        </div>
      </main>
    </div>
  );
};
