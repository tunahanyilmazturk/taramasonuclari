import React, { useState, useMemo } from 'react';
import { Screening, ScreeningStatus, Company } from '../../types';
import { storageService } from '../../services/storageService';
import { Modal, modalPanel } from '../Modal';
import {
  CalendarDays, ChevronLeft, ChevronRight, Plus, MapPin, Users,
  Building2, Clock, X, LayoutGrid, List, Search, FlaskConical,
  Stethoscope, AlertCircle
} from 'lucide-react';

const STATUS_META: Record<ScreeningStatus, {
  label: string; badge: string; dot: string; bar: string; solid: string;
  chipBg: string; chipText: string; chipBorder: string; leftBar: string;
}> = {
  planlandi:    {
    label: 'Planlandı',    badge: 'bg-blue-50 text-blue-600 border-blue-100',
    dot: 'bg-blue-500',   bar: 'bg-blue-500',   solid: 'bg-blue-500',
    chipBg: 'bg-blue-50',  chipText: 'text-blue-700',  chipBorder: 'border-blue-200',  leftBar: 'border-l-blue-500'
  },
  devam_ediyor: {
    label: 'Devam Ediyor', badge: 'bg-amber-50 text-amber-600 border-amber-200',
    dot: 'bg-amber-500',  bar: 'bg-amber-500',  solid: 'bg-amber-500',
    chipBg: 'bg-amber-50', chipText: 'text-amber-700', chipBorder: 'border-amber-200', leftBar: 'border-l-amber-500'
  },
  tamamlandi:   {
    label: 'Tamamlandı',   badge: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    dot: 'bg-emerald-500', bar: 'bg-emerald-500', solid: 'bg-emerald-500',
    chipBg: 'bg-emerald-50', chipText: 'text-emerald-700', chipBorder: 'border-emerald-200', leftBar: 'border-l-emerald-500'
  },
  iptal:        {
    label: 'İptal',        badge: 'bg-red-50 text-red-600 border-red-200',
    dot: 'bg-red-500',  bar: 'bg-red-500',  solid: 'bg-red-500',
    chipBg: 'bg-red-50', chipText: 'text-red-700', chipBorder: 'border-red-200', leftBar: 'border-l-red-500'
  }
};

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

interface CalendarProps {
  companies: Company[];
  onGoToDashboard?: () => void;
  onNavigate?: (route: string) => void;
}

export const Calendar: React.FC<CalendarProps> = ({ companies, onNavigate }) => {
  const [screenings] = useState<Screening[]>(() => storageService.getScreenings());
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ScreeningStatus>('all');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailScreening, setDetailScreening] = useState<Screening | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = new Date().toISOString().slice(0, 10);

  // Taramaları filtrele
  const filteredScreenings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return screenings.filter(s => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (companyFilter !== 'all' && s.companyId !== companyFilter) return false;
      if (q) {
        const comp = companies.find(c => c.id === s.companyId);
        return s.title.toLowerCase().includes(q) || comp?.name.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [screenings, statusFilter, companyFilter, searchTerm, companies]);

  // Taramaları tarihe göre grupla
  const screeningsByDate = useMemo(() => {
    const map = new Map<string, Screening[]>();
    filteredScreenings.forEach(s => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
      if (s.endDate && s.endDate !== s.date) {
        const start = new Date(s.date);
        const end = new Date(s.endDate);
        const cur = new Date(start);
        cur.setDate(cur.getDate() + 1);
        while (cur <= end) {
          const d = cur.toISOString().slice(0, 10);
          if (!map.has(d)) map.set(d, []);
          if (!map.get(d)!.some(x => x.id === s.id)) map.get(d)!.push(s);
          cur.setDate(cur.getDate() + 1);
        }
      }
    });
    return map;
  }, [filteredScreenings]);

  // Yaklaşan taramalar
  const upcoming = useMemo(() => {
    return filteredScreenings
      .filter(s => s.date >= todayStr && s.status !== 'iptal')
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 6);
  }, [filteredScreenings, todayStr]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(todayStr); };

  const companyOf = (id: string) => companies.find(c => c.id === id);

  // ── Aylık görünüm hücreleri ──
  const firstDay = new Date(year, month, 1);
  const firstDayWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthCells: (number | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) monthCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) monthCells.push(d);
  while (monthCells.length % 7 !== 0) monthCells.push(null);

  // ── Haftalık görünüm ──
  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    const weekday = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - weekday);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const selectedScreenings = selectedDate ? (screeningsByDate.get(selectedDate) ?? []) : [];
  const dateStrOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

  // Bir günün durum özeti (ilk taramanın durumu)
  const dayStatusColor = (dateStr: string): string | null => {
    const dayScreenings = screeningsByDate.get(dateStr);
    if (!dayScreenings || dayScreenings.length === 0) return null;
    // Öncelik: devam_ediyor > planlandi > tamamlandi > iptal
    if (dayScreenings.some(s => s.status === 'devam_ediyor')) return STATUS_META.devam_ediyor.solid;
    if (dayScreenings.some(s => s.status === 'planlandi')) return STATUS_META.planlandi.solid;
    if (dayScreenings.some(s => s.status === 'tamamlandi')) return STATUS_META.tamamlandi.solid;
    return STATUS_META.iptal.solid;
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">

      {/* ── Başlık ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <CalendarDays size={20} />
            </div>
            Takvim
          </h1>
          <p className="text-xs text-slate-500 mt-1 ml-12">Tarama programlarını takvim görünümünde takip edin</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setViewMode('month')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Aylık Görünüm"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="Haftalık Görünüm"
            >
              <List size={16} />
            </button>
          </div>
          <button
            onClick={goToday}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 hover:border-indigo-200 rounded-lg transition-all shadow-sm"
          >
            Bugün
          </button>
          {onNavigate && (
            <button
              onClick={() => onNavigate('screenings/new')}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-indigo-200 active:scale-95 shrink-0"
            >
              <Plus size={16} /> Tarama Planla
            </button>
          )}
        </div>
      </div>

      {/* ── Filtre çubuğu ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Tarama, firma veya konum ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all shadow-sm"
          />
        </div>
        <select
          value={companyFilter}
          onChange={(e) => setCompanyFilter(e.target.value)}
          className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 text-slate-600 shadow-sm cursor-pointer"
        >
          <option value="all">Tüm Firmalar</option>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto scrollbar-none shadow-sm">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >Tümü</button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Takvim (2/3) ── */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Ay/Hafta navigasyonu — gradient header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-800">
                {viewMode === 'month'
                  ? `${MONTH_NAMES[month]} ${year}`
                  : `${weekDays[0].getDate()} ${MONTH_NAMES[weekDays[0].getMonth()]} – ${weekDays[6].getDate()} ${MONTH_NAMES[weekDays[6].getMonth()]} ${weekDays[6].getFullYear()}`
                }
              </h2>
              {viewMode === 'month' && (() => {
                const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
                const count = filteredScreenings.filter(s => s.date.startsWith(monthPrefix)).length;
                return count > 0 && <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">{count} tarama</span>;
              })()}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={viewMode === 'month' ? prevMonth : prevWeek} className="p-2 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm text-slate-500 hover:text-indigo-600 transition-all">
                <ChevronLeft size={16} />
              </button>
              <button onClick={viewMode === 'month' ? nextMonth : nextWeek} className="p-2 rounded-lg border border-slate-200 hover:bg-white hover:shadow-sm text-slate-500 hover:text-indigo-600 transition-all">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Gün başlıkları */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
            {DAY_NAMES.map((d, i) => (
              <div key={d} className={`text-center text-[10px] font-bold uppercase py-2.5 tracking-wider ${i >= 5 ? 'text-slate-500' : 'text-slate-400'}`}>{d}</div>
            ))}
          </div>

          {/* Takvim grid — Aylık */}
          {viewMode === 'month' && (
            <div className="grid grid-cols-7">
              {monthCells.map((day, i) => {
                const weekend = i % 7 >= 5;
                if (day === null) return <div key={i} className={`min-h-[96px] border-r border-b border-slate-50 ${weekend ? 'bg-slate-50/40' : 'bg-slate-50/20'}`} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayScreenings = screeningsByDate.get(dateStr) ?? [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const statusColor = dayStatusColor(dateStr);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[96px] p-1.5 border-r border-b border-slate-50 text-left align-top transition-all relative group ${
                      isSelected
                        ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400 shadow-inner'
                        : isToday
                        ? 'bg-gradient-to-br from-indigo-50/60 to-blue-50/40'
                        : weekend
                        ? 'bg-slate-50/40 hover:bg-slate-100/60'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    {/* Gün numarası — bugün dolu daire */}
                    <div className="flex items-center justify-between mb-1">
                      {isToday ? (
                        <span className="flex items-center justify-center w-6 h-6 text-xs font-black text-white bg-indigo-600 rounded-full shadow-sm">
                          {day}
                        </span>
                      ) : (
                        <span className={`text-xs font-bold ${weekend ? 'text-slate-500' : 'text-slate-600'} ${dayScreenings.length > 0 ? 'group-hover:text-indigo-600' : ''} transition-colors`}>
                          {day}
                        </span>
                      )}
                      {/* Durum noktası */}
                      {statusColor && !isToday && (
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                      )}
                    </div>

                    {/* Tarama çipleri — sol renk çubuğu vurgusu */}
                    <div className="mt-0.5 space-y-0.5">
                      {dayScreenings.slice(0, 3).map(s => {
                        const meta = STATUS_META[s.status];
                        return (
                          <div
                            key={s.id}
                            onClick={(e) => { e.stopPropagation(); setDetailScreening(s); }}
                            className={`flex items-center gap-1 text-[9px] font-semibold px-1 py-0.5 rounded ${meta.chipBg} ${meta.chipText} ${meta.chipBorder} border-l-2 ${meta.leftBar} truncate cursor-pointer hover:scale-[1.03] hover:shadow-sm transition-all`}
                          >
                            <span className="truncate">{s.title}</span>
                          </div>
                        );
                      })}
                      {dayScreenings.length > 3 && (
                        <p className="text-[9px] font-bold text-slate-400 px-1">+{dayScreenings.length - 3} daha</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Takvim grid — Haftalık */}
          {viewMode === 'week' && (
            <div className="grid grid-cols-7">
              {weekDays.map((d, i) => {
                const dateStr = dateStrOf(d);
                const dayScreenings = screeningsByDate.get(dateStr) ?? [];
                const isToday = dateStr === todayStr;
                const isSelected = dateStr === selectedDate;
                const weekend = isWeekend(d);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[300px] p-2 border-r border-b border-slate-50 text-left align-top transition-all relative ${
                      isSelected
                        ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400 shadow-inner'
                        : isToday
                        ? 'bg-gradient-to-br from-indigo-50/60 to-blue-50/40'
                        : weekend
                        ? 'bg-slate-50/40 hover:bg-slate-100/60'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {isToday ? (
                          <span className="flex items-center justify-center w-7 h-7 text-sm font-black text-white bg-indigo-600 rounded-full shadow-sm">
                            {d.getDate()}
                          </span>
                        ) : (
                          <span className={`text-sm font-black ${weekend ? 'text-slate-500' : 'text-slate-700'}`}>{d.getDate()}</span>
                        )}
                        <span className={`text-[10px] font-bold ${weekend ? 'text-slate-400' : 'text-slate-400'}`}>{DAY_NAMES[i]}</span>
                      </div>
                      {dayScreenings.length > 0 && (
                        <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{dayScreenings.length}</span>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {dayScreenings.map(s => {
                        const meta = STATUS_META[s.status];
                        const comp = companyOf(s.companyId);
                        return (
                          <div
                            key={s.id}
                            onClick={(e) => { e.stopPropagation(); setDetailScreening(s); }}
                            className={`p-1.5 rounded-lg ${meta.chipBg} ${meta.chipText} ${meta.chipBorder} border-l-2 ${meta.leftBar} cursor-pointer hover:scale-[1.03] hover:shadow-sm transition-all`}
                          >
                            <div className="flex items-center gap-1 mb-0.5">
                              <span className="text-[10px] font-bold truncate flex-1">{s.title}</span>
                            </div>
                            <p className="text-[9px] opacity-70 truncate">{comp?.name || 'Firma silinmiş'}</p>
                          </div>
                        );
                      })}
                      {dayScreenings.length === 0 && <p className="text-[10px] text-slate-300 italic text-center pt-2">Tarama yok</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Durum lejantı */}
          <div className="flex items-center justify-center gap-4 p-3 border-t border-slate-100 bg-slate-50/50 flex-wrap">
            {(Object.keys(STATUS_META) as ScreeningStatus[]).map(st => (
              <div key={st} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[st].solid}`} />
                <span className="text-[10px] font-bold text-slate-500">{STATUS_META[st].label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Sağ panel: Seçili gün + Yaklaşan (1/3) ── */}
        <div className="space-y-4">
          {/* Seçili gün detayı */}
          {selectedDate && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    {new Date(selectedDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {selectedScreenings.length > 0 ? `${selectedScreenings.length} tarama planlandı` : 'Tarama yok'}
                  </p>
                </div>
                <button onClick={() => setSelectedDate(null)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  <X size={14} />
                </button>
              </div>
              <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                {selectedScreenings.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">Bu güne planlanmış tarama yok</p>
                ) : selectedScreenings.map(s => {
                  const company = companyOf(s.companyId);
                  const meta = STATUS_META[s.status];
                  return (
                    <button
                      key={s.id}
                      onClick={() => setDetailScreening(s)}
                      className={`w-full text-left p-3 rounded-xl border border-slate-100 ${meta.chipBorder} border-l-2 ${meta.leftBar} hover:shadow-md hover:-translate-y-0.5 transition-all group bg-white`}
                    >
                      <div className="flex items-start gap-2 mb-1.5">
                        <h4 className="text-xs font-bold text-slate-800 flex-1 group-hover:text-indigo-600">{s.title}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.badge}`}>{meta.label}</span>
                      </div>
                      <div className="space-y-1 text-[11px] text-slate-500">
                        <p className="flex items-center gap-1.5"><Building2 size={10} className="shrink-0" /> {company?.name || 'Firma silinmiş'}</p>
                        <p className="flex items-center gap-1.5"><MapPin size={10} className="shrink-0" /> {s.location || 'Konum yok'}</p>
                        <p className="flex items-center gap-1.5"><Users size={10} className="shrink-0" /> {s.completedCount}/{s.plannedCount} kişi</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Yaklaşan taramalar */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/30">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <div className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center">
                  <Clock size={14} />
                </div>
                Yaklaşan Taramalar
              </h3>
            </div>
            <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
              {upcoming.length === 0 ? (
                <p className="text-xs text-slate-400 italic text-center py-6">Yaklaşan tarama yok</p>
              ) : upcoming.map(s => {
                const company = companyOf(s.companyId);
                const meta = STATUS_META[s.status];
                const daysUntil = Math.ceil((new Date(s.date).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      const d = new Date(s.date);
                      setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1));
                      setSelectedDate(s.date);
                    }}
                    className={`w-full text-left p-3 rounded-xl border border-slate-100 ${meta.chipBorder} border-l-2 ${meta.leftBar} hover:shadow-md hover:-translate-y-0.5 transition-all group bg-white`}
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${meta.chipBg} ${meta.chipText}`}>
                        <span className="text-sm font-black leading-none">{new Date(s.date).getDate()}</span>
                        <span className="text-[8px] font-bold uppercase">{new Date(s.date).toLocaleDateString('tr-TR', { month: 'short' })}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600">{s.title}</h4>
                        <p className="text-[10px] text-slate-400 truncate">{company?.name || 'Firma silinmiş'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 ml-13">
                      {daysUntil === 0 ? (
                        <span className="text-indigo-600 font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Bugün
                        </span>
                      ) : daysUntil === 1 ? (
                        <span className="text-amber-600 font-bold">Yarın</span>
                      ) : (
                        <span className="font-semibold">{daysUntil} gün sonra</span>
                      )}
                      <span className="flex items-center gap-1"><MapPin size={9} /> {s.location || 'Konum yok'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Boş durum — seçili gün yokken ipucu */}
          {!selectedDate && upcoming.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={20} className="text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-600 mb-1">Takvim boş</p>
              <p className="text-[11px] text-slate-400">Bir tarihe tıklayın veya tarama planlayın</p>
            </div>
          )}
        </div>
      </div>

      {/* ═══ TARAMA DETAY MODALI ═══ */}
      <Modal open={detailScreening !== null} onClose={() => setDetailScreening(null)} overlayClassName="p-2 sm:p-4">
        {detailScreening && (() => {
          const company = companyOf(detailScreening.companyId);
          const meta = STATUS_META[detailScreening.status];
          const pct = detailScreening.plannedCount > 0 ? Math.min(100, Math.round((detailScreening.completedCount / detailScreening.plannedCount) * 100)) : 0;
          return (
            <div className={`${modalPanel} rounded-3xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden`}>
              {/* Header — gradient */}
              <div className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-gradient-to-r ${meta.chipBg} to-white`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.solid} text-white shadow-sm`}>
                    <Stethoscope size={18}/>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate">{detailScreening.title}</h3>
                    <p className="text-[11px] text-slate-500">Tarama Detayı</p>
                  </div>
                </div>
                <button onClick={() => setDetailScreening(null)} className="p-2 hover:bg-white/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors shrink-0"><X size={18}/></button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Durum + tarih */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 ${meta.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                    <CalendarDays size={12} /> {new Date(detailScreening.date).toLocaleDateString('tr-TR')}
                    {detailScreening.endDate && ` → ${new Date(detailScreening.endDate).toLocaleDateString('tr-TR')}`}
                  </span>
                </div>

                {/* Firma */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Firma</p>
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-slate-400 shrink-0" />
                    <p className="text-sm font-bold text-slate-800">{company?.name || 'Firma silinmiş'}</p>
                  </div>
                </div>

                {/* Konum + kişi */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Konum</p>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-400 shrink-0" />
                      <p className="text-xs font-semibold text-slate-700">{detailScreening.location || 'Belirtilmemiş'}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Kişi Sayısı</p>
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-slate-400 shrink-0" />
                      <p className="text-xs font-semibold text-slate-700">{detailScreening.completedCount}/{detailScreening.plannedCount} tamamlandı</p>
                    </div>
                  </div>
                </div>

                {/* İlerleme */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1.5">
                    <span>İlerleme</span><span className="tabular-nums">%{pct}</span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-indigo-400 to-indigo-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Testler */}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <FlaskConical size={12} /> Testler ({detailScreening.testIds.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {detailScreening.testIds.map(id => {
                      const test = companies.flatMap(c => c.tests).find(t => t.id === id);
                      return test ? (
                        <span key={id} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-600">{test.name}</span>
                      ) : null;
                    })}
                    {detailScreening.testIds.length === 0 && <p className="text-xs text-slate-400 italic">Test yok</p>}
                  </div>
                </div>

                {/* Notlar */}
                {detailScreening.notes && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Notlar</p>
                    <p className="text-xs text-slate-600 bg-amber-50/50 border border-amber-100 rounded-xl p-3">{detailScreening.notes}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button onClick={() => setDetailScreening(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200/60 rounded-xl transition-colors">Kapat</button>
                {onNavigate && (
                  <button
                    onClick={() => { setDetailScreening(null); onNavigate('screenings'); }}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-200"
                  >
                    <Stethoscope size={14}/> Taramaya Git
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};
