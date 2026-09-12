import React, { useState, useMemo } from 'react';
import { Company, PatientRecord, HazardClass, TestDefinition } from '../types';
import { testCategory } from '../constants';
import { ConfirmModal } from './ConfirmModal';
import { Modal, modalPanel } from './Modal';
import {
  Building2, Plus, Save, Trash2, Search, Copy,
  User, FileText, FlaskConical, Check,
  Phone, Users as UsersIcon, Factory, AlertTriangle,
  Edit2, StickyNote, X
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

interface CompanyManagerProps {
  companies: Company[];
  records?: PatientRecord[];
  allTests?: TestDefinition[];
  onUpdateCompanies: (companies: Company[]) => void;
}

export const CompanyManager: React.FC<CompanyManagerProps> = ({
  companies,
  records = [],
  allTests = [],
  onUpdateCompanies
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [hazardFilter, setHazardFilter] = useState<'all' | HazardClass>('all');

  // Form modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Company>>(emptyCompanyForm());
  const [formError, setFormError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClone, setConfirmClone] = useState<Company | null>(null);

  // ── İstatistikler ──
  const stats = useMemo(() => ({
      total: companies.length,
      employees: companies.reduce((s, c) => s + (c.employeeCount || 0), 0),
      cokTehlikeli: companies.filter(c => c.hazardClass === 'cok_tehlikeli').length,
      records: records.length
  }), [companies, records]);

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

  const recordCountOf = (companyId: string) => records.filter(r => r.companyId === companyId).length;

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
    setConfirmDelete(null);
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

      {/* ── Özet Kartlar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0"><Building2 size={18}/></div>
          <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.total}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Firma</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><UsersIcon size={18}/></div>
          <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.employees}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Çalışan</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle size={18}/></div>
          <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.cokTehlikeli}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Çok Tehlikeli</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><FileText size={18}/></div>
          <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.records}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tarama Kaydı</p></div>
        </div>
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCompanies.map(company => {
            const hazard = company.hazardClass ? HAZARD_CLASSES[company.hazardClass] : null;
            const recCount = recordCountOf(company.id);
            return (
              <div
                key={company.id}
                onClick={() => openEdit(company)}
                className="relative bg-white rounded-2xl border border-slate-200 p-5 flex flex-col hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all group cursor-pointer"
              >
                {/* Kart başlığı */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 shadow-sm ${hazard?.avatar ?? 'bg-slate-400'}`}>
                      {company.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-800 truncate leading-tight">{company.name}</h3>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                        <Factory size={10} className="shrink-0" /> {company.sector || 'Sektör belirtilmemiş'}
                      </p>
                    </div>
                  </div>
                  {hazard && (
                    <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap shrink-0 ${hazard.badge}`}>
                      {hazard.label}
                    </span>
                  )}
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
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Phone size={13} className="text-emerald-500"/> İletişim</h4>
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
    </div>
  );
};
