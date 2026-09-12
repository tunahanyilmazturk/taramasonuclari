import React, { useState, useMemo } from 'react';
import { Company, Screening, ScreeningStatus, TestDefinition } from '../../types';
import { storageService } from '../../services/storageService';
import { testCategory } from '../../constants';
import { ConfirmModal } from '../ConfirmModal';
import { Modal, modalPanel } from '../Modal';
import {
  Stethoscope, Plus, Search, MapPin, Users, FlaskConical, Check,
  CalendarDays, Play, CheckCircle2, Edit2, Trash2, X, Save,
  Building2, AlertTriangle, ClipboardList
} from 'lucide-react';

const STATUS_META: Record<ScreeningStatus, { label: string; badge: string; dot: string }> = {
  planlandi:    { label: 'Planlandı',    badge: 'bg-blue-50 text-blue-600 border-blue-100',        dot: 'bg-blue-500' },
  devam_ediyor: { label: 'Devam Ediyor', badge: 'bg-amber-50 text-amber-600 border-amber-200',     dot: 'bg-amber-500' },
  tamamlandi:   { label: 'Tamamlandı',   badge: 'bg-emerald-50 text-emerald-600 border-emerald-200', dot: 'bg-emerald-500' },
  iptal:        { label: 'İptal',        badge: 'bg-slate-100 text-slate-500 border-slate-200',    dot: 'bg-slate-400' }
};

interface ScreeningForm {
  companyId: string;
  title: string;
  date: string;
  endDate: string;
  location: string;
  status: ScreeningStatus;
  plannedCount: string;
  completedCount: string;
  notes: string;
  testIds: Set<string>;
  titleTouched: boolean;
}

const emptyForm = (): ScreeningForm => ({
  companyId: '',
  title: '',
  date: new Date().toISOString().slice(0, 10),
  endDate: '',
  location: '',
  status: 'planlandi',
  plannedCount: '',
  completedCount: '0',
  notes: '',
  testIds: new Set(),
  titleTouched: false
});

interface ScreeningsProps {
  companies: Company[];
  allTests: TestDefinition[];
}

export const Screenings: React.FC<ScreeningsProps> = ({ companies, allTests }) => {
  const [screenings, setScreenings] = useState<Screening[]>(() => storageService.getScreenings());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScreeningStatus>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScreeningForm>(emptyForm());
  const [formError, setFormError] = useState('');
  const [testSearch, setTestSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const persist = (items: Screening[]) => {
    setScreenings(items);
    storageService.saveScreenings(items);
  };

  const stats = useMemo(() => ({
    total: screenings.length,
    active: screenings.filter(s => s.status === 'devam_ediyor').length,
    upcoming: screenings.filter(s => s.status === 'planlandi' && s.date >= new Date().toISOString().slice(0, 10)).length,
    people: screenings.reduce((sum, s) => sum + (s.plannedCount || 0), 0)
  }), [screenings]);

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

  // ── Form işlemleri ──
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
    setTestSearch('');
    setFormOpen(true);
  };

  const openEdit = (s: Screening) => {
    setEditingId(s.id);
    setForm({
      companyId: s.companyId,
      title: s.title,
      date: s.date,
      endDate: s.endDate ?? '',
      location: s.location ?? '',
      status: s.status,
      plannedCount: String(s.plannedCount ?? ''),
      completedCount: String(s.completedCount ?? 0),
      notes: s.notes ?? '',
      testIds: new Set(s.testIds),
      titleTouched: true
    });
    setFormError('');
    setTestSearch('');
    setFormOpen(true);
  };

  // Firma değişince test şablonunu otomatik uygula
  const handleCompanyChange = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    setForm(prev => ({
      ...prev,
      companyId,
      title: prev.titleTouched ? prev.title : (company ? `${company.name} Taraması` : ''),
      plannedCount: prev.plannedCount || (company?.employeeCount ? String(company.employeeCount) : ''),
      testIds: company && company.tests.length > 0 ? new Set(company.tests.map(t => t.id)) : prev.testIds
    }));
  };

  const applyCompanyTemplate = () => {
    if (!formCompany) return;
    setForm(prev => ({ ...prev, testIds: new Set(formCompany.tests.map(t => t.id)) }));
  };

  const toggleTest = (id: string) => {
    setForm(prev => {
      const next = new Set(prev.testIds);
      if (next.has(id)) next.delete(id); else next.add(id);
      return { ...prev, testIds: next };
    });
  };

  const saveForm = () => {
    if (!form.companyId) { setFormError('Firma seçimi zorunludur.'); return; }
    if (!form.title.trim()) { setFormError('Tarama başlığı zorunludur.'); return; }
    if (!form.date) { setFormError('Tarih zorunludur.'); return; }
    if (form.testIds.size === 0) { setFormError('En az bir test seçmelisiniz.'); return; }

    const base = {
      companyId: form.companyId,
      title: form.title.trim(),
      date: form.date,
      endDate: form.endDate || undefined,
      location: form.location.trim(),
      status: form.status,
      testIds: [...form.testIds],
      plannedCount: Math.max(0, parseInt(form.plannedCount) || 0),
      completedCount: Math.max(0, parseInt(form.completedCount) || 0),
      notes: form.notes.trim() || undefined
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
    setFormOpen(false);
  };

  const advanceStatus = (s: Screening) => {
    const next: ScreeningStatus = s.status === 'planlandi' ? 'devam_ediyor' : s.status === 'devam_ediyor' ? 'tamamlandi' : s.status;
    persist(screenings.map(x => x.id === s.id ? { ...x, status: next } : x));
  };

  const doDelete = () => {
    if (!confirmDelete) return;
    persist(screenings.filter(s => s.id !== confirmDelete));
    if (editingId === confirmDelete) setFormOpen(false);
    setConfirmDelete(null);
  };

  const inputCls = "w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none p-2.5 transition-all placeholder-slate-400";
  const labelCls = "block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide";

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">

      {/* ── Başlık ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <Stethoscope size={24} className="text-blue-600" /> Taramalar
          </h1>
          <p className="text-xs text-slate-500 mt-1">Mobil sağlık taraması operasyonlarını planlayın ve takip edin</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95 shrink-0"
        >
          <Plus size={16} /> Yeni Tarama
        </button>
      </div>

      {/* ── Özet Kartlar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0"><ClipboardList size={18}/></div>
          <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.total}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Tarama</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0"><Play size={18}/></div>
          <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.active}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Devam Eden</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><CalendarDays size={18}/></div>
          <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.upcoming}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Yaklaşan</p></div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><Users size={18}/></div>
          <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.people}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Planlanan Kişi</p></div>
        </div>
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
            <button onClick={openCreate} className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200">
              <Plus size={16} /> Tarama Planla
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => {
            const company = companies.find(c => c.id === s.companyId);
            const meta = STATUS_META[s.status];
            const pct = s.plannedCount > 0 ? Math.min(100, Math.round((s.completedCount / s.plannedCount) * 100)) : 0;
            const testNames = s.testIds.map(id => allTests.find(t => t.id === id)?.name).filter(Boolean) as string[];
            const isToday = s.date === new Date().toISOString().slice(0, 10);
            return (
              <div
                key={s.id}
                onClick={() => openEdit(s)}
                className="relative bg-white rounded-2xl border border-slate-200 p-5 flex flex-col hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/50 transition-all group cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-600 flex flex-col items-center justify-center shrink-0">
                      <span className="text-sm font-black leading-none">{new Date(s.date).getDate()}</span>
                      <span className="text-[8px] font-bold uppercase">{new Date(s.date).toLocaleDateString('tr-TR', { month: 'short' })}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-slate-800 truncate leading-tight">{s.title}</h3>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                        <Building2 size={10} className="shrink-0" /> {company?.name || 'Firma silinmiş'}
                      </p>
                    </div>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap shrink-0 ${meta.badge}`}>
                    {isToday && s.status === 'planlandi' ? 'BUGÜN' : meta.label}
                  </span>
                </div>

                <div className="space-y-1.5 mb-3 text-xs text-slate-600">
                  <p className="flex items-center gap-2"><MapPin size={12} className="text-slate-400 shrink-0"/> <span className="truncate">{s.location || 'Konum belirtilmemiş'}</span></p>
                  <p className="flex items-center gap-2"><Users size={12} className="text-slate-400 shrink-0"/> {s.completedCount}/{s.plannedCount} kişi tamamlandı</p>
                </div>

                {/* İlerleme */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 mb-1">
                    <span>İlerleme</span><span className="tabular-nums">%{pct}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Test çipleri */}
                <div className="flex flex-wrap gap-1 mb-3">
                  <FlaskConical size={11} className="text-slate-300 mt-0.5 shrink-0"/>
                  {testNames.slice(0, 4).map((n, i) => (
                    <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{n}</span>
                  ))}
                  {testNames.length > 4 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{testNames.length - 4}</span>}
                  {testNames.length === 0 && <span className="text-[9px] text-slate-300 italic">Test yok</span>}
                </div>

                {/* Aksiyonlar */}
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
      )}

      {/* ═══ TARAMA FORM MODALI ═══ */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} overlayClassName="p-2 sm:p-4" closeOnBackdrop={false}>
        <div className={`${modalPanel} rounded-3xl w-full max-w-2xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden`}>

          {/* Modal header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0"><Stethoscope size={18}/></div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">{editingId ? form.title : 'Yeni Tarama'}</h3>
                <p className="text-[11px] text-slate-500">{editingId ? 'Tarama detaylarını düzenleyin' : 'Mobil tarama operasyonu planlayın'}</p>
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

            {/* Operasyon Bilgileri */}
            <section>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Stethoscope size={13} className="text-blue-500"/> Operasyon Bilgileri</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Firma *</label>
                  <select
                    value={form.companyId}
                    onChange={(e) => handleCompanyChange(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Firma seçin...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}{c.tests.length > 0 ? ` — ${c.tests.length} test şablonu` : ''}</option>)}
                  </select>
                  {formCompany && formCompany.tests.length > 0 && (
                    <p className="text-[10px] text-indigo-500 font-semibold mt-1.5 flex items-center gap-1"><Check size={11}/> Firma şablonundaki {formCompany.tests.length} test otomatik uygulandı</p>
                  )}
                  {formCompany && formCompany.tests.length === 0 && (
                    <p className="text-[10px] text-slate-400 mt-1.5">Bu firmada test şablonu yok — aşağıdan manuel seçin.</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Tarama Başlığı *</label>
                  <input type="text" value={form.title} onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value, titleTouched: true }))} className={inputCls} placeholder="Örn: ABC Lojistik Periyodik Taraması" />
                </div>
                <div>
                  <label className={labelCls}>Başlangıç Tarihi *</label>
                  <input type="date" value={form.date} onChange={(e) => setForm(prev => ({ ...prev, date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Bitiş Tarihi</label>
                  <input type="date" value={form.endDate} min={form.date} onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))} className={inputCls} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Konum</label>
                  <input type="text" value={form.location} onChange={(e) => setForm(prev => ({ ...prev, location: e.target.value }))} className={inputCls} placeholder="Örn: Fabrika sahası, Merkez ofis" />
                </div>
                <div>
                  <label className={labelCls}>Planlanan Kişi</label>
                  <input type="number" min={0} value={form.plannedCount} onChange={(e) => setForm(prev => ({ ...prev, plannedCount: e.target.value }))} className={inputCls} placeholder="Örn: 45" />
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
                <div className="sm:col-span-2">
                  <label className={labelCls}>Notlar</label>
                  <textarea value={form.notes} onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))} className={inputCls + ' resize-none'} rows={2} placeholder="Operasyon notları, özel talimatlar..." />
                </div>
              </div>
            </section>

            {/* Test Seçimi — firma şablonundan otomatik dolar */}
            <section className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2"><FlaskConical size={13} className="text-indigo-500"/> Tarama Testleri *</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{form.testIds.size} test</span>
                  {formCompany && formCompany.tests.length > 0 && (
                    <button type="button" onClick={applyCompanyTemplate} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700">Şablonu Uygula</button>
                  )}
                  {form.testIds.size > 0 && (
                    <button type="button" onClick={() => setForm(prev => ({ ...prev, testIds: new Set() }))} className="text-[10px] font-bold text-slate-400 hover:text-slate-600">Temizle</button>
                  )}
                </div>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                <input
                  type="text"
                  placeholder="Test ara..."
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all"
                />
              </div>
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {testsByCategory.map(([cat, catTests]) => (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">{cat}</span>
                      <button
                        type="button"
                        onClick={() => setForm(prev => {
                          const next = new Set(prev.testIds);
                          const allIn = catTests.every(t => next.has(t.id));
                          catTests.forEach(t => { if (allIn) next.delete(t.id); else next.add(t.id); });
                          return { ...prev, testIds: next };
                        })}
                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-700"
                      >
                        {catTests.every(t => form.testIds.has(t.id)) ? 'Kaldır' : 'Tümünü Seç'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {catTests.map(t => {
                        const sel = form.testIds.has(t.id);
                        const inTemplate = formCompany?.tests.some(ct => ct.id === t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => toggleTest(t.id)}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left text-[11px] font-medium transition-all ${
                              sel ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 ${sel ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-transparent'}`}><Check size={10}/></span>
                            <span className="truncate flex-1">{t.name}</span>
                            {inTemplate && !sel && <span className="text-[8px] font-bold text-indigo-400 shrink-0">ŞABLON</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {testsByCategory.length === 0 && <p className="text-xs text-slate-400 italic text-center py-3">Eşleşen test yok.</p>}
              </div>
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
                <Save size={14}/> {editingId ? 'Kaydet' : 'Tarama Oluştur'}
              </button>
            </div>
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
    </div>
  );
};
