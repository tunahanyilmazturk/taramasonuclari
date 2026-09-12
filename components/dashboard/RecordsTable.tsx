import React, { useRef, useEffect } from 'react';
import {
  FileText, Search, AlertCircle, FileWarning, Shield, ShieldCheck, Columns,
  Maximize2, Minimize2, XCircle, CheckCircle2, Trash2, Download, X as XIcon,
  ArrowUp, ArrowDown, ArrowUpDown, AlignLeft, Eye, Briefcase, StickyNote,
  Check, Edit2, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, ChevronDown, FlaskConical
} from 'lucide-react';
import { Company, PatientRecord, ResultStatus, ExtractedResult } from '../../types';
import { ResultValue } from './ResultValue';

export interface EditingCell {
  recordId: string;
  testId: string;
}

export interface SortConfig {
  key: string | null;
  direction: 'asc' | 'desc';
}

export type FilterType = 'all' | 'risky' | 'missing';
export type ReviewFilter = 'all' | 'reviewed' | 'pending';

interface RecordsTableProps {
  selectedCompany: Company;
  displayedRecords: PatientRecord[];
  paginatedRecords: PatientRecord[];

  searchTerm: string;
  onSearchChange: (v: string) => void;
  filterType: FilterType;
  onFilterTypeChange: (v: FilterType) => void;
  reviewFilter: ReviewFilter;
  onReviewFilterChange: (v: ReviewFilter) => void;
  jobFilter: string;
  onJobFilterChange: (v: string) => void;
  availableJobs: string[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;

  hiddenColumns: Set<string>;
  onToggleColumn: (testId: string) => void;
  showColumnMenu: boolean;
  onToggleColumnMenu: () => void;
  isCompact: boolean;
  onToggleCompact: () => void;

  sortConfig: SortConfig;
  onSort: (key: string) => void;

  selectedRecordIds: Set<string>;
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectRow: (id: string) => void;
  onClearSelection: () => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;

  editingCell: EditingCell | null;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onStartEdit: (record: PatientRecord, testId: string, currentValue?: ExtractedResult) => void;
  onSaveEdit: (record: PatientRecord, testId: string) => void;
  onCancelEdit: () => void;

  onToggleReview: (id: string) => void;
  onDeleteRecord: (id: string) => void;
  onOpenRecord: (record: PatientRecord) => void;
  onClearRecords: (companyId: string) => void;
  onLoadDemo: () => void;

  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onPageChange: (page: number | ((p: number) => number)) => void;
}

export const RecordsTable: React.FC<RecordsTableProps> = ({
  selectedCompany,
  displayedRecords,
  paginatedRecords,
  searchTerm, onSearchChange,
  filterType, onFilterTypeChange,
  reviewFilter, onReviewFilterChange,
  jobFilter, onJobFilterChange,
  availableJobs,
  hasActiveFilters, onClearFilters,
  hiddenColumns, onToggleColumn,
  showColumnMenu, onToggleColumnMenu,
  isCompact, onToggleCompact,
  sortConfig, onSort,
  selectedRecordIds, onSelectAll, onSelectRow, onClearSelection, onBulkDelete, onBulkExport,
  editingCell, editValue, onEditValueChange, onStartEdit, onSaveEdit, onCancelEdit,
  onToggleReview, onDeleteRecord, onOpenRecord, onClearRecords, onLoadDemo,
  currentPage, totalPages, itemsPerPage, onPageChange
}) => {
  const visibleTests = selectedCompany.tests.filter(t => !hiddenColumns.has(t.id));

  // Üst yatay scrollbar — tablo genişken en aşağı inmeden kaydırma imkanı
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!topEl || !tableEl) return;

    // Tablo genişliğini üst scrollbar spacer'ına aktar
    const updateWidth = () => {
      if (tableRef.current) {
        const spacer = topEl.firstElementChild as HTMLElement;
        if (spacer) spacer.style.width = `${tableRef.current.scrollWidth}px`;
      }
    };
    updateWidth();

    const syncFromTable = () => { if (topEl) topEl.scrollLeft = tableEl.scrollLeft; };
    const syncFromTop = () => { if (tableEl) tableEl.scrollLeft = topEl.scrollLeft; };

    tableEl.addEventListener('scroll', syncFromTable);
    topEl.addEventListener('scroll', syncFromTop);
    window.addEventListener('resize', updateWidth);

    return () => {
      tableEl.removeEventListener('scroll', syncFromTable);
      topEl.removeEventListener('scroll', syncFromTop);
      window.removeEventListener('resize', updateWidth);
    };
  }, [paginatedRecords, visibleTests]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
      {selectedRecordIds.size > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white px-4 sm:px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 sm:gap-6 animate-in slide-in-from-bottom-4 fade-in border border-slate-700 max-w-[calc(100vw-2rem)]">
          <span className="font-bold text-xs sm:text-sm whitespace-nowrap">{selectedRecordIds.size} seçildi</span>
          <div className="h-4 w-px bg-slate-700"></div>
          <button onClick={onBulkDelete} className="text-red-400 hover:text-red-300 font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap"><Trash2 size={16} /> Sil</button>
          <button onClick={onBulkExport} className="text-emerald-400 hover:text-emerald-300 font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap"><Download size={16} /> Excel</button>
          <button onClick={onClearSelection} className="text-slate-400 hover:text-white"><XIcon size={16} /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="p-4 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full xl:w-auto">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 shrink-0"><FileText size={18} className="text-slate-400" />Sonuç Listesi</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full xl:w-auto">
                  <div className="relative flex-1 sm:flex-none"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} /><input type="text" placeholder="İsimle ara..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)} className="pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 w-full sm:w-48 transition-all shadow-sm"/></div>
                  <div className="flex bg-slate-200/50 p-1 rounded-lg shrink-0 border border-slate-200 overflow-x-auto">
                      <div className="flex border-r border-slate-300 pr-2 mr-2">
                          <button onClick={() => onFilterTypeChange('all')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${filterType === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tümü</button>
                          <button onClick={() => onFilterTypeChange('risky')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${filterType === 'risky' ? 'bg-red-50 text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><AlertCircle size={12} />Riskli</button>
                          <button onClick={() => onFilterTypeChange('missing')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${filterType === 'missing' ? 'bg-orange-50 text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><FileWarning size={12} />Kontrol</button>
                      </div>
                      <div className="flex">
                          <button onClick={() => onReviewFilterChange('all')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${reviewFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Tüm Durumlar</button>
                          <button onClick={() => onReviewFilterChange('pending')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${reviewFilter === 'pending' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Shield size={12} />Bekleyen</button>
                          <button onClick={() => onReviewFilterChange('reviewed')} className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${reviewFilter === 'reviewed' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><ShieldCheck size={12} />Onaylı</button>
                      </div>
                  </div>

                  {availableJobs.length > 0 && (
                      <div className="relative group">
                          <select value={jobFilter} onChange={(e) => onJobFilterChange(e.target.value)} className="pl-3 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-400 appearance-none min-w-[140px] cursor-pointer text-slate-600 font-bold shadow-sm">
                              <option value="all">Tüm Görevler</option>
                              {availableJobs.map(job => <option key={job} value={job}>{job}</option>)}
                          </select>
                          <ChevronDown className="absolute right-2 top-2 text-slate-400 pointer-events-none" size={14} />
                      </div>
                  )}

                  <div className="relative"><button onClick={onToggleColumnMenu} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 text-xs font-bold hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"><Columns size={14} />Görünüm</button>{showColumnMenu && (<div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"><div className="p-2 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-500">SÜTUNLARI GÖSTER/GİZLE</div><div className="max-h-60 overflow-y-auto p-1">{selectedCompany.tests.map(t => (<label key={t.id} className="flex items-center gap-2 px-2 py-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs text-slate-700 font-medium"><input type="checkbox" checked={!hiddenColumns.has(t.id)} onChange={() => onToggleColumn(t.id)} className="rounded border-slate-300 text-blue-600 focus:ring-0 w-3.5 h-3.5"/>{t.name}</label>))}</div></div>)}</div>
                  <button onClick={onToggleCompact} className={`p-2 rounded-lg transition-all ${isCompact ? 'bg-blue-100 text-blue-600' : 'bg-white border border-slate-200 text-slate-500'}`} title={isCompact ? "Normal Görünüm" : "Sıkışık Görünüm"}>
                      {isCompact ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                  {hasActiveFilters && <button onClick={onClearFilters} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors" title="Filtreleri Temizle"><XCircle size={18} /></button>}
              </div>
          </div>
          <div className="flex items-center gap-3"><span className="text-xs text-slate-400 hidden xl:inline-block font-medium bg-slate-100 px-2 py-1 rounded-md">{displayedRecords.length} sonuç</span><button onClick={() => onClearRecords(selectedCompany.id)} className="text-xs text-slate-500 hover:text-red-600 font-medium px-2 py-1 rounded hover:bg-slate-100 transition-colors">Listeyi Temizle</button></div>
      </div>

      {/* Üst yatay scrollbar */}
      {paginatedRecords.length > 0 && (
        <div
          ref={topScrollRef}
          className="overflow-x-auto overflow-y-hidden border-b border-slate-200 bg-slate-50"
          style={{ height: '14px' }}
        >
          <div style={{ height: '1px' }} />
        </div>
      )}

      <div ref={tableScrollRef} className="overflow-auto max-h-[70vh] min-h-[300px]">
          {paginatedRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      {filterType === 'risky' ? <CheckCircle2 size={32} className="text-emerald-500"/> : filterType === 'missing' ? <FileWarning size={32} className="text-orange-500"/> : reviewFilter !== 'all' ? <ShieldCheck size={32} className="text-blue-500"/> : <Search size={32} className="opacity-40"/>}
                  </div>
                  <p className="text-sm font-medium">Kriterlere uygun kayıt bulunamadı.</p>

                  {hasActiveFilters ? (
                      <button onClick={onClearFilters} className="mt-4 text-blue-600 text-xs font-bold hover:underline">Filtreleri Temizle</button>
                  ) : (
                      <button
                          onClick={onLoadDemo}
                          className="mt-6 flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-100"
                      >
                          <FlaskConical size={14} />
                          Örnek Veri Yükle
                      </button>
                  )}
              </div>
          ) : (
          <table ref={tableRef} className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50/80 backdrop-blur-sm text-slate-500 font-semibold border-b border-slate-200 sticky top-0 z-20">
              <tr>
              <th className={`px-3 ${isCompact ? 'py-2' : 'py-4'} w-10 text-center`}><input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white" onChange={onSelectAll} checked={selectedRecordIds.size === displayedRecords.length && displayedRecords.length > 0}/></th>
              <th className={`px-2 ${isCompact ? 'py-2' : 'py-4'} w-14 text-center text-xs text-slate-400 font-bold uppercase tracking-wider`}>Onay</th>
              <th className={`px-2 ${isCompact ? 'py-2' : 'py-4'} w-10`}></th>
              <th className={`px-6 ${isCompact ? 'py-2' : 'py-4'} min-w-[220px] sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors group text-xs uppercase tracking-wider`} onClick={() => onSort('patientName')}><div className="flex items-center gap-1">Hasta Bilgisi {sortConfig.key === 'patientName' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600"/> : <ArrowDown size={14} className="text-blue-600"/>) : <ArrowUpDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-100"/>}</div></th>
              {visibleTests.map(test => (<th key={test.id} className={`px-4 ${isCompact ? 'py-2' : 'py-4'} min-w-[150px] text-center border-r border-slate-100 last:border-0 cursor-pointer hover:bg-slate-100 transition-colors group`} onClick={() => onSort(test.id)}><div className="flex flex-col items-center relative gap-0.5"><div className="flex items-center gap-1 justify-center w-full"><span className="flex items-center gap-1 font-bold text-slate-600 text-xs uppercase tracking-wide truncate max-w-[140px]">{test.name}</span>{sortConfig.key === test.id ? (sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-blue-600"/> : <ArrowDown size={12} className="text-blue-600"/>) : <ArrowUpDown size={12} className="text-slate-300 opacity-0 group-hover:opacity-100"/>}</div>{test.type === 'text' && <AlignLeft size={10} className="text-slate-400"/>}{test.subTests ? (<span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">PANEL</span>) : test.type !== 'text' ? (<span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 rounded-full">({test.range?.min} - {test.range?.max} {test.unit})</span>) : (<span className="text-[10px] text-slate-400 font-medium">({test.unit})</span>)}</div></th>))}
              </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
              {paginatedRecords.map((record) => {
              const isSelected = selectedRecordIds.has(record.id);
              return (
              <tr key={record.id} className={`transition-all group ${isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'} ${record.isReviewed ? 'opacity-70 bg-emerald-50/20' : ''}`}>
                  <td className={`px-3 ${isCompact ? 'py-2' : 'py-4'} text-center`}><input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4 bg-white" checked={isSelected} onChange={() => onSelectRow(record.id)}/></td>
                  <td className={`px-2 ${isCompact ? 'py-2' : 'py-4'} text-center relative`}>
                      <button
                          onClick={() => onToggleReview(record.id)}
                          className={`p-1.5 rounded-lg transition-all ${record.isReviewed ? 'text-emerald-600 bg-emerald-100 hover:bg-emerald-200' : 'text-slate-300 bg-slate-100 hover:bg-slate-200 hover:text-slate-500'}`}
                          title={record.isReviewed ? "Onayı Kaldır" : "Onayla"}
                      >
                          {record.isReviewed ? <ShieldCheck size={18} /> : <Shield size={18} />}
                      </button>
                  </td>
                  <td className={`px-2 ${isCompact ? 'py-2' : 'py-4'} text-center relative`}>
                      <div className="flex flex-col gap-1 items-center">
                          <button onClick={() => onOpenRecord(record)} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors p-1.5" title="Detaylı İncele"><Eye size={16} /></button>
                          <button onClick={(e) => { e.stopPropagation(); onDeleteRecord(record.id); }} className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all p-1.5" title="Kaydı Sil"><Trash2 size={16} /></button>
                          {record.doctorNotes && <div className="text-blue-500 p-1" title="Doktor Notu Var"><StickyNote size={14} /></div>}
                      </div>
                  </td>
                  <td className={`px-6 ${isCompact ? 'py-2' : 'py-4'} sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100 transition-colors ${isSelected ? 'bg-blue-50' : record.isReviewed ? 'bg-white/80 group-hover:bg-slate-50' : 'bg-white group-hover:bg-slate-50'}`}>
                      <div className={`font-bold text-sm cursor-pointer hover:text-blue-600 transition-colors ${record.isReviewed ? 'text-slate-500' : 'text-slate-800'}`} onClick={() => onOpenRecord(record)}>{record.patientName}</div>
                      {record.jobTitle && record.jobTitle !== "Belirtilmemiş" && <div className={`text-[11px] font-bold text-blue-600 ${isCompact ? 'mt-0.5 inline-block ml-2' : 'mt-1 flex'} items-center gap-1 bg-blue-50 w-fit px-1.5 py-0.5 rounded`}><Briefcase size={10}/> {record.jobTitle}</div>}
                      <div className={`text-[11px] text-slate-400 flex items-center gap-1 ${isCompact ? 'mt-0.5' : 'mt-1.5'}`}><span className={`font-mono bg-slate-100 px-1.5 py-0.5 rounded ${!record.registrationNumber || record.registrationNumber === '-' ? 'text-red-500 bg-red-50' : 'text-slate-500'}`}>{(!record.registrationNumber || record.registrationNumber === '-') ? 'Sicil No Yok' : record.registrationNumber}</span><span className="text-slate-300">•</span><span>{record.date}</span></div>
                  </td>
                  {visibleTests.map(test => {
                  const res = record.results[test.id];
                  const status = record.status[test.id];
                  const isEditing = editingCell?.recordId === record.id && editingCell?.testId === test.id;
                  let cellClass = `text-center px-4 ${isCompact ? 'py-2' : 'py-4'} border-r border-slate-100 last:border-0 cursor-pointer relative transition-colors `;
                  if (status === ResultStatus.HIGH) cellClass += "bg-red-50/40 ";
                  if (status === ResultStatus.LOW) cellClass += "bg-orange-50/40 ";
                  if (status === ResultStatus.UNKNOWN) cellClass += "bg-yellow-50/40 ";
                  if (isEditing) { return (<td key={`${record.id}-${test.id}`} className="px-2 py-2 text-center bg-blue-50 z-20 relative border-r border-blue-100"><div className="flex items-center justify-center gap-1"><input autoFocus type={test.type === 'text' || test.subTests ? "text" : "number"} className={`text-center text-sm border-blue-400 rounded focus:ring-1 focus:ring-blue-500 py-1 px-1 bg-white text-slate-900 ${test.type === 'text' || test.subTests ? 'w-48' : 'w-20'}`} value={editValue} onChange={(e) => onEditValueChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSaveEdit(record, test.id); if (e.key === 'Escape') onCancelEdit(); }} onClick={(e) => e.stopPropagation()}/><button onClick={(e) => { e.stopPropagation(); onSaveEdit(record, test.id); }} className="text-blue-600 hover:text-blue-800"><Check size={16} /></button></div></td>); }
                  return <td key={`${record.id}-${test.id}`} className={cellClass} onClick={() => onStartEdit(record, test.id, res)} title="Düzenlemek için tıklayın"><ResultValue test={test} res={res} status={status} isReviewed={record.isReviewed} /><div className="absolute top-1 right-1 opacity-0 hover:opacity-100 pointer-events-none transition-opacity"><Edit2 size={12} className="text-blue-400" /></div></td>; })}
              </tr>
              );})}
          </tbody>
          </table>
          )}
      </div>
      {displayedRecords.length > itemsPerPage && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs text-slate-500 font-medium">
                  {displayedRecords.length} kayıttan {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, displayedRecords.length)} arası gösteriliyor
              </span>
              <div className="flex items-center gap-2">
                  <button
                      onClick={() => onPageChange(1)}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:shadow-none transition-all text-slate-500"
                  >
                      <ChevronsLeft size={16} />
                  </button>
                  <button
                      onClick={() => onPageChange(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:shadow-none transition-all text-slate-500"
                  >
                      <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-slate-700 mx-2 bg-white px-2 py-1 rounded border border-slate-200">
                      {currentPage} / {totalPages}
                  </span>
                  <button
                      onClick={() => onPageChange(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:shadow-none transition-all text-slate-500"
                  >
                      <ChevronRight size={16} />
                  </button>
                  <button
                      onClick={() => onPageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 rounded-lg border border-slate-300 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:hover:shadow-none transition-all text-slate-500"
                  >
                      <ChevronsRight size={16} />
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
