import React, { useMemo } from 'react';
import { Company, PatientRecord, User } from '../types';
import { storageService } from '../services/storageService';
import { isAbnormalStatus, parseTrDate } from '../utils/lab';
import {
  Building2, FileText, Eye, AlertTriangle, Stethoscope, Plus, CalendarDays,
  MapPin, ArrowRight, CheckCircle2, FlaskConical, ClipboardList,
  Package, HardHat, Sunrise, Sun, MoonStar, Sparkles
} from 'lucide-react';

interface HomeDashboardProps {
  companies: Company[];
  records: PatientRecord[];
  currentUser: User;
  onNavigate: (tab: string) => void;
  onLoadDemo: () => void;
}

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6) return { text: 'İyi geceler', icon: MoonStar };
  if (h < 12) return { text: 'Günaydın', icon: Sunrise };
  if (h < 18) return { text: 'İyi günler', icon: Sun };
  return { text: 'İyi akşamlar', icon: MoonStar };
};

const QUOTE_STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  taslak:     { label: 'Taslak',     cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  gonderildi: { label: 'Gönderildi', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  onaylandi:  { label: 'Onaylandı',  cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  reddedildi: { label: 'Reddedildi', cls: 'bg-red-50 text-red-500 border-red-200' }
};

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ companies, records, currentUser, onNavigate, onLoadDemo }) => {
  const org = storageService.getOrgInfo();
  const { text: greet, icon: GreetIcon } = greeting();
  const today = new Date().toISOString().split('T')[0];

  const screenings = storageService.getScreenings();
  const quotes = storageService.getQuotes();
  const team = storageService.getTeam();
  const equipment = storageService.getEquipment();

  const stats = useMemo(() => ({
    companies: companies.length,
    records: records.length,
    pendingReview: records.filter(r => !r.isReviewed).length,
    anomalies: records.filter(r => Object.values(r.status).some(isAbnormalStatus)).length,
    upcoming: screenings.filter(s => s.status !== 'iptal' && s.status !== 'tamamlandi' && s.date >= today).length,
    todayOps: screenings.filter(s => s.date === today && s.status !== 'iptal').length,
    openQuotes: quotes.filter(q => q.status === 'taslak' || q.status === 'gonderildi').length,
    approvedTotal: quotes.filter(q => q.status === 'onaylandi')
      .reduce((s, q) => s + q.items.reduce((x, i) => x + i.quantity * i.unitPrice, 0), 0)
  }), [companies, records, screenings, quotes, today]);

  const upcomingScreenings = useMemo(() =>
    screenings
      .filter(s => s.status !== 'iptal' && s.status !== 'tamamlandi' && s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5),
  [screenings, today]);

  const pendingRecords = useMemo(() =>
    records.filter(r => !r.isReviewed)
      .sort((a, b) => parseTrDate(b.date) - parseTrDate(a.date))
      .slice(0, 6),
  [records]);

  const recentQuotes = useMemo(() =>
    [...quotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4),
  [quotes]);

  const hasData = companies.length > 0 || records.length > 0;

  const QUICK_ACTIONS = [
    { tab: 'dashboard', icon: Plus, label: 'Yeni Sonuç', desc: 'PDF okut & analiz et', color: 'bg-blue-50 text-blue-600' },
    { tab: 'quotes', icon: FileText, label: 'Yeni Teklif', desc: 'Fiyat teklifi hazırla', color: 'bg-indigo-50 text-indigo-600' },
    { tab: 'screenings', icon: Stethoscope, label: 'Tarama Planla', desc: 'Saha operasyonu', color: 'bg-emerald-50 text-emerald-600' },
    { tab: 'companies', icon: Building2, label: 'Firma Ekle', desc: 'Müşteri kaydı', color: 'bg-amber-50 text-amber-600' },
    { tab: 'calendar', icon: CalendarDays, label: 'Takvim', desc: 'Ajanda & randevular', color: 'bg-violet-50 text-violet-600' },
    { tab: 'config', icon: FlaskConical, label: 'Test Havuzu', desc: 'Tetkik tanımları', color: 'bg-rose-50 text-rose-500' }
  ];

  const companyName = (id: string) => companies.find(c => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">

      {/* ═══ KARŞILAMA KARTI ═══ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white p-6 sm:p-8 shadow-xl shadow-slate-200">
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-10 w-56 h-56 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 text-blue-300 text-xs font-bold uppercase tracking-widest mb-2">
              <GreetIcon size={14} /> {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {greet}, {currentUser.fullName.split(' ')[0]}
            </h1>
            <p className="text-sm text-slate-400 mt-1.5">
              {org.name} — {org.tagline || 'Mobil sağlık operasyonları tek panelde'}
            </p>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 text-xs font-bold rounded-xl hover:bg-blue-50 transition-all shadow-lg active:scale-95"
            >
              <Plus size={15} /> Yeni Sonuç
            </button>
            <button
              onClick={() => onNavigate('quotes')}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/10 border border-white/15 text-white text-xs font-bold rounded-xl hover:bg-white/20 transition-all active:scale-95 backdrop-blur"
            >
              <FileText size={15} /> Yeni Teklif
            </button>
          </div>
        </div>

        {/* Karşılama altı mini özet */}
        {hasData && (
          <div className="relative mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-semibold text-slate-300">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-emerald-400"/> {stats.records} sonuç kaydı</span>
            <span className="flex items-center gap-1.5"><Stethoscope size={12} className="text-blue-300"/> {stats.upcoming} planlanan tarama{stats.todayOps > 0 ? ` (${stats.todayOps} bugün)` : ''}</span>
            <span className="flex items-center gap-1.5"><FileText size={12} className="text-indigo-300"/> {stats.openQuotes} açık teklif</span>
            {stats.pendingReview > 0 && <span className="flex items-center gap-1.5"><Eye size={12} className="text-amber-300"/> {stats.pendingReview} inceleme bekliyor</span>}
          </div>
        )}
      </div>

      {/* ═══ İSTATİSTİK ŞERİDİ ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Firma', value: stats.companies, icon: Building2, cls: 'bg-blue-50 text-blue-600', tab: 'companies' },
          { label: 'Sonuç Kaydı', value: stats.records, icon: FileText, cls: 'bg-indigo-50 text-indigo-600', tab: 'dashboard' },
          { label: 'Bekleyen İnceleme', value: stats.pendingReview, icon: Eye, cls: 'bg-amber-50 text-amber-600', tab: 'dashboard' },
          { label: 'Planlanan Tarama', value: stats.upcoming, icon: Stethoscope, cls: 'bg-emerald-50 text-emerald-600', tab: 'screenings' },
          { label: 'Açık Teklif', value: stats.openQuotes, icon: ClipboardList, cls: 'bg-violet-50 text-violet-600', tab: 'quotes' }
        ].map(s => (
          <button
            key={s.label}
            onClick={() => onNavigate(s.tab)}
            className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 text-left hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.cls}`}><s.icon size={18}/></div>
            <div className="min-w-0">
              <p className="text-xl font-black text-slate-800 tabular-nums">{s.value}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide truncate">{s.label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ═══ HIZLI İŞLEMLER ═══ */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Sparkles size={12}/> Hızlı İşlemler</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map(a => (
            <button
              key={a.tab + a.label}
              onClick={() => onNavigate(a.tab)}
              className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 hover:-translate-y-0.5 transition-all group"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${a.color}`}>
                <a.icon size={17} />
              </div>
              <p className="text-xs font-black text-slate-800 group-hover:text-blue-700 transition-colors">{a.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{a.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ İKİ KOLON: Operasyonlar + Bekleyenler ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Yaklaşan Operasyonlar */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Stethoscope size={13}/> Yaklaşan Operasyonlar</h2>
            <button onClick={() => onNavigate('screenings')} className="text-[11px] font-bold text-blue-600 hover:text-blue-700">Tümü →</button>
          </div>
          {upcomingScreenings.length === 0 ? (
            <div className="py-10 text-center">
              <CalendarDays size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">Planlanan tarama yok</p>
              <button onClick={() => onNavigate('screenings')} className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700">Tarama Planla →</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingScreenings.map(s => {
                const isToday = s.date === today;
                const pct = s.plannedCount > 0 ? Math.round((s.completedCount / s.plannedCount) * 100) : 0;
                return (
                  <button key={s.id} onClick={() => onNavigate('screenings')} className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-blue-50/40 transition-colors text-left">
                    <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${isToday ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      <span className="text-sm font-black leading-none">{new Date(s.date).getDate()}</span>
                      <span className="text-[8px] font-bold uppercase">{new Date(s.date).toLocaleDateString('tr-TR', { month: 'short' })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{s.title}</p>
                      <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                        {companyName(s.companyId)} {s.location && <>· <MapPin size={9}/> {s.location}</>}
                      </p>
                    </div>
                    {s.status === 'devam_ediyor' && <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 shrink-0">DEVAM</span>}
                    {isToday && <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">BUGÜN</span>}
                    {s.plannedCount > 0 && <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">%{pct}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Bekleyen İncelemeler */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Eye size={13}/> Bekleyen İncelemeler</h2>
            <button onClick={() => onNavigate('dashboard')} className="text-[11px] font-bold text-blue-600 hover:text-blue-700">Sonuçlara Git →</button>
          </div>
          {pendingRecords.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 size={24} className="mx-auto text-emerald-300 mb-2" />
              <p className="text-xs text-slate-400">Tüm kayıtlar incelendi — bekleyen iş yok</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingRecords.map(r => {
                const hasAnomaly = Object.values(r.status).some(isAbnormalStatus);
                return (
                  <button key={r.id} onClick={() => onNavigate('dashboard')} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-50/40 transition-colors text-left">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0">
                      {r.patientName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{r.patientName}</p>
                      <p className="text-[10px] text-slate-400 truncate">{companyName(r.companyId)} · {r.date}</p>
                    </div>
                    {hasAnomaly && <AlertTriangle size={13} className="text-red-400 shrink-0" />}
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 shrink-0">BEKLİYOR</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ ALT ŞERİT: Son Teklifler + Kaynak Durumu ═══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Son Teklifler */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><ClipboardList size={13}/> Son Teklifler</h2>
            <button onClick={() => onNavigate('quotes')} className="text-[11px] font-bold text-blue-600 hover:text-blue-700">Tümü →</button>
          </div>
          {recentQuotes.length === 0 ? (
            <div className="py-10 text-center">
              <FileText size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs text-slate-400">Henüz teklif oluşturulmadı</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentQuotes.map(q => {
                const st = QUOTE_STATUS_LABEL[q.status] ?? QUOTE_STATUS_LABEL.taslak;
                const total = q.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
                return (
                  <button key={q.id} onClick={() => onNavigate('quotes')} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-50/40 transition-colors text-left">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{q.title || companyName(q.companyId)}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{q.quoteNumber} · {new Date(q.createdAt).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <span className="text-xs font-black text-slate-700 tabular-nums shrink-0">₺{total.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border shrink-0 ${st.cls}`}>{st.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Kaynak Durumu — ekip & ekipman özeti */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Package size={13}/> Kaynak Durumu</h2>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            <button onClick={() => onNavigate('team')} className="bg-slate-50 rounded-2xl p-4 text-left hover:bg-slate-100 transition-colors group">
              <div className="flex items-center gap-2 text-slate-400 mb-2"><HardHat size={14}/><span className="text-[10px] font-bold uppercase tracking-wide">Ekip</span></div>
              <p className="text-2xl font-black text-slate-800 tabular-nums">{team.filter(m => m.status !== 'izinli').length}<span className="text-sm font-bold text-slate-400">/{team.length}</span></p>
              <p className="text-[10px] text-slate-400 mt-0.5">aktif personel</p>
            </button>
            <button onClick={() => onNavigate('equipment')} className="bg-slate-50 rounded-2xl p-4 text-left hover:bg-slate-100 transition-colors group">
              <div className="flex items-center gap-2 text-slate-400 mb-2"><Package size={14}/><span className="text-[10px] font-bold uppercase tracking-wide">Ekipman</span></div>
              <p className="text-2xl font-black text-slate-800 tabular-nums">{equipment.filter(e => e.status === 'musait' || e.status === 'zimmetli').length}<span className="text-sm font-bold text-slate-400">/{equipment.length}</span></p>
              <p className="text-[10px] text-slate-400 mt-0.5">aktif cihaz</p>
            </button>
            <div className="col-span-2 flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-4">
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800">Onaylı teklif cirosu</p>
                <p className="text-lg font-black text-emerald-700 tabular-nums">₺{stats.approvedTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</p>
              </div>
              <button onClick={() => onNavigate('quotes')} className="text-[10px] font-bold text-emerald-700 bg-white border border-emerald-200 rounded-lg px-3 py-1.5 hover:bg-emerald-50 transition-colors shrink-0">
                Teklifler →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ BOŞ DURUM ═══ */}
      {!hasData && (
        <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-10 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Building2 size={28} className="text-blue-400"/></div>
          <h3 className="text-base font-black text-slate-800">Başlamaya hazırsın</h3>
          <p className="text-xs text-slate-400 mt-1.5 mb-5 max-w-md mx-auto">Henüz veri yok — örnek veriyle sistemi keşfedebilir veya ilk firmanı ekleyerek başlayabilirsin.</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={onLoadDemo} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95">
              <Sparkles size={14}/> Örnek Veri Yükle
            </button>
            <button onClick={() => onNavigate('companies')} className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-xl transition-colors">
              Firma Ekle
            </button>
          </div>
        </div>
      )}

      {/* İnceleme uyarı şeridi */}
      {stats.pendingReview > 0 && (
        <button
          onClick={() => onNavigate('dashboard')}
          className="w-full flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-left hover:bg-amber-100/60 transition-colors group"
        >
          <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center shrink-0"><Eye size={18}/></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-amber-800">{stats.pendingReview} sonuç hekim incelemesi bekliyor</p>
            <p className="text-[11px] text-amber-600/80">Sonuçlar sayfasından inceleyip onaylayabilirsin</p>
          </div>
          <ArrowRight size={18} className="text-amber-400 group-hover:translate-x-1 transition-transform shrink-0"/>
        </button>
      )}
    </div>
  );
};
