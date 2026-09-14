import React, { useState, useMemo, useEffect } from 'react';
import { Company, Screening, ScreeningStatus, ScreeningTestItem, TestDefinition } from '../../types';
import { storageService } from '../../services/storageService';
import { testCategory, testPrice } from '../../constants';
import { ConfirmModal } from '../ConfirmModal';
import { Modal, modalPanel } from '../Modal';
import { usePagination } from '../../hooks/usePagination';
import { BulkActionBar } from '../shared/BulkActionBar';
import { PaginationControls } from '../shared/PaginationControls';
import { ViewToggle } from '../shared/ViewToggle';
import { getInitialView } from '../../utils/viewToggle';
import {
  Stethoscope, Plus, Search, MapPin, Users, FlaskConical, Check,
  Play, CheckCircle2, Edit2, Trash2, X,
  Building2, AlertTriangle, ArrowLeft, ArrowRight, CalendarDays,
  ClipboardList, FileCheck, ChevronDown, Factory, Clock,
  FileText, ScrollText, ChevronUp, RotateCcw, Calculator, Percent
} from 'lucide-react';

const STATUS_META: Record<ScreeningStatus, { label: string; badge: string; dot: string }> = {
  planlandi:    { label: 'Planlandı',    badge: 'bg-blue-50 text-blue-600 border-blue-100',        dot: 'bg-blue-500' },
  devam_ediyor: { label: 'Devam Ediyor', badge: 'bg-amber-50 text-amber-600 border-amber-200',     dot: 'bg-amber-500' },
  tamamlandi:   { label: 'Tamamlandı',   badge: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-500' },
  iptal:        { label: 'İptal',        badge: 'bg-red-50 text-red-600 border-red-200',            dot: 'bg-red-500' }
};

const SCREENING_TYPES: { key: 'ise_giris' | 'periyodik'; label: string; desc: string }[] = [
  { key: 'ise_giris', label: 'İşe Giriş Muayenesi', desc: 'Yeni işe alınacak personelin sağlık taraması' },
  { key: 'periyodik', label: 'Periyodik Muayene', desc: 'Mevcut çalışanların dönemsel sağlık kontrolü' }
];

const screeningTypeLabel = (t?: 'ise_giris' | 'periyodik') => SCREENING_TYPES.find(x => x.key === t)?.label;

/** Firma + türden otomatik tarama başlığı üretir */
const buildScreeningTitle = (companyName: string | undefined, type: 'ise_giris' | 'periyodik'): string => {
  const typeLabel = screeningTypeLabel(type) ?? 'Tarama';
  return companyName ? `${companyName} — ${typeLabel}` : '';
};

/** Tarama ön yazısı — firma + tür + tarih bilgisinden otomatik üretilir */
const buildScreeningCoverLetter = (form: { companyId: string; screeningType: 'ise_giris' | 'periyodik'; date: string; endDate: string; startTime: string; endTime: string; testItems: ScreeningTestItem[]; plannedCount: string }, company: Company | undefined): string => {
  if (!company) return '';
  const typeLabel = screeningTypeLabel(form.screeningType) ?? 'Tarama';
  const dateStr = new Date(form.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  const endDateStr = form.endDate ? ` - ${new Date(form.endDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}` : '';
  const timeStr = form.startTime && form.endTime ? ` (${form.startTime}-${form.endTime})` : '';
  const testCount = form.testItems.length;
  const personCount = form.plannedCount || '0';

  return `Sayın ${company.contactPerson || 'İlgili'},

${company.name} firması personeli için ${typeLabel.toLowerCase()} kapsamında mobil sağlık taraması planlanmıştır.

Tarama Tarihi: ${dateStr}${endDateStr}${timeStr}
Tarama Yeri: ${company.address || company.name} işletmesi sahası
Planlanan Personel Sayısı: ${personCount} kişi
Uygulanacak Test Sayısı: ${testCount} tetkik

Mobil sağlık taraması ekibimiz belirlenen tarihte ve saatte işletmenizde hazır bulunacaktır. Personelinizin taramaya zamanında katılımını rica ederiz.

Saygılarımızla,
Sağlık Taraması Ekibi`;
};

/** Tarama şartları kütüphanesi — kategorilere göre gruplu */
const SCREENING_TERM_LIBRARY: { category: string; items: { text: string; rec?: boolean }[] }[] = [
  {
    category: 'Hazırlık',
    items: [
      { text: 'Tarama öncesinde personelin aç/getoklı gelmesi gereken testler için bilgilendirme firma tarafından yapılacaktır.', rec: true },
      { text: 'Tarama alanında yeterli aydınlatma, ısıtma ve elektrik prizleri firma tarafından sağlanacaktır.', rec: true },
      { text: 'Personel listesi (ad-soyad, T.C. kimlik, sicil) tarama tarihinden en az 2 iş günü önce paylaşılacaktır.', rec: true },
      { text: 'Firma, tarama saatlerinde personelin işten ayrılmasına izin verecektir.', rec: true }
    ]
  },
  {
    category: 'Operasyon',
    items: [
      { text: 'Tarama ekibi belirlenen saatte işletmede hazır bulunacaktır.', rec: true },
      { text: 'Personel taramaya sıra ile alınacak, bekleme alanı firma tarafından ayrılacaktır.', rec: true },
      { text: 'Acil durum veya sağlık sorunu durumunda tarama işlemi durdurulup ilgili personel için yönlendirme yapılacaktır.', rec: true },
      { text: 'Tarama süresince firmanın iş akışı aksatılmamaya çalışılacaktır.' }
    ]
  },
  {
    category: 'Gizlilik & Veri',
    items: [
      { text: 'Tarama sonuçları kişisel sağlık verisi kapsamındadır, ilgili personel ve yetkili kişiler dışında paylaşılmaz.', rec: true },
      { text: 'Sonuç raporları firma yetkilisine dijital ortamda iletilecektir.', rec: true },
      { text: 'Kişisel sağlık verileri KVKK ve ilgili mevzuata uygun olarak işlenecektir.', rec: true }
    ]
  },
  {
    category: 'İptal & Değişiklik',
    items: [
      { text: 'Tarama tarihi en az 24 saat önceden bildirilmek şartıyla değiştirilebilir.', rec: true },
      { text: 'Firma kaynaklı iptallerde tarama ücretinin %50\'si tahsil edilir.', rec: true },
      { text: 'Mücbir sebepler (doğal afet, salgın vb.) durumunda iptal ücreti alınmaz.' }
    ]
  }
];

const WIZARD_STEPS = [
  { key: 1, label: 'Operasyon', desc: 'Firma, tarih & saat', icon: Building2 },
  { key: 2, label: 'Testler', desc: 'Tetkik seçimi', icon: FlaskConical },
  { key: 3, label: 'Maliyet', desc: 'Fiyat & bütçe', icon: Calculator },
  { key: 4, label: 'Ön Yazı', desc: 'Tarama giriş metni', icon: FileText },
  { key: 5, label: 'Şartlar', desc: 'Koşul maddeleri', icon: ScrollText },
  { key: 6, label: 'Önizleme', desc: 'Kontrol & kaydet', icon: FileCheck }
];

/** Maliyet hesaplama yardımcıları */
const num = (v: string) => parseFloat(v) || 0;
const testItemsSubtotal = (items: ScreeningTestItem[]) => items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
const calcDiscount = (subtotal: number, discount: string) => Math.max(0, Math.min(subtotal, num(discount)));
const calcVat = (afterDiscount: number, vatRate: string) => afterDiscount * (num(vatRate) / 100);
const calcTotal = (items: ScreeningTestItem[], extra: string, discount: string, vatRate: string) => {
  const sub = testItemsSubtotal(items) + num(extra);
  const disc = calcDiscount(sub, discount);
  const vat = calcVat(sub - disc, vatRate);
  return { sub, disc, vat, total: sub - disc + vat };
};
const fmtTL = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' TL';

interface ScreeningForm {
  companyId: string;
  title: string;
  screeningType: 'ise_giris' | 'periyodik';
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  status: ScreeningStatus;
  plannedCount: string;
  completedCount: string;
  testItems: ScreeningTestItem[]; // test kalemleri (fiyat + miktar)
  titleTouched: boolean;
  coverLetter: string;
  coverLetterEdited: boolean;
  terms: string[];
  // Maliyet & fiyatlandırma
  perPersonPrice: string;
  extraCosts: string;
  discount: string;
  vatRate: string;
  costNotes: string;
}

const emptyForm = (): ScreeningForm => ({
  companyId: '',
  title: '',
  screeningType: 'ise_giris',
  date: new Date().toISOString().slice(0, 10),
  endDate: '',
  startTime: '08:30',
  endTime: '17:30',
  status: 'planlandi',
  plannedCount: '',
  completedCount: '0',
  testItems: [],
  titleTouched: false,
  coverLetter: '',
  coverLetterEdited: false,
  terms: [],
  perPersonPrice: '',
  extraCosts: '',
  discount: '',
  vatRate: '20',
  costNotes: ''
});

/** Sihirbaz adım başlığı — Quotes ile aynı kompakt görünüm */
const StepHeader: React.FC<{ icon: React.ElementType; title: string; desc: React.ReactNode }> = ({ icon: Icon, title, desc }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm">
      <Icon size={17} />
    </div>
    <div className="min-w-0">
      <h2 className="text-base font-black text-slate-800 leading-tight">{title}</h2>
      <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
    </div>
  </div>
);

/** Türkçe 24 saat time picker — AM/PM yok, select-based */
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

const TimePicker: React.FC<{ value: string; onChange: (v: string) => void; className?: string }> = ({ value, onChange, className = '' }) => {
  const [h, m] = (value || '08:30').split(':');
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select
        value={h}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
        className="text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all cursor-pointer"
      >
        {HOURS.map(hh => <option key={hh} value={hh}>{hh}</option>)}
      </select>
      <span className="text-slate-400 font-bold text-sm">:</span>
      <select
        value={m}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
        className="text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all cursor-pointer"
      >
        {MINUTES.map(mm => <option key={mm} value={mm}>{mm}</option>)}
      </select>
    </div>
  );
};

/** Tutarlı panel — beyaz kart + başlık şeridi */
const Panel: React.FC<{ icon?: React.ElementType; title: string; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string }> = ({ icon: Icon, title, right, children, className = '', bodyClassName = 'p-4' }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl overflow-hidden ${className}`}>
    <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3 rounded-t-2xl">
      <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
        {Icon && <Icon size={14} className="text-blue-600" />}
        {title}
      </h3>
      {right}
    </div>
    <div className={bodyClassName}>{children}</div>
  </div>
);

interface ScreeningsProps {
  companies: Company[];
  allTests: TestDefinition[];
  initialOpenCreate?: boolean;
  initialCompanyId?: string; // firma detayından "Yeni Tarama" ile gelindiğinde seçili firma
  onNavigate?: (route: string) => void;
  onBack?: (fallback: string) => void;
}

export const Screenings: React.FC<ScreeningsProps> = ({ companies, allTests, initialOpenCreate, initialCompanyId, onNavigate, onBack }) => {
  const [screenings, setScreenings] = useState<Screening[]>(() => storageService.getScreenings());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScreeningStatus>('all');

  // Liste ↔ Sihirbaz görünümü
  const [view, setView] = useState<'list' | 'wizard'>('list');
  const [wizardStep, setWizardStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScreeningForm>(emptyForm());
  const [formError, setFormError] = useState('');
  const [testSearch, setTestSearch] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [listMode, setListMode] = useState<'card' | 'list'>(() => getInitialView('screenings', 'list'));
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [termSearch, setTermSearch] = useState('');

  const persist = (items: Screening[]) => {
    setScreenings(items);
    storageService.saveScreenings(items);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return screenings
      .filter(s => statusFilter === 'all' || s.status === statusFilter)
      .filter(s => {
        if (!q) return true;
        const company = companies.find(c => c.id === s.companyId);
        return s.title.toLowerCase().includes(q) || company?.name.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [screenings, companies, searchTerm, statusFilter]);

  const {
    paginatedItems: paginatedScreenings,
    currentPage, totalPages, pageSize, setCurrentPage, setPageSize,
    totalItems, startIndex, endIndex
  } = usePagination(filtered, 'screenings', 7);

  const formCompany = companies.find(c => c.id === form.companyId);

  const testsByCategory = useMemo(() => {
    const q = testSearch.trim().toLowerCase();
    const map = new Map<string, TestDefinition[]>();
    allTests
      .filter(t => !q || t.name.toLowerCase().includes(q))
      .forEach(t => {
        const cat = testCategory(t);
        if (!map.has(cat)) map.set(cat, []);
        map.get(cat)!.push(t);
      });
    return [...map.entries()];
  }, [allTests, testSearch]);

  /** Firma arama — ad, yetkili, sektör alanlarında filtreler */
  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.contactPerson?.toLowerCase().includes(q) ||
      c.sector?.toLowerCase().includes(q)
    );
  }, [companies, companySearch]);

  // ── Sihirbaz taslağını localStorage'a sürekli yaz — sayfa yenilense bile form korunur
  useEffect(() => {
    if (view === 'wizard') {
      storageService.saveScreeningDraft({ form, wizardStep, editingId });
    }
  }, [view, form, wizardStep, editingId]);

  const openCreate = (presetCompanyId?: string) => {
    const draft = storageService.getScreeningDraft<{ form: ScreeningForm; wizardStep: number; editingId: string | null }>();
    if (draft?.form && !presetCompanyId) {
      const f = draft.form as unknown as Partial<ScreeningForm>;
      setForm({
        companyId: f.companyId ?? '',
        title: f.title ?? '',
        screeningType: f.screeningType ?? 'ise_giris',
        date: f.date ?? new Date().toISOString().slice(0, 10),
        endDate: f.endDate ?? '',
        startTime: f.startTime ?? '08:30',
        endTime: f.endTime ?? '17:30',
        status: f.status ?? 'planlandi',
        plannedCount: f.plannedCount ?? '',
        completedCount: f.completedCount ?? '0',
        testItems: f.testItems ?? [],
        titleTouched: f.titleTouched ?? false,
        coverLetter: f.coverLetter ?? '',
        coverLetterEdited: f.coverLetterEdited ?? false,
        terms: f.terms ?? [],
        perPersonPrice: f.perPersonPrice ?? '',
        extraCosts: f.extraCosts ?? '',
        discount: f.discount ?? '',
        vatRate: f.vatRate ?? '20',
        costNotes: f.costNotes ?? ''
      });
      setEditingId(draft.editingId ?? null);
      setWizardStep(draft.wizardStep || 1);
      setDraftRestored(true);
    } else {
      // presetCompanyId varsa (firma detayından gelindi) veya taslak yoksa boş form aç
      const baseForm = emptyForm();
      if (presetCompanyId) {
        const company = companies.find(c => c.id === presetCompanyId);
        baseForm.companyId = presetCompanyId;
        baseForm.plannedCount = company?.employeeCount?.toString() || '';
      }
      setEditingId(null);
      setForm(baseForm);
      setWizardStep(1);
      setDraftRestored(false);
    }
    setFormError('');
    setTestSearch('');
    setView('wizard');
    onNavigate?.('screenings/new');
  };

  /** Takvim'den "Tarama Planla" veya firma detayından "Yeni Tarama" ile gelindiğinde sihirbazı otomatik aç */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialOpenCreate) openCreate(initialCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** Sihirbazdan çık — taslak da temizlenir */
  const closeWizard = () => {
    storageService.clearScreeningDraft();
    setDraftRestored(false);
    setView('list');
    onNavigate?.('screenings');
  };

  /** Taslağı sıfırla — geri yüklenen taslağı atıp temiz form aç */
  const resetDraft = () => {
    storageService.clearScreeningDraft();
    setEditingId(null);
    setForm(emptyForm());
    setWizardStep(1);
    setFormError('');
    setDraftRestored(false);
  };

  const openEdit = (s: Screening) => {
    setEditingId(s.id);
    setForm({
      companyId: s.companyId,
      title: s.title,
      screeningType: s.screeningType ?? 'ise_giris',
      date: s.date,
      endDate: s.endDate ?? '',
      startTime: s.startTime ?? '08:30',
      endTime: s.endTime ?? '17:30',
      status: s.status,
      plannedCount: String(s.plannedCount ?? ''),
      completedCount: String(s.completedCount ?? 0),
      testItems: s.testItems ?? s.testIds.map(id => { const t = allTests.find(x => x.id === id); return { testId: id, name: t?.name ?? '', quantity: s.plannedCount || 1, unitPrice: t ? testPrice(t) : 0 }; }),
      titleTouched: true,
      coverLetter: s.coverLetter ?? '',
      coverLetterEdited: !!s.coverLetter,
      terms: [...(s.terms ?? [])],
      perPersonPrice: s.perPersonPrice ? String(s.perPersonPrice) : '',
      extraCosts: s.extraCosts ? String(s.extraCosts) : '',
      discount: s.discount ? String(s.discount) : '',
      vatRate: s.vatRate != null ? String(s.vatRate) : '20',
      costNotes: s.costNotes ?? ''
    });
    setFormError('');
    setTestSearch('');
    setWizardStep(1);
    setView('wizard');
    onNavigate?.('screenings/new');
  };

  // Firma değişince test şablonunu + çalışan sayısını otomatik uygula
  const handleCompanyChange = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    setForm(prev => ({
      ...prev,
      companyId,
      title: prev.titleTouched ? prev.title : buildScreeningTitle(company?.name, prev.screeningType),
      plannedCount: prev.plannedCount || (company?.employeeCount ? String(company.employeeCount) : ''),
      testItems: company && company.tests.length > 0 ? company.tests.map(t => ({ testId: t.id, name: t.name, quantity: company.employeeCount ?? 1, unitPrice: testPrice(t) })) : prev.testItems
    }));
  };

  // Tür değişince başlığı otomatik yeniden üret (elle değiştirilmediyse)
  const handleTypeChange = (type: 'ise_giris' | 'periyodik') => {
    setForm(prev => ({
      ...prev,
      screeningType: type,
      title: prev.titleTouched ? prev.title : buildScreeningTitle(companies.find(c => c.id === prev.companyId)?.name, type)
    }));
  };

  const applyCompanyTemplate = () => {
    if (!formCompany) return;
    setForm(prev => ({ ...prev, testItems: formCompany.tests.map(t => ({ testId: t.id, name: t.name, quantity: parseInt(prev.plannedCount) || 1, unitPrice: testPrice(t) })) }));
  };

  // ── Ön yazı işlemleri ──
  const regenerateCoverLetter = () => {
    setForm(prev => ({ ...prev, coverLetter: buildScreeningCoverLetter(prev, formCompany), coverLetterEdited: false }));
  };

  // ── Şartlar işlemleri ──
  const addTerm = (text: string) => setForm(prev => ({ ...prev, terms: [...prev.terms, text] }));
  const addTerms = (texts: string[]) => setForm(prev => ({ ...prev, terms: [...prev.terms, ...texts] }));
  const updateTerm = (idx: number, text: string) => setForm(prev => ({ ...prev, terms: prev.terms.map((t, i) => i === idx ? text : t) }));
  const removeTerm = (idx: number) => setForm(prev => ({ ...prev, terms: prev.terms.filter((_, i) => i !== idx) }));
  const moveTerm = (idx: number, dir: 'up' | 'down') => setForm(prev => {
    const next = [...prev.terms];
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= next.length) return prev;
    [next[idx], next[target]] = [next[target], next[idx]];
    return { ...prev, terms: next };
  });
  const addRecommendedTerms = () => {
    const recommended = SCREENING_TERM_LIBRARY.flatMap(g => g.items).filter(i => i.rec).map(i => i.text);
    const pending = recommended.filter(t => !form.terms.includes(t));
    if (pending.length > 0) addTerms(pending);
  };

  const toggleTest = (id: string) => {
    setForm(prev => {
      if (prev.testItems.some(i => i.testId === id)) {
        return { ...prev, testItems: prev.testItems.filter(i => i.testId !== id) };
      }
      const t = allTests.find(x => x.id === id);
      return { ...prev, testItems: [...prev.testItems, { testId: id, name: t?.name ?? '', quantity: parseInt(prev.plannedCount) || 1, unitPrice: t ? testPrice(t) : 0 }] };
    });
  };

  const updateTestItem = (testId: string, patch: Partial<ScreeningTestItem>) => {
    setForm(prev => ({ ...prev, testItems: prev.testItems.map(i => i.testId === testId ? { ...i, ...patch } : i) }));
  };

  const canProceed = (): boolean => {
    if (wizardStep === 1) return !!form.companyId && !!form.title.trim() && !!form.date;
    if (wizardStep === 2) return form.testItems.length > 0;
    return true; // adım 3, 4, 5, 6 opsiyonel
  };

  const stepDone = (key: number): boolean => {
    if (key === 1) return !!form.companyId && !!form.title.trim() && !!form.date;
    if (key === 2) return form.testItems.length > 0;
    if (key === 3) return testItemsSubtotal(form.testItems) > 0;
    if (key === 4) return form.coverLetter.trim().length > 0;
    if (key === 5) return form.terms.length > 0;
    return false;
  };

  const goToStep = (step: number) => {
    setFormError('');
    setWizardStep(step);
  };

  const goNext = () => {
    if (!canProceed()) {
      if (wizardStep === 1) setFormError('Devam etmek için firma, başlık ve tarih zorunludur.');
      else if (wizardStep === 2) setFormError('En az bir test seçmelisiniz.');
      return;
    }
    setFormError('');
    goToStep(Math.min(6, wizardStep + 1));
  };

  const goBack = () => goToStep(Math.max(1, wizardStep - 1));

  const saveForm = () => {
    if (!form.companyId) { setFormError('Firma seçimi zorunludur.'); return; }
    if (!form.title.trim()) { setFormError('Tarama başlığı zorunludur.'); return; }
    if (!form.date) { setFormError('Tarih zorunludur.'); return; }
    if (form.testItems.length === 0) { setFormError('En az bir test seçmelisiniz.'); return; }

    const base = {
      companyId: form.companyId,
      title: form.title.trim(),
      screeningType: form.screeningType,
      date: form.date,
      endDate: form.endDate || undefined,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      status: form.status,
      testIds: form.testItems.map(i => i.testId),
      testItems: form.testItems,
      plannedCount: Math.max(0, parseInt(form.plannedCount) || 0),
      completedCount: Math.max(0, parseInt(form.completedCount) || 0),
      coverLetter: form.coverLetter.trim() || undefined,
      terms: form.terms.length > 0 ? form.terms : undefined,
      perPersonPrice: parseFloat(form.perPersonPrice) || undefined,
      extraCosts: parseFloat(form.extraCosts) || undefined,
      discount: parseFloat(form.discount) || undefined,
      vatRate: parseFloat(form.vatRate) || undefined,
      costNotes: form.costNotes.trim() || undefined
    };

    if (editingId) {
      const prev = screenings.find(s => s.id === editingId);
      persist(screenings.map(s => s.id === editingId
        ? { ...s, ...base, teamMemberIds: prev?.teamMemberIds ?? [], equipmentIds: prev?.equipmentIds ?? [], quoteId: prev?.quoteId }
        : s));
    } else {
      persist([...screenings, {
        ...base,
        id: `scr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        teamMemberIds: [],
        equipmentIds: []
      }]);
    }
    storageService.clearScreeningDraft();
    setDraftRestored(false);
    setView('list');
    onNavigate?.('screenings');
  };

  const advanceStatus = (s: Screening) => {
    const next: ScreeningStatus = s.status === 'planlandi' ? 'devam_ediyor' : s.status === 'devam_ediyor' ? 'tamamlandi' : s.status;
    persist(screenings.map(x => x.id === s.id ? { ...x, status: next } : x));
  };

  const doDelete = () => {
    if (!confirmDelete) return;
    persist(screenings.filter(s => s.id !== confirmDelete));
    setConfirmDelete(null);
  };

  const doBulkDelete = () => {
    persist(screenings.filter(s => !selectedIds.has(s.id)));
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
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(s => s.id)));
  };

  const inputCls = "w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all placeholder-slate-400";
  const labelCls = "block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide";

  const selectedTests = allTests.filter(t => form.testItems.some(i => i.testId === t.id));

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">

      {/* ═══════════════════════════════════════════════
          LİSTE GÖRÜNÜMÜ
          ═══════════════════════════════════════════════ */}
      {view === 'list' && (
        <>
          {/* ── Başlık ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                <Stethoscope size={24} className="text-blue-600" /> Taramalar
              </h1>
              <p className="text-xs text-slate-500 mt-1">Mobil sağlık taraması operasyonlarını planlayın ve takip edin</p>
            </div>
            <button
              onClick={() => openCreate()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95 shrink-0"
            >
              <Plus size={16} /> Yeni Tarama
            </button>
          </div>

          {/* ── Arama & Filtre ── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Tarama, firma veya konum ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all shadow-sm"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto scrollbar-none shadow-sm">
              <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Tümü</button>
              {(Object.keys(STATUS_META) as ScreeningStatus[]).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${statusFilter === st ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[st].dot}`} />
                  {STATUS_META[st].label}
                </button>
              ))}
            </div>
            <ViewToggle view={listMode} onChange={setListMode} storageKey="screenings" />
          </div>

          {/* ── Tarama Kartları ── */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 py-16 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-5">
                <Stethoscope size={36} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-700">{screenings.length === 0 ? 'Henüz tarama yok' : 'Sonuç bulunamadı'}</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                {screenings.length === 0
                  ? 'İlk taramanızı planlayın — firma seçince test şablonu otomatik uygulanır.'
                  : 'Arama veya filtre kriterlerini değiştirmeyi deneyin.'}
              </p>
              {screenings.length === 0 && (
                <button onClick={() => openCreate()} className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200">
                  <Plus size={16} /> Tarama Planla
                </button>
              )}
            </div>
          ) : listMode === 'card' ? (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden relative">
              <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white"
                  checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                />
                <span className="text-xs font-bold text-slate-500">
                  {selectedIds.size > 0 ? `${selectedIds.size} tarama seçildi` : 'Tümünü seç'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                {paginatedScreenings.map(s => {
                  const company = companies.find(c => c.id === s.companyId);
                  const pct = s.plannedCount > 0 ? Math.min(100, Math.round((s.completedCount / s.plannedCount) * 100)) : 0;
                  const testNames = s.testIds.map(id => allTests.find(t => t.id === id)?.name).filter(Boolean) as string[];
                  const isSelected = selectedIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`relative bg-white rounded-2xl border p-5 flex flex-col hover:shadow-lg hover:shadow-blue-100/50 transition-all group ${isSelected ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'}`}
                    >
                      <div className="absolute top-3 right-3 z-10">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white"
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(s.id); }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex items-start gap-3 mb-3 cursor-pointer" onClick={() => openEdit(s)}>
                        <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex flex-col items-center justify-center shrink-0">
                          <span className="text-sm font-black leading-none">{new Date(s.date).getDate()}</span>
                          <span className="text-[8px] font-bold uppercase">{new Date(s.date).toLocaleDateString('tr-TR', { month: 'short' })}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-black text-slate-800 truncate leading-tight pr-6">{s.title}</h3>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                            <Building2 size={10} className="shrink-0" /> {company?.name || 'Firma silinmiş'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5 mb-3 text-xs text-slate-600">
                        <p className="flex items-center gap-2"><MapPin size={12} className="text-slate-400 shrink-0"/> <span className="truncate">{s.location || 'Konum belirtilmemiş'}</span></p>
                        <p className="flex items-center gap-2"><Users size={12} className="text-slate-400 shrink-0"/> {s.completedCount}/{s.plannedCount} kişi tamamlandı</p>
                      </div>

                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mb-1">
                          <span>İlerleme</span><span className="tabular-nums">%{pct}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-3">
                        <FlaskConical size={11} className="text-slate-300 mt-0.5 shrink-0"/>
                        {testNames.slice(0, 4).map((n, i) => (
                          <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{n}</span>
                        ))}
                        {testNames.length > 4 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{testNames.length - 4}</span>}
                        {testNames.length === 0 && <span className="text-[9px] text-slate-300 italic">Test yok</span>}
                      </div>

                      <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div>
                          {(s.status === 'planlandi' || s.status === 'devam_ediyor') && (
                            <button
                              onClick={(e) => { e.stopPropagation(); advanceStatus(s); }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${
                                s.status === 'planlandi' ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {s.status === 'planlandi' ? <><Play size={11}/> Başlat</> : <><CheckCircle2 size={11}/> Tamamla</>}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Düzenle"><Edit2 size={14}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil"><Trash2 size={14}/></button>
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
                itemName="tarama"
              />
              <BulkActionBar
                selectedCount={selectedIds.size}
                onBulkDelete={() => setBulkDeleteConfirm(true)}
                onClearSelection={() => setSelectedIds(new Set())}
                itemName="tarama"
              />
            </div>
          ) : (
            /* Liste Görünümü */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden relative">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-3 w-10 text-center"><input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll}/></th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide">Tarama</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide">Firma</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide">Tarih</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide">Durum</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide">İlerleme</th>
                      <th className="px-4 py-3 text-xs uppercase tracking-wide text-center">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedScreenings.map(s => {
                      const company = companies.find(c => c.id === s.companyId);
                      const meta = STATUS_META[s.status];
                      const pct = s.plannedCount > 0 ? Math.min(100, Math.round((s.completedCount / s.plannedCount) * 100)) : 0;
                      const isSelected = selectedIds.has(s.id);
                      return (
                        <tr key={s.id} className={`transition-all hover:bg-slate-50 ${isSelected ? 'bg-blue-50/50' : ''}`}>
                          <td className="px-3 py-3 text-center"><input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white" checked={isSelected} onChange={() => toggleSelect(s.id)}/></td>
                          <td className="px-4 py-3 font-bold text-slate-800 cursor-pointer hover:text-blue-600" onClick={() => openEdit(s)}>{s.title}</td>
                          <td className="px-4 py-3 text-slate-600">{company?.name || 'Firma silinmiş'}</td>
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{s.date}</td>
                          <td className="px-4 py-3"><span className={`text-[9px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap ${meta.badge}`}>{meta.label}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-bold text-slate-400 tabular-nums">%{pct}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Düzenle"><Edit2 size={14}/></button>
                              <button onClick={() => setConfirmDelete(s.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil"><Trash2 size={14}/></button>
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
                itemName="tarama"
              />
              <BulkActionBar
                selectedCount={selectedIds.size}
                onBulkDelete={() => setBulkDeleteConfirm(true)}
                onClearSelection={() => setSelectedIds(new Set())}
                itemName="tarama"
              />
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════
          SİHİRAZ GÖRÜNÜMÜ (Yeni Tarama Oluştur)
          ═══════════════════════════════════════════════ */}
      {view === 'wizard' && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── SOL SIDEBAR: ADIMLAR ── */}
          <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24 space-y-4">
            <button
              onClick={() => { if (onBack) onBack('screenings'); else closeWizard(); }}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft size={14} /> Taramalara Dön
            </button>

            {draftRestored && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800">
                <span className="flex items-center gap-1.5"><AlertTriangle size={12} /> Taslak geri yüklendi</span>
                <button onClick={resetDraft} className="underline underline-offset-2 hover:text-amber-950 transition-colors">Sıfırla</button>
              </div>
            )}

            {/* Adım listesi — mobilde yatay, masaüstünde dikey */}
            <div className="bg-white rounded-2xl border border-slate-200 p-2 lg:p-3 flex lg:flex-col gap-1.5 overflow-x-auto scrollbar-none">
              {WIZARD_STEPS.map(step => {
                const isActive = wizardStep === step.key;
                const done = stepDone(step.key);
                return (
                  <button
                    key={step.key}
                    onClick={() => goToStep(step.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all min-w-[140px] lg:min-w-0 lg:w-full ${
                      isActive
                        ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-200 shadow-sm'
                        : done
                          ? 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                          : 'border-transparent bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive ? 'bg-blue-600 text-white' : done ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {done && !isActive ? <Check size={15}/> : <step.icon size={15}/>}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${isActive ? 'text-blue-800' : done ? 'text-slate-700' : 'text-slate-500'}`}>
                        {step.key}. {step.label}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate hidden sm:block">{step.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Canlı özet kartı */}
            <div className="hidden lg:block bg-slate-800 text-white rounded-2xl p-4 space-y-2.5">
              <p className="text-[11px] font-bold text-blue-400 flex items-center gap-1.5"><Stethoscope size={12}/> {editingId ? 'Düzenleme' : 'Yeni Tarama'}</p>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between text-slate-300"><span>Firma</span><span className="font-bold text-white truncate max-w-[140px]">{formCompany?.name || '—'}</span></div>
                <div className="flex justify-between text-slate-300"><span>Tür</span><span className="font-bold text-white truncate max-w-[140px]">{screeningTypeLabel(form.screeningType) || '—'}</span></div>
                <div className="flex justify-between text-slate-300"><span>Tarih</span><span className="font-bold text-white">{form.date || '—'}</span></div>
                <div className="flex justify-between text-slate-300"><span>Saat</span><span className="font-bold text-white">{form.startTime} - {form.endTime}</span></div>
                <div className="flex justify-between text-slate-300"><span>Test</span><span className="font-bold text-white">{form.testItems.length}</span></div>
                <div className="flex justify-between text-slate-300"><span>Kişi</span><span className="font-bold text-white">{form.plannedCount || '—'}</span></div>
                {testItemsSubtotal(form.testItems) > 0 && (() => {
                  const { total } = calcTotal(form.testItems, form.extraCosts, form.discount, form.vatRate);
                  return <div className="flex justify-between text-blue-400 pt-1.5 border-t border-slate-700"><span>Toplam</span><span className="font-bold text-white tabular-nums">{fmtTL(total)}</span></div>;
                })()}
              </div>
            </div>
          </aside>

          {/* ── İÇERİK ── */}
          <div className="flex-1 min-w-0 space-y-5">
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-1">
                <AlertTriangle size={15} className="shrink-0"/> {formError}
              </div>
            )}

            {/* ══ ADIM 1: OPERASYON BİLGİLERİ ══ */}
            {wizardStep === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <StepHeader icon={Building2} title="Operasyon Bilgileri" desc="Firma, tarih ve saat bilgilerini girin" />

                <div className="max-w-3xl mx-auto space-y-5">
                  {/* Aramalı firma seçici — çok firma için ölçeklenir */}
                  <Panel icon={Building2} title="Firma">
                    <div>
                      <button
                        onClick={() => setCompanyMenuOpen(true)}
                        className={`w-full flex items-center gap-3 border-2 rounded-2xl px-4 py-3.5 text-left transition-all shadow-sm ${
                          formCompany ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-blue-400'
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${formCompany ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                          {formCompany ? formCompany.name.substring(0, 2).toUpperCase() : <Building2 size={18}/>}
                        </div>
                        <div className="min-w-0 flex-1">
                          {formCompany ? (
                            <>
                              <p className="text-sm font-bold text-slate-800 truncate">{formCompany.name}</p>
                              <p className="text-[10px] text-slate-400 flex items-center gap-1"><Factory size={9}/> {formCompany.sector || 'Sektör yok'}{formCompany.employeeCount !== undefined && ` · ${formCompany.employeeCount} çalışan`}</p>
                            </>
                          ) : (
                            <p className="text-sm font-medium text-slate-400">Firma ara ve seç...</p>
                          )}
                        </div>
                        <ChevronDown size={16} className="text-slate-400"/>
                      </button>
                    </div>

                    {/* Seçili firma profil kartı */}
                    {formCompany && (
                      <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-sm font-black shrink-0">
                          {formCompany.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Sektör</p>
                            <p className="text-xs font-bold text-slate-700 truncate">{formCompany.sector || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Çalışan</p>
                            <p className="text-xs font-bold text-slate-700">{formCompany.employeeCount ?? '—'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Yetkili</p>
                            <p className="text-xs font-bold text-slate-700 truncate">{formCompany.contactPerson || '—'}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Şablon</p>
                            <p className="text-xs font-bold text-slate-700">{formCompany.tests.length} test</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {formCompany && formCompany.tests.length > 0 && (
                      <p className="text-[10px] text-indigo-500 font-semibold mt-2 flex items-center gap-1"><Check size={11}/> Firma şablonundaki {formCompany.tests.length} test 2. adımda otomatik uygulanacak</p>
                    )}
                  </Panel>

                  {/* Tarama bilgileri — tür, başlık, tarih, saat */}
                  <Panel icon={CalendarDays} title="Tarama Bilgileri" bodyClassName="p-5 space-y-5">
                    {/* Tür kartları */}
                    <div>
                      <label className={labelCls}>Tarama Türü</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                        {SCREENING_TYPES.map(t => {
                          const isSelected = form.screeningType === t.key;
                          return (
                            <button
                              key={t.key}
                              type="button"
                              onClick={() => handleTypeChange(t.key)}
                              className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                                isSelected ? 'border-blue-500 bg-blue-50/50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-blue-600' : 'border-slate-300'}`}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                                </div>
                                <span className={`text-sm font-bold ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{t.label}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1 ml-6">{t.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Tarama Başlığı *</label>
                      <input type="text" value={form.title} onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value, titleTouched: true }))} className={inputCls} placeholder="Örn: ABC Lojistik Periyodik Taraması" />
                      {!form.titleTouched && formCompany && (
                        <p className="text-[10px] text-slate-400 mt-1.5">Otomatik: {formCompany.name} — {screeningTypeLabel(form.screeningType)}</p>
                      )}
                    </div>

                    {/* Tarih aralığı */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Başlangıç Tarihi *</label>
                        <input type="date" value={form.date} onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Bitiş Tarihi</label>
                        <input type="date" value={form.endDate} min={form.date} onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))} className={inputCls} />
                      </div>
                    </div>

                    {/* Saat aralığı */}
                    <div>
                      <label className={labelCls}><Clock size={10} className="inline mr-1"/>Saat Aralığı</label>
                      <div className="flex items-center gap-3">
                        <TimePicker value={form.startTime} onChange={(v) => setForm(prev => ({ ...prev, startTime: v }))} />
                        <span className="text-slate-400 font-bold text-xs shrink-0">→</span>
                        <TimePicker value={form.endTime} onChange={(v) => setForm(prev => ({ ...prev, endTime: v }))} />
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">Operasyonun başlangıç ve bitiş saatleri (24 saat formatı)</p>
                    </div>

                    {/* Kişi + durum */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Planlanan Kişi</label>
                        <input type="number" min={0} value={form.plannedCount} onChange={(e) => setForm(prev => ({ ...prev, plannedCount: e.target.value }))} className={inputCls} placeholder="Örn: 45" />
                        {formCompany?.employeeCount !== undefined && formCompany.employeeCount > 0 && (
                          <p className="text-[10px] text-slate-400 mt-1.5">Firma çalışan sayısı: {formCompany.employeeCount} (otomatik doldu)</p>
                        )}
                      </div>
                      <div>
                        <label className={labelCls}>Durum</label>
                        <select value={form.status} onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as ScreeningStatus }))} className={inputCls}>
                          {(Object.keys(STATUS_META) as ScreeningStatus[]).map(st => <option key={st} value={st}>{STATUS_META[st].label}</option>)}
                        </select>
                      </div>
                      {editingId && (
                        <div>
                          <label className={labelCls}>Tamamlanan Kişi</label>
                          <input type="number" min={0} value={form.completedCount} onChange={(e) => setForm(prev => ({ ...prev, completedCount: e.target.value }))} className={inputCls} />
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {/* ══ ADIM 2: TEST SEÇİMİ ══ */}
            {wizardStep === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <StepHeader icon={FlaskConical} title="Tarama Testleri" desc={<><span className="font-bold text-blue-600">{formCompany?.name || 'Firma'}</span> için test havuzundan tetkik seçin</>} />

                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                  {/* ── SOL: TEST HAVUZU ── */}
                  <Panel icon={FlaskConical} title="Test Havuzu" bodyClassName="p-0 flex flex-col" right={
                    <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                      <div className="relative flex-1 max-w-[200px]">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                        <input
                          type="text"
                          placeholder="Tetkik ara..."
                          value={testSearch}
                          onChange={(e) => setTestSearch(e.target.value)}
                          className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">{allTests.length} test</span>
                    </div>
                  }>
                    {/* Filtre şeridi — firma şablonu + temizle */}
                    <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                      {formCompany && formCompany.tests.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={applyCompanyTemplate}
                            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
                            title="Firmanın kayıtlı test şablonunu toplu ekler"
                          >
                            <Building2 size={11}/> Firma Şablonu ({formCompany.tests.length})
                          </button>
                          <span className="w-px h-4 bg-slate-200 shrink-0 mx-0.5" />
                        </>
                      )}
                      {form.testItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, testItems: [] }))}
                          className="shrink-0 px-2.5 py-1 text-[10px] font-bold text-slate-500 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                        >
                          Tümünü Temizle
                        </button>
                      )}
                    </div>

                    <div className="max-h-[460px] overflow-y-auto">
                      {testsByCategory.map(([cat, catTests]) => (
                        <div key={cat}>
                          {/* Kategori başlığı — scroll'da üstte sabit kalır */}
                          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-slate-50/95 backdrop-blur border-b border-slate-100">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{cat}</span>
                            <div className="flex items-center gap-2.5">
                              <span className="text-[9px] font-bold text-slate-400">{catTests.length} test</span>
                              <button
                                type="button"
                                onClick={() => setForm(prev => {
                                  const allIn = catTests.every(t => prev.testItems.some(i => i.testId === t.id));
                                  const existing = new Set(prev.testItems.map(i => i.testId));
                                  if (allIn) {
                                    return { ...prev, testItems: prev.testItems.filter(i => !catTests.some(t => t.id === i.testId)) };
                                  }
                                  const toAdd = catTests.filter(t => !existing.has(t.id)).map(t => ({ testId: t.id, name: t.name, quantity: parseInt(prev.plannedCount) || 1, unitPrice: testPrice(t) }));
                                  return { ...prev, testItems: [...prev.testItems, ...toAdd] };
                                })}
                                className="text-[9px] font-bold text-blue-600 hover:text-blue-700"
                              >
                                {catTests.every(t => form.testItems.some(i => i.testId === t.id)) ? 'Kaldır' : 'Tümünü Ekle'}
                              </button>
                            </div>
                          </div>
                          <div className="p-2 space-y-1">
                            {catTests.map(t => {
                              const sel = form.testItems.some(i => i.testId === t.id);
                              const inTemplate = formCompany?.tests.some(ct => ct.id === t.id);
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => toggleTest(t.id)}
                                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left text-[11px] font-medium transition-all ${
                                    sel ? 'border-blue-300 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/30'
                                  }`}
                                >
                                  <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ${sel ? 'bg-blue-600 text-white' : 'bg-slate-200 text-transparent'}`}>
                                    {sel ? <Check size={10}/> : <Plus size={10}/>}
                                  </span>
                                  <span className="truncate flex-1">{t.name}</span>
                                  {inTemplate && !sel && <span className="text-[8px] font-bold text-blue-400 shrink-0">ŞABLON</span>}
                                  {sel && <span className="text-[8px] font-bold text-blue-500 shrink-0">EKLENDİ</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {testsByCategory.length === 0 && <p className="text-xs text-slate-400 italic text-center py-6">Eşleşen test yok.</p>}
                    </div>
                  </Panel>

                  {/* ── SAĞ: SEÇİLİ TESTLER (FİYAT & MİKTAR) ── */}
                  <Panel
                    icon={Calculator}
                    title="Seçili Testler & Fiyatlandırma"
                    bodyClassName="p-0 flex flex-col"
                    right={
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{form.testItems.length} test</span>
                    }
                  >
                    {form.testItems.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                          <FlaskConical size={22} className="text-slate-300" />
                        </div>
                        <p className="text-xs font-bold text-slate-500">Henüz test seçilmedi</p>
                        <p className="text-[10px] text-slate-400 mt-1">Soldaki havuzdan test ekleyin</p>
                      </div>
                    ) : (
                      <>
                        {/* Kolon başlıkları */}
                        <div className="hidden sm:grid grid-cols-12 gap-1.5 px-3 py-2 border-b border-slate-100 bg-slate-50/70">
                          <div className="col-span-5 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Test Adı</div>
                          <div className="col-span-2 text-center text-[9px] font-bold text-slate-400 uppercase tracking-wider">Miktar</div>
                          <div className="col-span-2 text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider">Birim ₺</div>
                          <div className="col-span-2 text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tutar</div>
                          <div className="col-span-1" />
                        </div>
                        {/* Test kalemleri */}
                        <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
                          {form.testItems.map(item => (
                            <div key={item.testId} className="grid grid-cols-12 gap-1.5 items-center px-3 py-2 bg-white hover:bg-slate-50/50 transition-colors">
                              <div className="col-span-12 sm:col-span-5 flex items-center gap-1.5 min-w-0">
                                <FlaskConical size={11} className="text-blue-500 shrink-0" />
                                <span className="text-[11px] font-medium text-slate-700 truncate">{item.name}</span>
                              </div>
                              <div className="col-span-4 sm:col-span-2">
                                <span className="sm:hidden block text-[8px] font-bold text-slate-400 uppercase mb-0.5 text-center">Miktar</span>
                                <input
                                  type="number" min={1}
                                  value={item.quantity}
                                  onChange={(e) => updateTestItem(item.testId, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                                  className="w-full text-[11px] border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none px-2 py-1.5 text-center transition-all"
                                  title="Kişi / Adet"
                                />
                              </div>
                              <div className="col-span-4 sm:col-span-2">
                                <span className="sm:hidden block text-[8px] font-bold text-slate-400 uppercase mb-0.5 text-right">Birim ₺</span>
                                <input
                                  type="number" min={0} step={0.01}
                                  value={item.unitPrice || ''}
                                  onChange={(e) => updateTestItem(item.testId, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                                  className={`w-full text-[11px] border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 outline-none px-2 py-1.5 text-right transition-all ${item.unitPrice <= 0 ? 'border-amber-300 focus:ring-amber-100 focus:border-amber-400' : 'border-slate-200 focus:ring-blue-100 focus:border-blue-400'}`}
                                  placeholder="0"
                                />
                              </div>
                              <div className="col-span-3 sm:col-span-2 text-right">
                                <span className="sm:hidden block text-[8px] font-bold text-slate-400 uppercase mb-0.5">Tutar</span>
                                <span className="text-[11px] font-black text-slate-700 tabular-nums">{fmtTL(item.quantity * item.unitPrice)}</span>
                              </div>
                              <div className="col-span-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => toggleTest(item.testId)}
                                  className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                  title="Kaldır"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Alt özet — toplam tutar */}
                        <div className="px-3 py-2.5 border-t border-slate-100 bg-slate-50/70 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-500">{form.testItems.length} test · {form.testItems.reduce((s, i) => s + i.quantity, 0)} adet</span>
                            <button
                              type="button"
                              onClick={() => setForm(prev => ({ ...prev, testItems: [] }))}
                              className="text-[10px] font-bold text-red-500 hover:text-red-600"
                            >
                              Tümünü Temizle
                            </button>
                          </div>
                          <div className="flex items-center justify-between pt-1.5 border-t border-slate-200">
                            <span className="text-xs font-black text-slate-700">Testler Ara Toplam</span>
                            <span className="text-sm font-black text-blue-700 tabular-nums">{fmtTL(form.testItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0))}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </Panel>
                </div>
              </div>
            )}

            {/* ══ ADIM 3: MALİYET & FİYATLANDIRMA ══ */}
            {wizardStep === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <StepHeader icon={Calculator} title="Maliyet & Fiyatlandırma" desc="Tarama maliyetini ve fiyatını hesaplayın" />

                <div className="max-w-3xl mx-auto space-y-5">
                  <Panel icon={Calculator} title="Fiyatlandırma" bodyClassName="p-5 space-y-5">
                    {/* Test kalemleri özeti — 2. adımdan gelir */}
                    <div>
                      <label className={labelCls}><FlaskConical size={10} className="inline mr-1"/>Test Kalemleri Toplamı</label>
                      <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-black text-blue-700 tabular-nums">{fmtTL(testItemsSubtotal(form.testItems))}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{form.testItems.length} test · {form.testItems.reduce((s, i) => s + i.quantity, 0)} adet</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => goToStep(2)}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                          >
                            <ArrowLeft size={10}/> Test Adımına Dön
                          </button>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">Fiyatlar 2. adımdaki test kalemlerinden gelir</p>
                    </div>

                    {/* Ek maliyetler + indirim */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Ek Maliyetler (TL)</label>
                        <div className="relative">
                          <input type="number" min="0" step="0.01" value={form.extraCosts} onChange={(e) => setForm(prev => ({ ...prev, extraCosts: e.target.value }))} className={inputCls} placeholder="0.00" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">TL</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">Seyahat, konaklama, yemek vb.</p>
                      </div>
                      <div>
                        <label className={labelCls}>İndirim (TL)</label>
                        <div className="relative">
                          <input type="number" min="0" step="0.01" value={form.discount} onChange={(e) => setForm(prev => ({ ...prev, discount: e.target.value }))} className={inputCls} placeholder="0.00" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">TL</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">Toplam tutardan düşülür</p>
                      </div>
                    </div>

                    {/* KDV oranı */}
                    <div>
                      <label className={labelCls}><Percent size={10} className="inline mr-1"/>KDV Oranı (%)</label>
                      <div className="relative max-w-[200px]">
                        <input type="number" min="0" max="100" step="1" value={form.vatRate} onChange={(e) => setForm(prev => ({ ...prev, vatRate: e.target.value }))} className={inputCls} placeholder="20" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">Standart KDV oranı %20</p>
                    </div>

                    {/* Maliyet notları */}
                    <div>
                      <label className={labelCls}>Maliyet Notları</label>
                      <textarea value={form.costNotes} onChange={(e) => setForm(prev => ({ ...prev, costNotes: e.target.value }))} className={inputCls + ' min-h-[80px] resize-y'} placeholder="Ödeme vadesi, fatura detayları, özel koşullar..." />
                    </div>
                  </Panel>

                  {/* Canlı maliyet hesaplama kartı */}
                  <Panel icon={Calculator} title="Maliyet Hesabı" bodyClassName="p-5">
                    {(() => {
                      const { sub, disc, vat, total } = calcTotal(form.testItems, form.extraCosts, form.discount, form.vatRate);
                      const testsTotal = testItemsSubtotal(form.testItems);
                      return (
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center text-xs py-2 border-b border-slate-100">
                            <span className="text-slate-500 flex items-center gap-1.5"><FlaskConical size={12}/> Test Kalemleri</span>
                            <span className="font-bold text-slate-700 tabular-nums">{fmtTL(testsTotal)}</span>
                          </div>
                          {num(form.extraCosts) > 0 && (
                            <div className="flex justify-between items-center text-xs py-2 border-b border-slate-100">
                              <span className="text-slate-500">Ek Maliyetler</span>
                              <span className="font-bold text-slate-700 tabular-nums">+{fmtTL(num(form.extraCosts))}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs py-2 border-b border-slate-100">
                            <span className="text-slate-500 font-bold">Ara Toplam</span>
                            <span className="font-black text-slate-800 tabular-nums">{fmtTL(sub)}</span>
                          </div>
                          {disc > 0 && (
                            <div className="flex justify-between items-center text-xs py-2 border-b border-slate-100">
                              <span className="text-emerald-600 font-bold">İndirim</span>
                              <span className="font-bold text-emerald-600 tabular-nums">-{fmtTL(disc)}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs py-2 border-b border-slate-100">
                            <span className="text-slate-500">KDV (%{form.vatRate || '0'})</span>
                            <span className="font-bold text-slate-700 tabular-nums">+{fmtTL(vat)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm py-3 bg-blue-50 rounded-xl px-3 mt-2">
                            <span className="font-black text-blue-800">Genel Toplam</span>
                            <span className="font-black text-blue-700 tabular-nums text-lg">{fmtTL(total)}</span>
                          </div>
                          {num(form.plannedCount) > 0 && (
                            <p className="text-[10px] text-slate-400 text-center pt-1">
                              Kişi başı net maliyet: <span className="font-bold text-slate-600">{fmtTL(total / num(form.plannedCount))}</span>
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </Panel>
                </div>
              </div>
            )}

            {/* ══ ADIM 4: ÖN YAZISI ══ */}
            {wizardStep === 4 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <StepHeader icon={FileText} title="Tarama Ön Yazısı" desc="Firma ve tarama bilgilerinden otomatik üretilir, dilediğiniz gibi düzenleyin" />

                <div className="max-w-5xl mx-auto space-y-4">
                  {/* Beslenen veri çipleri — metnin hangi bilgilerle üretildiğini gösterir */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Otomatik veri:</span>
                    {formCompany?.name && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{formCompany.name}</span>}
                    {formCompany?.contactPerson && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{formCompany.contactPerson}</span>}
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{screeningTypeLabel(form.screeningType)}</span>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{form.testItems.length} test</span>
                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{form.plannedCount || '0'} kişi</span>
                  </div>

                  {/* Editör + canlı doküman önizlemesi */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Sol: editör */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
                      <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Ön Yazı Metni</span>
                        <div className="flex items-center gap-2">
                          {form.coverLetterEdited && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Elle düzenlendi</span>
                          )}
                          <button
                            onClick={regenerateCoverLetter}
                            className="text-[10px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 transition-colors"
                            title="Seçili verilere göre yeniden üret"
                          >
                            <RotateCcw size={10}/> Yeniden Üret
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={form.coverLetter}
                        onChange={(e) => setForm(prev => ({ ...prev, coverLetter: e.target.value, coverLetterEdited: true }))}
                        rows={16}
                        className="flex-1 w-full text-xs leading-relaxed text-slate-700 p-4 outline-none resize-y bg-white placeholder-slate-400 min-h-[320px]"
                        placeholder="Sayın Yetkili, ..."
                      />
                      <div className="px-4 py-2 bg-slate-50/60 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
                        <span>{form.coverLetter.length} karakter · {form.coverLetter.trim() ? form.coverLetter.trim().split(/\s+/).length : 0} kelime</span>
                        <span>{form.coverLetter.split('\n').filter(l => l.trim()).length} paragraf</span>
                      </div>
                    </div>

                    {/* Sağ: doküman görünümü */}
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
                      <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Doküman Görünümü</span>
                        <span className="text-[9px] font-bold text-slate-400">Canlı</span>
                      </div>
                      <div className="flex-1 p-5 overflow-y-auto max-h-[480px]">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                          <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Sayın</p>
                          <p className="text-sm font-black text-slate-900">{formCompany?.name || '—'}</p>
                          {formCompany?.contactPerson && <p className="text-[10px] text-slate-500 mt-0.5">İlgili: {formCompany.contactPerson}</p>}
                        </div>
                        {form.title && (
                          <div className="mb-4 flex items-baseline gap-2">
                            <span className="text-[9px] font-bold text-slate-500 uppercase shrink-0">Konu:</span>
                            <span className="text-xs font-bold text-slate-800">{form.title}</span>
                          </div>
                        )}
                        {form.coverLetter ? (
                          <div className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap border-l-2 border-slate-200 pl-3">
                            {form.coverLetter}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <FileText size={28} className="mx-auto text-slate-300 mb-2" />
                            <p className="text-[11px] text-slate-400 italic">Ön yazı metni boş — "Yeniden Üret" butonuyla otomatik oluşturun</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══ ADIM 5: ŞARTLAR VE KOŞULLAR ══ */}
            {wizardStep === 5 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <StepHeader icon={ScrollText} title="Şartlar ve Koşullar" desc="Kütüphaneden madde seçin — seçilenleri düzenleyebilir, silebilir, sıralayabilirsiniz" />

                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                  {/* SOL: MADDE KÜTÜPHANESİ */}
                  <div className="bg-white border border-slate-200 rounded-2xl max-h-[560px] overflow-y-auto">
                    <div className="sticky top-0 z-10 px-4 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                          <ScrollText size={14}/> Madde Kütüphanesi
                        </h3>
                        <button
                          onClick={addRecommendedTerms}
                          className="text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg px-2.5 py-1 transition-colors whitespace-nowrap"
                          title="Standart taramalar için önerilen maddeleri toplu ekler"
                        >
                          Önerilen Set
                        </button>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                        <input
                          type="text"
                          placeholder="Madde ara..."
                          value={termSearch}
                          onChange={(e) => setTermSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                        />
                      </div>
                    </div>
                    {SCREENING_TERM_LIBRARY.map(group => {
                      const q = termSearch.trim().toLowerCase();
                      const visibleItems = group.items.filter(t => !q || t.text.toLowerCase().includes(q));
                      if (visibleItems.length === 0) return null;
                      const pendingTexts = visibleItems.map(t => t.text).filter(t => !form.terms.includes(t));
                      return (
                        <div key={group.category}>
                          <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{group.category}</span>
                            <button
                              onClick={() => addTerms(pendingTexts)}
                              disabled={pendingTexts.length === 0}
                              className="text-[9px] font-bold text-blue-600 hover:text-blue-700 disabled:text-slate-300 transition-colors"
                            >
                              {pendingTexts.length === 0 ? 'Tümü eklendi' : '+ Tümünü Ekle'}
                            </button>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {visibleItems.map((term, ti) => {
                              const alreadyAdded = form.terms.includes(term.text);
                              return (
                                <div key={ti} className="flex items-start gap-2.5 px-4 py-3">
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-xs leading-relaxed ${alreadyAdded ? 'text-slate-300 line-through' : 'text-slate-600'}`}>{term.text}</p>
                                    {term.rec && !alreadyAdded && <span className="inline-block mt-1 text-[8px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">ÖNERİLEN</span>}
                                  </div>
                                  <button
                                    onClick={() => !alreadyAdded && addTerm(term.text)}
                                    disabled={alreadyAdded}
                                    className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                                      alreadyAdded ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-700'
                                    }`}
                                    title={alreadyAdded ? 'Zaten eklendi' : 'Maddeyi ekle'}
                                  >
                                    {alreadyAdded ? <Check size={12}/> : <Plus size={12}/>}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {termSearch && SCREENING_TERM_LIBRARY.every(g => !g.items.some(t => t.text.toLowerCase().includes(termSearch.trim().toLowerCase()))) && (
                      <div className="p-8 text-center text-sm text-slate-400">Aramayla eşleşen madde yok</div>
                    )}
                  </div>

                  {/* SAĞ: SEÇİLEN MADDELER */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-fit lg:sticky lg:top-20">
                    <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between gap-3">
                      <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide">Tarama Şartları</h3>
                      <div className="flex items-center gap-2">
                        {form.terms.length > 0 && (
                          <button
                            onClick={() => setForm(prev => ({ ...prev, terms: [] }))}
                            className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
                          >
                            Temizle
                          </button>
                        )}
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-0.5">{form.terms.length} madde</span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
                      {form.terms.length === 0 ? (
                        <div className="p-10 text-center">
                          <ScrollText size={28} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-sm text-slate-400 font-medium">Henüz madde eklenmedi</p>
                          <p className="text-[11px] text-slate-400 mt-1">Soldan madde seçin veya özel madde ekleyin</p>
                          <button onClick={() => addTerm('')} className="mt-3 px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors">
                            Özel Madde Ekle
                          </button>
                        </div>
                      ) : (
                        <>
                          {form.terms.map((term, idx) => (
                            <div key={idx} className="flex items-start gap-2 px-3 py-2">
                              <div className="flex flex-col shrink-0 pt-1">
                                <button onClick={() => moveTerm(idx, 'up')} disabled={idx === 0} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"><ChevronUp size={12}/></button>
                                <button onClick={() => moveTerm(idx, 'down')} disabled={idx === form.terms.length - 1} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"><ChevronDown size={12}/></button>
                              </div>
                              <span className="text-[10px] font-black text-slate-300 w-4 pt-1.5 text-center shrink-0">{idx + 1}</span>
                              <textarea
                                value={term}
                                onChange={(e) => updateTerm(idx, e.target.value)}
                                rows={2}
                                className="flex-1 min-w-0 text-xs leading-relaxed border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none px-2.5 py-1.5 transition-all resize-y"
                                placeholder="Madde metni"
                              />
                              <button onClick={() => removeTerm(idx)} className="p-1.5 shrink-0 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"><X size={14}/></button>
                            </div>
                          ))}
                          <div className="px-4 py-2.5 bg-slate-50/40">
                            <button onClick={() => addTerm('')} className="text-[11px] font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1 transition-colors">
                              <Plus size={12}/> Özel Madde Ekle
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {form.terms.length > 0 && (
                      <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 text-[10px] text-slate-400 font-medium">
                        Maddeler tarama dokümanında "Şartlar ve Koşullar" başlığı altında numaralı liste olarak basılır
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ══ ADIM 6: ÖNİZLEME & KAYDET ══ */}
            {wizardStep === 6 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <StepHeader icon={FileCheck} title="Önizleme & Onay" desc="Tarama detaylarını kontrol edip kaydedin" />

                <div className="max-w-3xl mx-auto space-y-5">
                  {/* Özet kartı */}
                  <Panel icon={ClipboardList} title="Tarama Özeti">
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Firma</p>
                          <div className="flex items-center gap-2">
                            <Building2 size={14} className="text-slate-400 shrink-0" />
                            <p className="font-bold text-slate-800">{formCompany?.name || '—'}</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Tarama Türü</p>
                          <div className="flex items-center gap-2">
                            <Stethoscope size={14} className="text-slate-400 shrink-0" />
                            <p className="font-bold text-slate-800">{screeningTypeLabel(form.screeningType) || '—'}</p>
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Tarih & Saat</p>
                          <div className="flex items-center gap-2">
                            <CalendarDays size={14} className="text-slate-400 shrink-0" />
                            <p className="font-bold text-slate-800">
                              {new Date(form.date).toLocaleDateString('tr-TR')}
                              {form.endDate && ` → ${new Date(form.endDate).toLocaleDateString('tr-TR')}`}
                            </p>
                          </div>
                          {(form.startTime || form.endTime) && (
                            <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                              <Clock size={10}/> {form.startTime || '—'} - {form.endTime || '—'}
                            </p>
                          )}
                        </div>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Planlanan Kişi</p>
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-slate-400 shrink-0" />
                            <p className="font-bold text-slate-800">{form.plannedCount || '0'}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <FlaskConical size={12} /> Seçili Testler ({selectedTests.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedTests.map(t => (
                            <span key={t.id} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{t.name}</span>
                          ))}
                          {selectedTests.length === 0 && <p className="text-xs text-slate-400 italic">Test seçilmedi</p>}
                        </div>
                      </div>

                      {form.coverLetter && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                            <FileText size={12} /> Ön Yazı
                          </p>
                          <p className="text-xs text-slate-600 bg-blue-50/30 border border-blue-100 rounded-xl p-3 line-clamp-3">{form.coverLetter}</p>
                        </div>
                      )}

                      {form.terms.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                            <ScrollText size={12} /> Şartlar ({form.terms.length} madde)
                          </p>
                          <ol className="text-xs text-slate-600 bg-amber-50/30 border border-amber-100 rounded-xl p-3 space-y-1 list-decimal list-inside">
                            {form.terms.map((t, i) => <li key={i} className="line-clamp-1">{t}</li>)}
                          </ol>
                        </div>
                      )}

                      {/* Maliyet özeti */}
                      {(testItemsSubtotal(form.testItems) > 0 || parseFloat(form.extraCosts) > 0) && (() => {
                        const { disc, vat, total } = calcTotal(form.testItems, form.extraCosts, form.discount, form.vatRate);
                        return (
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                              <Calculator size={12} /> Maliyet Özeti
                            </p>
                            <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-3 space-y-1.5 text-xs">
                              <div className="flex justify-between text-slate-600">
                                <span>Test Kalemleri ({form.testItems.length} kalem)</span>
                                <span className="font-bold tabular-nums">{fmtTL(testItemsSubtotal(form.testItems))}</span>
                              </div>
                              {num(form.extraCosts) > 0 && (
                                <div className="flex justify-between text-slate-600">
                                  <span>Ek Maliyetler</span>
                                  <span className="font-bold tabular-nums">+{fmtTL(num(form.extraCosts))}</span>
                                </div>
                              )}
                              {disc > 0 && (
                                <div className="flex justify-between text-emerald-600">
                                  <span>İndirim</span>
                                  <span className="font-bold tabular-nums">-{fmtTL(disc)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-slate-600">
                                <span>KDV (%{form.vatRate || '0'})</span>
                                <span className="font-bold tabular-nums">+{fmtTL(vat)}</span>
                              </div>
                              <div className="flex justify-between pt-1.5 border-t border-blue-200">
                                <span className="font-black text-blue-800">Genel Toplam</span>
                                <span className="font-black text-blue-700 tabular-nums">{fmtTL(total)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </Panel>
                </div>
              </div>
            )}

            {/* Alt navigasyon — viewport dibine yapışık yüzen bar */}
            <div className="sticky bottom-3 z-30 pt-2">
              <div className="flex items-center justify-between gap-3 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl px-2.5 py-2 shadow-xl shadow-slate-200/70">
                <button
                  onClick={() => { if (wizardStep === 1) { if (onBack) onBack('screenings'); else closeWizard(); } else goBack(); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <ArrowLeft size={14} /> {wizardStep === 1 ? 'Vazgeç' : 'Geri'}
                </button>

                {/* Adım göstergesi */}
                <div className="hidden sm:flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Adım {wizardStep}/6</span>
                  <div className="flex gap-1">
                    {WIZARD_STEPS.map(s => (
                      <button
                        key={s.key}
                        onClick={() => goToStep(s.key)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${wizardStep === s.key ? 'bg-blue-600 scale-110' : stepDone(s.key) ? 'bg-blue-300 hover:bg-blue-400' : 'bg-slate-200 hover:bg-slate-300'}`}
                        title={s.label}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 truncate">{WIZARD_STEPS.find(s => s.key === wizardStep)?.label}</span>
                </div>

                {wizardStep < 6 ? (
                  <button
                    onClick={goNext}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-200 active:scale-95"
                  >
                    Devam Et <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    onClick={saveForm}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-blue-200 active:scale-95"
                  >
                    <CheckCircle2 size={15} /> {editingId ? 'Değişiklikleri Kaydet' : 'Tarama Oluştur'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ FİRMA ARAMA MODALI ═══ */}
      <Modal open={companyMenuOpen} onClose={() => { setCompanyMenuOpen(false); setCompanySearch(''); }} overlayClassName="p-2 sm:p-4">
        <div className={`${modalPanel} rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0"><Building2 size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Firma Seçin</h3>
                <p className="text-[11px] text-slate-500">{companies.length} kayıtlı firma</p>
              </div>
            </div>
            <button onClick={() => { setCompanyMenuOpen(false); setCompanySearch(''); }} className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"><X size={18}/></button>
          </div>
          <div className="p-3 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                autoFocus
                type="text"
                placeholder="Firma adı, yetkili veya sektör ara..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredCompanies.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">Eşleşen firma yok</div>
            ) : filteredCompanies.map(company => {
              const isSelected = form.companyId === company.id;
              const screeningCount = screenings.filter(s => s.companyId === company.id).length;
              return (
                <button
                  key={company.id}
                  onClick={() => { handleCompanyChange(company.id); setCompanyMenuOpen(false); setCompanySearch(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {company.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{company.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {company.sector || '—'}
                      {company.employeeCount !== undefined && ` · ${company.employeeCount} çalışan`}
                      {` · ${screeningCount} tarama`}
                      {company.contactPerson && ` · ${company.contactPerson}`}
                    </p>
                  </div>
                  {isSelected && <Check size={15} className="text-blue-600 shrink-0"/>}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={confirmDelete !== null}
        title="Taramayı Sil"
        message={`"${screenings.find(s => s.id === confirmDelete)?.title || 'Bu tarama'}" silinecek. Bu işlem geri alınamaz. Emin misiniz?`}
        confirmLabel="Evet, Sil"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmModal
        open={bulkDeleteConfirm}
        title="Toplu Sil"
        message={`${selectedIds.size} tarama silinecek. Bu işlem geri alınamaz. Emin misiniz?`}
        confirmLabel="Evet, Sil"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
};
