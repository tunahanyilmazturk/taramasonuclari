import React, { useState, useMemo } from 'react';
import { Company, PatientRecord, HazardClass, TestDefinition, Screening, Quote, ScreeningStatus, QuoteStatus } from '../types';
import { testCategory } from '../constants';
import { isAbnormalStatus } from '../utils/lab';
import { storageService } from '../services/storageService';
import { ConfirmModal } from './ConfirmModal';
import { Modal, modalPanel } from './Modal';
import { usePagination } from '../hooks/usePagination';
import { BulkActionBar } from './shared/BulkActionBar';
import { PaginationControls } from './shared/PaginationControls';
import { ViewToggle } from './shared/ViewToggle';
import { getInitialView } from '../utils/viewToggle';
import {
  Building2, Plus, Save, Trash2, Search, Copy,
  User, FileText, FlaskConical, Check,
  Phone, Users as UsersIcon, Factory, AlertTriangle,
  Edit2, StickyNote, X, ArrowLeft, CalendarDays, Mail, MapPin,
  Stethoscope, ChevronRight, Activity, ClipboardList, Eye, CheckCircle2, Clock
} from 'lucide-react';

const emptyCompanyForm = (): Partial<Company> => ({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    sector: '',
    hazardClass: undefined,
    employeeCount: undefined,
    notes: '',
    tests: []
});

const HAZARD_CLASSES: Record<HazardClass, { label: string; badge: string; dot: string; avatar: string }> = {
    az_tehlikeli: {
        label: 'Az Tehlikeli',
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        avatar: 'bg-emerald-600'
    },
    tehlikeli: {
        label: 'Tehlikeli',
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        avatar: 'bg-amber-500'
    },
    cok_tehlikeli: {
        label: 'Çok Tehlikeli',
        badge: 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-500',
        avatar: 'bg-red-500'
    }
};

// ─── Firma detay sekmeleri (#/companies/<id>/<sekme>) ───
type CompanyTab = 'genel' | 'taramalar' | 'teklifler' | 'sonuclar' | 'sablon';
const COMPANY_TAB_IDS: readonly string[] = ['genel', 'taramalar', 'teklifler', 'sonuclar', 'sablon'];

const SCR_STATUS: Record<ScreeningStatus, { label: string; badge: string }> = {
    planlandi:    { label: 'Planlandı',    badge: 'bg-blue-50 text-blue-600 border-blue-200' },
    devam_ediyor: { label: 'Devam Ediyor', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    tamamlandi:   { label: 'Tamamlandı',   badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    iptal:        { label: 'İptal',        badge: 'bg-slate-100 text-slate-500 border-slate-200' }
};

const QUOTE_STATUS: Record<QuoteStatus, { label: string; badge: string; dot: string }> = {
    taslak:     { label: 'Taslak',     badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400' },
    gonderildi: { label: 'Gönderildi', badge: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
    onaylandi:  { label: 'Onaylandı',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    reddedildi: { label: 'Reddedildi', badge: 'bg-red-50 text-red-600 border-red-200',          dot: 'bg-red-500' }
};

const fmtMoney = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const quoteTotal = (q: Quote) => {
    const sub = q.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const disc = q.discountType === 'amount' ? q.discountRate : sub * q.discountRate / 100;
    return (sub - disc) * (1 + q.vatRate / 100);
};

const isQuoteExpired = (q: Quote) => q.status === 'gonderildi' && q.validUntil < new Date().toISOString().slice(0, 10);

interface CompanyManagerProps {
  companies: Company[];
  records?: PatientRecord[];
  allTests?: TestDefinition[];
  onUpdateCompanies: (companies: Company[]) => void;
  detailCompanyId?: string; // #/companies/<id> alt rotasından gelen firma kimliği
  detailTab?: string;       // #/companies/<id>/<sekme> üçüncü segment
  onNavigate?: (route: string) => void;
  onBack?: (fallback: string) => void; // uygulama içi geri — önceki sayfaya döner
}

export const CompanyManager: React.FC<CompanyManagerProps> = ({
  companies,
  records = [],
  allTests = [],
  onUpdateCompanies,
  detailCompanyId,
  detailTab,
  onNavigate,
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [hazardFilter, setHazardFilter] = useState<'all' | HazardClass>('all');

  // ── Firma detayı — URL'den türetilir (#/companies/<id>/<sekme>) ──
  const [localDetailId, setLocalDetailId] = useState<string | null>(null); // onNavigate yoksa yedek
  const [localTab, setLocalTab] = useState<CompanyTab>('genel');
  const activeDetailId = detailCompanyId ?? localDetailId;
  const detailCompany = activeDetailId ? companies.find(c => c.id === activeDetailId) ?? null : null;
  const activeDetailTab: CompanyTab = (COMPANY_TAB_IDS as readonly string[]).includes(detailTab ?? '')
    ? detailTab as CompanyTab
    : localTab;

  // ── Şablon modalı state ──
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateTestIds, setTemplateTestIds] = useState<Set<string>>(new Set());
  const [templateSearch, setTemplateSearch] = useState('');

  // ── Şablon modalı yardımcıları ──
  const filteredTemplateTests = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    if (!q) return allTests;
    return allTests.filter(t => t.name.toLowerCase().includes(q));
  }, [allTests, templateSearch]);
  const templateTestsByCategory = useMemo(() => {
    const m = new Map<string, TestDefinition[]>();
    filteredTemplateTests.forEach(t => {
      const cat = testCategory(t);
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(t);
    });
    return [...m.entries()];
  }, [filteredTemplateTests]);
  const openTemplateModal = () => {
    if (!detailCompany) return;
    setTemplateTestIds(new Set(detailCompany.tests.map(t => t.id)));
    setTemplateSearch('');
    setShowTemplateModal(true);
  };
  const toggleTemplateTest = (id: string) => {
    setTemplateTestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const saveTemplate = () => {
    if (!detailCompany) return;
    const selectedTests = allTests.filter(t => templateTestIds.has(t.id));
    onUpdateCompanies(companies.map(c => c.id === detailCompany.id ? { ...c, tests: selectedTests } : c));
    setShowTemplateModal(false);
  };

  // Form modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Company>>(emptyCompanyForm());
  const [formError, setFormError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClone, setConfirmClone] = useState<Company | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [listMode, setListMode] = useState<'card' | 'list'>(() => getInitialView('companies', 'list'));

  const filteredCompanies = useMemo(() => {
      const q = searchTerm.trim().toLowerCase();
      return companies.filter(c => {
          if (hazardFilter !== 'all' && c.hazardClass !== hazardFilter) return false;
          if (!q) return true;
          return (
              c.name.toLowerCase().includes(q) ||
              c.contactPerson?.toLowerCase().includes(q) ||
              c.sector?.toLowerCase().includes(q)
          );
      });
  }, [companies, searchTerm, hazardFilter]);

  const {
    paginatedItems: paginatedCompanies,
    currentPage, totalPages, pageSize, setCurrentPage, setPageSize,
    totalItems, startIndex, endIndex
  } = usePagination(filteredCompanies, 'companies', 7);

  const recordCountOf = (companyId: string) => records.filter(r => r.companyId === companyId).length;

  // ── Detay navigasyonu ──
  const openDetail = (company: Company) => {
      setLocalTab('genel');
      if (onNavigate) onNavigate(`companies/${company.id}`);
      else setLocalDetailId(company.id);
  };

  /** Detaydan geri dön — önceki sayfaya gider, yoksa listeye düşer */
  const closeDetail = () => {
      setLocalDetailId(null);
      if (onBack) onBack('companies');
      else onNavigate?.('companies');
  };

  const setDetailTab = (tab: CompanyTab) => {
      setLocalTab(tab);
      if (onNavigate && activeDetailId) onNavigate(`companies/${activeDetailId}/${tab}`);
  };

  // ── Detay verileri (firma seçiliyken hesaplanır) ──
  const companyScreenings = useMemo<Screening[]>(() =>
      detailCompany
        ? storageService.getScreenings()
            .filter(s => s.companyId === detailCompany.id)
            .sort((a, b) => b.date.localeCompare(a.date))
        : [],
  [detailCompany]);

  const companyQuotes = useMemo<Quote[]>(() =>
      detailCompany
        ? storageService.getQuotes()
            .filter(q => q.companyId === detailCompany.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
  [detailCompany]);

  const companyRecords = useMemo(() =>
      detailCompany
        ? records.filter(r => r.companyId === detailCompany.id).sort((a, b) => b.date.localeCompare(a.date))
        : [],
  [detailCompany, records]);

  const detailStats = useMemo(() => {
      const today = new Date().toISOString().slice(0, 10);
      const reviewed = companyRecords.filter(r => r.isReviewed).length;
      const anomalies = companyRecords.filter(r => Object.values(r.status).some(isAbnormalStatus)).length;
      const upcoming = companyScreenings.find(s => (s.status === 'planlandi' || s.status === 'devam_ediyor') && s.date >= today);
      const openQuotes = companyQuotes.filter(q => q.status === 'gonderildi' || q.status === 'taslak').length;
      return {
          reviewedPct: companyRecords.length ? Math.round(reviewed / companyRecords.length * 100) : 0,
          anomalies, upcoming, openQuotes,
          totalRevenue: companyQuotes.filter(q => q.status === 'onaylandi').reduce((s, q) => s + quoteTotal(q), 0)
      };
  }, [companyRecords, companyScreenings, companyQuotes]);

  /** Sekme rozet sayıları */
  const tabCounts = useMemo(() => ({
      taramalar: companyScreenings.length,
      teklifler: companyQuotes.length,
      sonuclar: companyRecords.length,
      sablon: detailCompany?.tests.length ?? 0
  }), [companyScreenings, companyQuotes, companyRecords, detailCompany]);

  /** Birleşik aktivite akışı — genel sekmesi */
  const activityFeed = useMemo(() => {
      const items: { key: string; date: string; text: string; sub: string; chip: string }[] = [
          ...companyScreenings.map(s => ({
              key: `scr-${s.id}`, date: s.date, text: s.title,
              sub: `Tarama · ${SCR_STATUS[s.status].label}`, chip: 'bg-emerald-50 text-emerald-600'
          })),
          ...companyQuotes.map(q => ({
              key: `quo-${q.id}`, date: q.createdAt, text: q.quoteNumber,
              sub: `Teklif · ${QUOTE_STATUS[q.status].label} · ${fmtMoney(quoteTotal(q))}`, chip: 'bg-emerald-50 text-emerald-600'
          })),
          ...companyRecords.map(r => ({
              key: `rec-${r.id}`, date: r.date, text: r.patientName,
              sub: `Sonuç · ${Object.keys(r.results).length} test${r.isReviewed ? ' · İncelendi' : ''}`, chip: 'bg-indigo-50 text-indigo-600'
          }))
      ];
      return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  }, [companyScreenings, companyQuotes, companyRecords]);

  // ── Form ──
  const openCreate = () => {
      setEditingId(null);
      setForm(emptyCompanyForm());
      setFormError('');
      setFormOpen(true);
  };

  const openEdit = (company: Company) => {
      setEditingId(company.id);
      setForm({ ...company });
      setFormError('');
      setFormOpen(true);
  };

  const saveForm = () => {
      if (!form.name?.trim()) {
          setFormError('Firma adı zorunludur.');
          return;
      }
      const base: Omit<Company, 'id'> = {
          name: form.name.trim(),
          tests: form.tests ?? [],
          contactPerson: form.contactPerson?.trim() || undefined,
          phone: form.phone?.trim() || undefined,
          email: form.email?.trim() || undefined,
          address: form.address?.trim() || undefined,
          sector: form.sector?.trim() || undefined,
          hazardClass: form.hazardClass,
          employeeCount: form.employeeCount,
          notes: form.notes?.trim() || undefined,
          reportSettings: form.reportSettings
      };

      if (editingId) {
          onUpdateCompanies(companies.map(c => c.id === editingId ? { ...base, id: editingId } : c));
      } else {
          onUpdateCompanies([...companies, { ...base, id: Date.now().toString() }]);
      }
      setFormOpen(false);
  };

  const doCloneCompany = () => {
    if (!confirmClone) return;
    const newCompany: Company = {
        ...confirmClone,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: `${confirmClone.name} (Kopya)`,
        tests: [...confirmClone.tests],
        reportSettings: { ...confirmClone.reportSettings }
    };
    onUpdateCompanies([...companies, newCompany]);
    setConfirmClone(null);
  };

  const doDeleteCompany = () => {
    if (!confirmDelete) return;
    onUpdateCompanies(companies.filter(c => c.id !== confirmDelete));
    if (editingId === confirmDelete) setFormOpen(false);
    if (activeDetailId === confirmDelete) closeDetail();
    setConfirmDelete(null);
  };

  const doBulkDelete = () => {
    onUpdateCompanies(companies.filter(c => !selectedIds.has(c.id)));
    if (activeDetailId && selectedIds.has(activeDetailId)) closeDetail();
    setSelectedIds(new Set());
    setBulkDeleteConfirm(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredCompanies.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredCompanies.map(c => c.id)));
  };

  const updateField = <K extends keyof Company>(key: K, value: Company[K] | undefined) =>
      setForm(prev => ({ ...prev, [key]: value }));

  // ── Test şablonu seçimi ──
  const formTestIds = useMemo(() => new Set((form.tests ?? []).map(t => t.id)), [form.tests]);

  const toggleFormTest = (test: TestDefinition) => {
      const current = form.tests ?? [];
      updateField('tests', formTestIds.has(test.id) ? current.filter(t => t.id !== test.id) : [...current, test]);
  };

  const testsByCategory = useMemo(() => {
      const map = new Map<string, TestDefinition[]>();
      allTests.forEach(t => {
          const cat = testCategory(t);
          if (!map.has(cat)) map.set(cat, []);
          map.get(cat)!.push(t);
      });
      return [...map.entries()];
  }, [allTests]);

  const inputCls = "w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all placeholder-slate-400";
  const labelCls = "block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide";

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">

      {/* ══════════════ FİRMA DETAYI ══════════════ */}
      {activeDetailId && (
        detailCompany ? (
          (() => {
            const hazard = detailCompany.hazardClass ? HAZARD_CLASSES[detailCompany.hazardClass] : null;
            return (
          <>
          {/* Üst bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={closeDetail} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
              <ArrowLeft size={15} /> Firmalara Dön
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => onNavigate?.('quotes/new/' + detailCompany.id)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 rounded-xl transition-colors">
                <FileText size={13} /> Yeni Teklif
              </button>
              <button onClick={() => onNavigate?.('screenings/new/' + detailCompany.id)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700 rounded-xl transition-colors">
                <Stethoscope size={13} /> Yeni Tarama
              </button>
              <button onClick={openTemplateModal} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700 rounded-xl transition-colors">
                <ClipboardList size={13} /> Şablon Oluştur
              </button>
              <span className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />
              <button onClick={() => openEdit(detailCompany)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-700 rounded-xl transition-colors">
                <Edit2 size={13} /> Düzenle
              </button>
              <button onClick={() => setConfirmClone(detailCompany)} className="p-2 text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors" title="Kopyala"><Copy size={14} /></button>
              <button onClick={() => setConfirmDelete(detailCompany.id)} className="p-2 text-xs font-bold bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200 rounded-xl transition-colors" title="Sil"><Trash2 size={14} /></button>
            </div>
          </div>

          {/* ── Firma Kartı ── */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200">
            <div className="absolute -right-16 -top-16 w-56 h-56 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -left-10 -bottom-20 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-black text-white shadow-lg shrink-0 ${hazard?.avatar ?? 'bg-blue-600'}`}>
                  {detailCompany.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-black truncate">{detailCompany.name}</h2>
                    {hazard && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-slate-200 whitespace-nowrap">
                        {hazard.label}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-xs mt-1 flex items-center gap-1.5">
                    <Factory size={11} className="shrink-0" />
                    {detailCompany.sector || 'Sektör belirtilmemiş'}
                    {detailCompany.employeeCount !== undefined && ` · ${detailCompany.employeeCount} çalışan`}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-slate-300">
                    {detailCompany.contactPerson && <span className="flex items-center gap-1"><User size={11} className="text-slate-500" />{detailCompany.contactPerson}</span>}
                    {detailCompany.phone && <span className="flex items-center gap-1"><Phone size={11} className="text-slate-500" />{detailCompany.phone}</span>}
                    {detailCompany.email && <span className="flex items-center gap-1"><Mail size={11} className="text-slate-500" />{detailCompany.email}</span>}
                    {detailCompany.address && <span className="flex items-center gap-1"><MapPin size={11} className="text-slate-500" /><span className="truncate max-w-[260px]">{detailCompany.address}</span></span>}
                  </div>
                </div>
              </div>

              {/* Stat şeridi */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
                {[
                  { v: companyScreenings.length, l: 'Tarama' },
                  { v: companyQuotes.length, l: 'Teklif' },
                  { v: companyRecords.length, l: 'Kayıt' },
                  { v: `%${detailStats.reviewedPct}`, l: 'İncelenme' }
                ].map(s => (
                  <div key={s.l} className="bg-white/[0.07] border border-white/10 rounded-2xl px-4 py-3 text-center min-w-[86px]">
                    <p className="text-lg font-black tabular-nums">{s.v}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sekmeler ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex gap-1 overflow-x-auto scrollbar-none shadow-sm">
            {([
              { id: 'genel',     label: 'Genel Bakış',  icon: Activity },
              { id: 'taramalar', label: 'Taramalar',    icon: Stethoscope, count: tabCounts.taramalar },
              { id: 'teklifler', label: 'Teklifler',    icon: FileText,    count: tabCounts.teklifler },
              { id: 'sonuclar',  label: 'Sonuçlar',     icon: FlaskConical, count: tabCounts.sonuclar },
              { id: 'sablon',    label: 'Test Şablonu', icon: ClipboardList, count: tabCounts.sablon }
            ] as { id: CompanyTab; label: string; icon: React.ElementType; count?: number }[]).map(t => {
              const active = activeDetailTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setDetailTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    active ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                  }`}
                >
                  <t.icon size={14} className={active ? 'text-blue-400' : 'text-slate-400'} />
                  {t.label}
                  {t.count !== undefined && t.count > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tabular-nums ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {t.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ═══ SEKME: GENEL BAKIŞ ═══ */}
          {activeDetailTab === 'genel' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* İletişim & Profil */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <User size={12} className="text-blue-500" /> İletişim & Profil
                  </div>
                  <div className="p-5 space-y-3">
                    {[
                      { icon: User, l: 'Yetkili', v: detailCompany.contactPerson },
                      { icon: Phone, l: 'Telefon', v: detailCompany.phone },
                      { icon: Mail, l: 'E-posta', v: detailCompany.email },
                      { icon: MapPin, l: 'Adres', v: detailCompany.address }
                    ].map(r => (
                      <div key={r.l} className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-slate-50 text-slate-400 flex items-center justify-center shrink-0"><r.icon size={13} /></div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{r.l}</p>
                          <p className={`text-xs font-semibold ${r.v ? 'text-slate-700' : 'text-slate-300 italic'}`}>{r.v || 'Girilmemiş'}</p>
                        </div>
                      </div>
                    ))}
                    {detailCompany.notes && (
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wide flex items-center gap-1 mb-1"><StickyNote size={11} /> Not</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{detailCompany.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operasyon Özeti */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList size={12} className="text-blue-500" /> Operasyon Özeti
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Toplam Tarama</span>
                      <span className="font-black text-slate-800 tabular-nums">{companyScreenings.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Açık Teklif</span>
                      <span className="font-black text-slate-800 tabular-nums">{detailStats.openQuotes}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Onaylı Teklif Hacmi</span>
                      <span className="font-black text-emerald-600 tabular-nums">{fmtMoney(detailStats.totalRevenue)}</span>
                    </div>
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Sonraki Tarama</p>
                      {detailStats.upcoming ? (
                        <div className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                          <CalendarDays size={14} className="text-blue-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-blue-800 truncate">{detailStats.upcoming.title}</p>
                            <p className="text-[10px] text-blue-500">{fmtDate(detailStats.upcoming.date)} · {detailStats.upcoming.location || 'Konum yok'}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-300 italic">Yaklaşan tarama yok</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sonuç İlerlemesi */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Eye size={12} className="text-blue-500" /> Sonuç İlerlemesi
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-500 font-semibold">İncelenen Kayıt</span>
                        <span className="font-black text-slate-800 tabular-nums">%{detailStats.reviewedPct}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${detailStats.reviewedPct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${detailStats.reviewedPct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Anormallik İçeren Kayıt</span>
                      <span className={`font-black tabular-nums ${detailStats.anomalies > 0 ? 'text-red-600' : 'text-slate-800'}`}>{detailStats.anomalies}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Şablon Test Sayısı</span>
                      <span className="font-black text-slate-800 tabular-nums">{detailCompany.tests.length}</span>
                    </div>
                    <button onClick={() => setDetailTab('sonuclar')} className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
                      Sonuçlara Git <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Son Aktiviteler */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={12} className="text-blue-500" /> Son Aktiviteler
                </div>
                {activityFeed.length === 0 ? (
                  <p className="p-6 text-xs text-slate-300 italic text-center">Bu firmaya ait aktivite yok — teklif, tarama veya sonuç ekleyin.</p>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {activityFeed.map(a => (
                      <div key={a.key} className="px-5 py-3 flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide shrink-0 ${a.chip}`}>
                          {a.sub.split(' · ')[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-700 truncate">{a.text}</p>
                          <p className="text-[10px] text-slate-400 truncate">{a.sub}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0 tabular-nums">{fmtDate(a.date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ SEKME: TARAMALAR ═══ */}
          {activeDetailTab === 'taramalar' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {companyScreenings.length === 0 ? (
                <div className="p-10 text-center">
                  <Stethoscope size={28} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-sm font-bold text-slate-600">Tarama yok</p>
                  <p className="text-xs text-slate-400 mt-1">Bu firmaya ait planlanmış tarama bulunmuyor.</p>
                  <button onClick={() => onNavigate?.('screenings')} className="mt-4 px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">Tarama Planla</button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {companyScreenings.map(s => {
                    const pct = s.plannedCount > 0 ? Math.min(100, Math.round(s.completedCount / s.plannedCount * 100)) : 0;
                    return (
                      <button key={s.id} onClick={() => onNavigate?.('screenings')} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50/60 transition-colors text-left group">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-500 flex flex-col items-center justify-center shrink-0">
                          <span className="text-sm font-black leading-none">{s.date.slice(8, 10)}</span>
                          <span className="text-[8px] font-bold uppercase">{new Date(s.date).toLocaleDateString('tr-TR', { month: 'short' })}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800 truncate">{s.title}</p>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${SCR_STATUS[s.status].badge}`}>{SCR_STATUS[s.status].label}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1"><MapPin size={10} />{s.location || '—'}</span>
                            <span className="flex items-center gap-1"><FlaskConical size={10} />{s.testIds.length} test</span>
                            <span className="flex items-center gap-1"><UsersIcon size={10} />{s.completedCount}/{s.plannedCount} kişi</span>
                          </p>
                          <div className="mt-1.5 h-1.5 w-40 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${s.status === 'tamamlandi' ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ SEKME: TEKLİFLER ═══ */}
          {activeDetailTab === 'teklifler' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {companyQuotes.length === 0 ? (
                <div className="p-10 text-center">
                  <FileText size={28} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-sm font-bold text-slate-600">Teklif yok</p>
                  <p className="text-xs text-slate-400 mt-1">Bu firmaya hazırlanmış teklif bulunmuyor.</p>
                  <button onClick={() => onNavigate?.('quotes')} className="mt-4 px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">Teklif Oluştur</button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {companyQuotes.map(q => {
                    const meta = QUOTE_STATUS[q.status];
                    const expired = isQuoteExpired(q);
                    return (
                      <button key={q.id} onClick={() => onNavigate?.(`quotes/${q.id}`)} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50/60 transition-colors text-left group">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-slate-800 font-mono">{q.quoteNumber}</p>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${meta.badge}`}>{meta.label}</span>
                            {expired && <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-red-50 text-red-600 border border-red-200">SÜRESİ DOLDU</span>}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {q.title || `${q.items.length} kalem`} · {fmtDate(q.createdAt)} → {fmtDate(q.validUntil)}
                          </p>
                        </div>
                        <span className="text-sm font-black text-slate-800 tabular-nums shrink-0">{fmtMoney(quoteTotal(q))}</span>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ SEKME: SONUÇLAR ═══ */}
          {activeDetailTab === 'sonuclar' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              {companyRecords.length === 0 ? (
                <div className="p-10 text-center">
                  <FlaskConical size={28} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-sm font-bold text-slate-600">Sonuç kaydı yok</p>
                  <p className="text-xs text-slate-400 mt-1">Bu firmaya ait hasta sonucu bulunmuyor.</p>
                  <button onClick={() => onNavigate?.('dashboard')} className="mt-4 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors">Sonuç Ekle</button>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {companyRecords.map(r => {
                    const testCount = Object.keys(r.results).length;
                    const abnormalCount = Object.values(r.status).filter(isAbnormalStatus).length;
                    return (
                      <button key={r.id} onClick={() => onNavigate?.(`dashboard/${r.id}`)} className="w-full px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/60 transition-colors text-left group">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0 ${r.isReviewed ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                          {r.isReviewed ? <Check size={14} /> : r.patientName.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800 truncate">{r.patientName}</p>
                            {r.isReviewed && <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600"><CheckCircle2 size={10} /> İncelendi</span>}
                            {abnormalCount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">{abnormalCount} anormal</span>}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {r.jobTitle || 'Personel'} · {fmtDate(r.date)} · {testCount} test
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ═══ SEKME: TEST ŞABLONU ═══ */}
          {activeDetailTab === 'sablon' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <ClipboardList size={12} className="text-blue-500" /> Firma Test Şablonu · {detailCompany.tests.length} test
                </span>
                <button onClick={openTemplateModal} className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  <Edit2 size={11} /> Düzenle
                </button>
              </div>
              {detailCompany.tests.length === 0 ? (
                <div className="p-10 text-center">
                  <ClipboardList size={28} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-sm font-bold text-slate-600">Şablon tanımlanmamış</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Firma için varsayılan test seti tanımlanırsa tarama ve teklif oluştururken otomatik önerilir.</p>
                  <button onClick={openTemplateModal} className="mt-4 px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">Şablon Tanımla</button>
                </div>
              ) : (
                <div className="p-5 space-y-4">
                  {(() => {
                    const groups = new Map<string, TestDefinition[]>();
                    detailCompany.tests.forEach(t => {
                      const cat = testCategory(t);
                      if (!groups.has(cat)) groups.set(cat, []);
                      groups.get(cat)!.push(t);
                    });
                    return [...groups.entries()].map(([cat, tests]) => (
                      <div key={cat}>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{cat} · {tests.length}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {tests.map(t => (
                            <span key={t.id} className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg">{t.name}</span>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                  <p className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">Bu şablon; tarama oluştururken otomatik uygulanır, teklifte tek tıkla eklenir.</p>
                </div>
              )}
            </div>
          )}
          </>
            );
          })()
        ) : (
          /* Firma bulunamadı */
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
            <AlertTriangle size={28} className="mx-auto text-amber-500" />
            <p className="text-sm font-bold text-slate-700">Firma Bulunamadı</p>
            <p className="text-xs text-slate-400">Bu firma silinmiş olabilir.</p>
            <button onClick={closeDetail} className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
              Firmalara Dön
            </button>
          </div>
        )
      )}

      {!activeDetailId && (
      <>
      {/* ── Başlık ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <Building2 size={24} className="text-blue-600" /> Firmalar
          </h1>
          <p className="text-xs text-slate-500 mt-1">Çalıştığınız firmaları, iletişim bilgilerini ve sözleşme detaylarını yönetin</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95 shrink-0"
        >
          <Plus size={16} /> Yeni Firma
        </button>
      </div>

      {/* ── Arama & Filtre ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Firma adı, yetkili kişi veya sektör ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto scrollbar-none shadow-sm">
          <button
            onClick={() => setHazardFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${hazardFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >Tümü</button>
          {(Object.keys(HAZARD_CLASSES) as HazardClass[]).map(hc => (
            <button
              key={hc}
              onClick={() => setHazardFilter(hc)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${hazardFilter === hc ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${HAZARD_CLASSES[hc].dot}`} />
              {HAZARD_CLASSES[hc].label}
            </button>
          ))}
        </div>
        <ViewToggle view={listMode} onChange={setListMode} storageKey="companies" />
      </div>

      {/* ── Firma Kartları ── */}
      {filteredCompanies.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 py-16 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-5">
            <Building2 size={36} className="text-slate-300" />
          </div>
          <h3 className="text-lg font-black text-slate-700">{companies.length === 0 ? 'Henüz firma yok' : 'Sonuç bulunamadı'}</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-xs">
            {companies.length === 0
              ? 'İlk firmanızı ekleyerek tarama operasyonlarına başlayın.'
              : 'Arama veya filtre kriterlerini değiştirmeyi deneyin.'}
          </p>
          {companies.length === 0 && (
            <button onClick={openCreate} className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200">
              <Plus size={16} /> Firma Ekle
            </button>
          )}
        </div>
      ) : listMode === 'card' ? (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden relative">
          <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white"
              checked={selectedIds.size === filteredCompanies.length && filteredCompanies.length > 0}
              onChange={toggleSelectAll}
            />
            <span className="text-xs font-bold text-slate-500">
              {selectedIds.size > 0 ? `${selectedIds.size} firma seçildi` : 'Tümünü seç'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
            {paginatedCompanies.map(company => {
              const hazard = company.hazardClass ? HAZARD_CLASSES[company.hazardClass] : null;
              const recCount = recordCountOf(company.id);
              const isSelected = selectedIds.has(company.id);
              return (
                <div
                  key={company.id}
                  onClick={() => openDetail(company)}
                  className={`relative bg-white rounded-2xl border p-5 flex flex-col hover:shadow-lg hover:shadow-blue-100/50 transition-all group cursor-pointer ${isSelected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'}`}
                >
                  {/* Checkbox */}
                  <div className="absolute top-3 right-3 z-10">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white"
                      checked={isSelected}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(company.id); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  {/* Kart başlığı */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm ${hazard?.avatar ?? 'bg-slate-400'}`}>
                      {company.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <h3 className="text-sm font-black text-slate-800 truncate leading-tight">{company.name}</h3>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                        <Factory size={10} className="shrink-0" /> {company.sector || 'Sektör belirtilmemiş'}
                      </p>
                    </div>
                  </div>

                  {/* İletişim */}
                  <div className="space-y-1.5 mb-4 min-h-[3.5rem]">
                    {company.contactPerson && (
                      <p className="text-xs text-slate-600 flex items-center gap-2"><User size={12} className="text-slate-400 shrink-0"/> <span className="truncate">{company.contactPerson}</span></p>
                    )}
                    {company.phone && (
                      <p className="text-xs text-slate-600 flex items-center gap-2"><Phone size={12} className="text-slate-400 shrink-0"/> <span className="truncate">{company.phone}</span></p>
                    )}
                    {!company.contactPerson && !company.phone && (
                      <p className="text-xs text-slate-300 italic">İletişim bilgisi girilmemiş</p>
                    )}
                  </div>

                  {/* Alt istatistik + aksiyonlar */}
                  <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                      {company.employeeCount !== undefined && (
                        <span className="flex items-center gap-1"><UsersIcon size={11}/> {company.employeeCount} çalışan</span>
                      )}
                      <span className="flex items-center gap-1"><FlaskConical size={11}/> {company.tests.length} test</span>
                      <span className="flex items-center gap-1"><FileText size={11}/> {recCount} kayıt</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setConfirmClone(company); }} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Kopyala"><Copy size={14}/></button>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(company); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Düzenle"><Edit2 size={14}/></button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(company.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil"><Trash2 size={14}/></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemName="firma"
          />
          <BulkActionBar
            selectedCount={selectedIds.size}
            onBulkDelete={() => setBulkDeleteConfirm(true)}
            onClearSelection={() => setSelectedIds(new Set())}
            itemName="firma"
          />
        </div>
      ) : (
        /* Liste Görünümü */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden relative">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 w-10 text-center"><input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white" checked={selectedIds.size === filteredCompanies.length && filteredCompanies.length > 0} onChange={toggleSelectAll}/></th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide">Firma</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide">Sektör</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide">Tehlike Sınıfı</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide">Çalışan</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide">Test</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide">Kayıt</th>
                  <th className="px-4 py-3 text-xs uppercase tracking-wide text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedCompanies.map(company => {
                  const hazard = company.hazardClass ? HAZARD_CLASSES[company.hazardClass] : null;
                  const recCount = recordCountOf(company.id);
                  const isSelected = selectedIds.has(company.id);
                  return (
                    <tr key={company.id} className={`transition-all hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                      <td className="px-3 py-3 text-center"><input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white" checked={isSelected} onChange={() => toggleSelect(company.id)}/></td>
                      <td className="px-4 py-3 font-bold text-slate-800 cursor-pointer hover:text-blue-600" onClick={() => openDetail(company)}>{company.name}</td>
                      <td className="px-4 py-3 text-slate-600">{company.sector || '—'}</td>
                      <td className="px-4 py-3">{hazard ? <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap ${hazard.badge}`}>{hazard.label}</span> : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{company.employeeCount ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{company.tests.length}</td>
                      <td className="px-4 py-3 text-slate-500">{recCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openDetail(company)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Detay"><Eye size={14}/></button>
                          <button onClick={() => openEdit(company)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Düzenle"><Edit2 size={14}/></button>
                          <button onClick={() => setConfirmDelete(company.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            startIndex={startIndex}
            endIndex={endIndex}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemName="firma"
          />
          <BulkActionBar
            selectedCount={selectedIds.size}
            onBulkDelete={() => setBulkDeleteConfirm(true)}
            onClearSelection={() => setSelectedIds(new Set())}
            itemName="firma"
          />
        </div>
      )}

      </>
      )}

      {/* ═══ FİRMA FORM MODALI ═══ */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} overlayClassName="p-2 sm:p-4" closeOnBackdrop={false}>
          <div className={`${modalPanel} rounded-3xl w-full max-w-2xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden`}>

            {/* Modal header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 ${form.hazardClass ? HAZARD_CLASSES[form.hazardClass].avatar : 'bg-blue-600'}`}>
                  {(form.name || 'YF').substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900 truncate">{editingId ? form.name : 'Yeni Firma'}</h3>
                  <p className="text-[11px] text-slate-500">{editingId ? 'Firma bilgilerini düzenleyin' : 'Firma profili oluşturun'}</p>
                </div>
              </div>
              <button onClick={() => setFormOpen(false)} className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors shrink-0"><X size={18}/></button>
            </div>

            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0"/> {formError}
                </div>
              )}

              {/* Firma Bilgileri */}
              <section>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Building2 size={13} className="text-blue-500"/> Firma Bilgileri</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Firma Adı *</label>
                    <input type="text" value={form.name} onChange={(e) => updateField('name', e.target.value)} className={inputCls} placeholder="Örn: ABC Lojistik A.Ş." autoFocus={!editingId} />
                  </div>
                  <div>
                    <label className={labelCls}>Sektör</label>
                    <input type="text" value={form.sector ?? ''} onChange={(e) => updateField('sector', e.target.value)} className={inputCls} placeholder="Örn: Lojistik, Gıda, Metal" />
                  </div>
                  <div>
                    <label className={labelCls}>Çalışan Sayısı</label>
                    <input
                      type="number" min={0}
                      value={form.employeeCount ?? ''}
                      onChange={(e) => updateField('employeeCount', e.target.value === '' ? undefined : Math.max(0, parseInt(e.target.value) || 0))}
                      className={inputCls} placeholder="Örn: 45"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Tehlike Sınıfı</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(Object.keys(HAZARD_CLASSES) as HazardClass[]).map(hc => {
                        const active = form.hazardClass === hc;
                        return (
                          <button
                            key={hc}
                            type="button"
                            onClick={() => updateField('hazardClass', active ? undefined : hc)}
                            className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl border text-xs font-bold transition-all ${active ? HAZARD_CLASSES[hc].badge + ' ring-2 ring-offset-1 ring-slate-300' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${HAZARD_CLASSES[hc].dot}`} />
                            {HAZARD_CLASSES[hc].label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* İletişim */}
              <section>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Phone size={13} className="text-blue-500"/> İletişim</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Yetkili Kişi</label>
                    <input type="text" value={form.contactPerson ?? ''} onChange={(e) => updateField('contactPerson', e.target.value)} className={inputCls} placeholder="Örn: Ahmet Yılmaz" />
                  </div>
                  <div>
                    <label className={labelCls}>Telefon</label>
                    <input type="tel" value={form.phone ?? ''} onChange={(e) => updateField('phone', e.target.value)} className={inputCls} placeholder="0(5xx) xxx xx xx" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>E-posta</label>
                    <input type="email" value={form.email ?? ''} onChange={(e) => updateField('email', e.target.value)} className={inputCls} placeholder="ornek@firma.com" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Adres</label>
                    <textarea value={form.address ?? ''} onChange={(e) => updateField('address', e.target.value)} className={inputCls + ' resize-none'} rows={2} placeholder="Firma adresi" />
                  </div>
                </div>
              </section>

              {/* Notlar */}
              <section>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><StickyNote size={13} className="text-amber-500"/> Notlar</h4>
                <textarea value={form.notes ?? ''} onChange={(e) => updateField('notes', e.target.value)} className={inputCls + ' resize-none'} rows={3} placeholder="Sözleşme detayları, özel durumlar, hatırlatmalar..." />
              </section>

              {/* Test Şablonu — opsiyonel; teklif ve tarama oluştururken otomatik önerilir */}
              <section className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><FlaskConical size={13} className="text-indigo-500"/> Test Şablonu <span className="normal-case font-medium text-slate-300">(opsiyonel)</span></h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{formTestIds.size} test</span>
                    {formTestIds.size > 0 && (
                      <button type="button" onClick={() => updateField('tests', [])} className="text-[10px] font-bold text-slate-400 hover:text-slate-600">Temizle</button>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-3">Bu testler teklif ve tarama oluştururken şablon olarak otomatik önerilir.</p>
                {allTests.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Test havuzu boş — önce Test Havuzu sayfasından test ekleyin.</p>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {testsByCategory.map(([cat, catTests]) => {
                      const allIn = catTests.every(t => formTestIds.has(t.id));
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{cat}</span>
                            <button
                              type="button"
                              onClick={() => {
                                  const current = form.tests ?? [];
                                  updateField('tests', allIn
                                      ? current.filter(t => !catTests.some(ct => ct.id === t.id))
                                      : [...current.filter(t => !catTests.some(ct => ct.id === t.id)), ...catTests]);
                              }}
                              className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700"
                            >
                              {allIn ? 'Kaldır' : 'Tümünü Seç'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {catTests.map(t => {
                              const sel = formTestIds.has(t.id);
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => toggleFormTest(t)}
                                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left text-[11px] font-medium transition-all ${
                                    sel ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                  }`}
                                >
                                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${sel ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-transparent'}`}><Check size={10}/></span>
                                  <span className="truncate">{t.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            {/* Modal footer */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div>
                {editingId && (
                  <button onClick={() => { setConfirmDelete(editingId); }} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 size={14}/> Sil
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setFormOpen(false)} className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-200/60 rounded-xl transition-colors">İptal</button>
                <button onClick={saveForm} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95">
                  <Save size={14}/> {editingId ? 'Kaydet' : 'Firma Oluştur'}
                </button>
              </div>
            </div>
          </div>
      </Modal>

      {/* Şablon Oluştur Modalı */}
      {showTemplateModal && detailCompany && (
        <Modal open={showTemplateModal} onClose={() => setShowTemplateModal(false)} overlayClassName="p-4 sm:p-6">
          <div className={`${modalPanel} max-w-4xl w-full max-h-[90vh] rounded-2xl flex flex-col overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <ClipboardList size={18} className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">Test Şablonu Oluştur</h3>
                  <p className="text-[11px] text-slate-500">{detailCompany.name} için tekrar kullanılacak test şablonu</p>
                </div>
              </div>
              <button onClick={() => setShowTemplateModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Body — iki sütun: test havuzu / seçili testler */}
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
              {/* Sol: Test Havuzu */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <FlaskConical size={13} className="text-indigo-500"/> Test Havuzu
                  </h4>
                  <div className="relative w-40">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input
                      type="text"
                      placeholder="Test ara..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[55vh]">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400">{allTests.length} test</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTemplateTestIds(new Set(allTests.map(t => t.id)))}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                      >
                        Tümünü Seç
                      </button>
                      {templateTestIds.size > 0 && (
                        <>
                          <span className="text-slate-200">·</span>
                          <button
                            type="button"
                            onClick={() => setTemplateTestIds(new Set())}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                          >
                            Temizle
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {templateTestsByCategory.map(([cat, catTests]) => {
                      const allIn = catTests.every(t => templateTestIds.has(t.id));
                      return (
                        <div key={cat}>
                          <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 bg-slate-50/95 backdrop-blur border-b border-slate-100">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{cat}</span>
                            <button
                              type="button"
                              onClick={() => setTemplateTestIds(prev => {
                                const next = new Set(prev);
                                if (allIn) catTests.forEach(t => next.delete(t.id));
                                else catTests.forEach(t => next.add(t.id));
                                return next;
                              })}
                              className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700"
                            >
                              {allIn ? 'Kaldır' : 'Tümünü Ekle'}
                            </button>
                          </div>
                          <div className="p-1.5 space-y-1">
                            {catTests.map(t => {
                              const sel = templateTestIds.has(t.id);
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => toggleTemplateTest(t.id)}
                                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-[11px] font-medium transition-all ${
                                    sel ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/30'
                                  }`}
                                >
                                  <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${sel ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-transparent'}`}>
                                    {sel ? <Check size={10}/> : <Plus size={10}/>}
                                  </span>
                                  <span className="truncate flex-1">{t.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {templateTestsByCategory.length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-6">Eşleşen test yok.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sağ: Seçili Testler */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-indigo-500"/> Seçili Testler
                  </h4>
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{templateTestIds.size} test</span>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col max-h-[55vh]">
                  {templateTestIds.size === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-3">
                        <FlaskConical size={22} className="text-slate-300" />
                      </div>
                      <p className="text-xs font-bold text-slate-500">Henüz test seçilmedi</p>
                      <p className="text-[10px] text-slate-400 mt-1">Soldaki havuzdan test ekleyin</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                        {(() => {
                          const byCat = new Map<string, TestDefinition[]>();
                          allTests.filter(t => templateTestIds.has(t.id)).forEach(t => {
                            const cat = testCategory(t);
                            if (!byCat.has(cat)) byCat.set(cat, []);
                            byCat.get(cat)!.push(t);
                          });
                          return [...byCat.entries()].map(([cat, tests]) => (
                            <div key={cat} className="py-2">
                              <div className="px-3 py-1.5 flex items-center justify-between">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{cat}</span>
                                <span className="text-[9px] font-bold text-slate-400">{tests.length}</span>
                              </div>
                              <div className="px-2 space-y-1">
                                {tests.map(t => (
                                  <div key={t.id} className="flex items-center gap-2 px-2 py-2 rounded-lg bg-indigo-50/40 border border-indigo-100 group">
                                    <FlaskConical size={12} className="text-indigo-500 shrink-0" />
                                    <span className="text-[11px] font-medium text-slate-700 truncate flex-1">{t.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => toggleTemplateTest(t.id)}
                                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                                      title="Kaldır"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ));
                        })()}
                      </div>
                      <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500">Toplam {templateTestIds.size} test seçili</span>
                        <button
                          type="button"
                          onClick={() => setTemplateTestIds(new Set())}
                          className="text-[10px] font-bold text-red-500 hover:text-red-600"
                        >
                          Tümünü Temizle
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] text-slate-500">
                <ClipboardList size={11} className="inline mr-1 text-slate-400"/>
                Şablon, teklif ve tarama oluştururken otomatik önerilir
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowTemplateModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors">
                  İptal
                </button>
                <button
                  onClick={saveTemplate}
                  disabled={templateTestIds.size === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors"
                >
                  <Save size={13}/> Şablonu Kaydet
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Modals */}
      <ConfirmModal
        open={confirmDelete !== null}
        title="Firmayı Sil"
        message={`"${companies.find(c => c.id === confirmDelete)?.name || 'Bu firma'}" silinecek. Firmaya ait tarama kayıtları korunur ancak firma geri getirilemez. Emin misiniz?`}
        confirmLabel="Evet, Sil"
        onConfirm={doDeleteCompany}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmModal
        open={confirmClone !== null}
        title="Firmayı Kopyala"
        message={`"${confirmClone?.name || ''}" tüm ayarlarıyla kopyalanarak yeni firma oluşturulacak.`}
        confirmLabel="Kopyala"
        variant="info"
        onConfirm={doCloneCompany}
        onCancel={() => setConfirmClone(null)}
      />

      <ConfirmModal
        open={bulkDeleteConfirm}
        title="Toplu Sil"
        message={`${selectedIds.size} firma silinecek. Bu işlem geri alınamaz. Emin misiniz?`}
        confirmLabel="Evet, Sil"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
};
