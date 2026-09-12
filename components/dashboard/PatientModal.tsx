import React, { useState, useMemo, useEffect } from 'react';
import {
  Activity, FileText, Stethoscope, UserCircle, CheckCircle2, Shield,
  X as XIcon, Save, Edit2, Loader2, Printer, History, AlignLeft,
  AlertTriangle, ChevronLeft, ChevronRight, FileWarning, Sparkles, RefreshCw
} from 'lucide-react';
import { Company, PatientRecord, ResultStatus, TestDefinition } from '../../types';
import { generateMedicalSummary } from '../../services/geminiService';
import { storageService, DEFAULT_REPORT_SETTINGS } from '../../services/storageService';
import { calculateStatus, flattenTests, parseTrDate, isAbnormalStatus } from '../../utils/lab';
import { TrendChart } from './charts';
import { Modal, modalPanel } from '../Modal';
import type { PatientScore } from './dashboardTypes';

interface PatientModalProps {
  record: PatientRecord;
  company: Company;
  /** Geçmiş karşılaştırma ve prev/next gezinme için görüntülenen kayıt listesi */
  orderedRecords: PatientRecord[];
  onUpdateRecord: (record: PatientRecord) => void;
  onToggleReview: (id: string) => void;
  onNavigate: (record: PatientRecord) => void;
  onClose: () => void;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  record,
  company,
  orderedRecords,
  onUpdateRecord,
  onToggleReview,
  onNavigate,
  onClose
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [doctorNotes, setDoctorNotes] = useState(record.doctorNotes || '');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiComment, setAiComment] = useState<string>('');
  const [modalMode, setModalMode] = useState<'results' | 'history' | 'ai'>('results');

  // Rapor antet/imza: global ayarlar temel, firma bazlı ayarlar (varsa) geçersiz kılar
  const reportSettings = useMemo(() => ({
      ...DEFAULT_REPORT_SETTINGS,
      ...storageService.getReportSettings(),
      ...company.reportSettings
  }), [company.reportSettings]);

  // Kurum kimliği — rapor anteti
  const org = useMemo(() => storageService.getOrgInfo(), []);

  const patientScore: PatientScore = useMemo(() => {
    let totalTests = 0;
    let anomalies = 0;

    const countTests = (tests: TestDefinition[]) => {
        tests.forEach(t => {
            if (t.subTests) {
                countTests(t.subTests);
            } else {
                 if(record.results[t.id]) {
                     totalTests++;
                     const s = record.status[t.id];
                     if (isAbnormalStatus(s)) anomalies++;
                 }
            }
        });
    };
    countTests(company.tests);

    if (totalTests === 0) return { score: 100, label: 'Veri Yok', color: 'text-slate-400', anomalies: 0 };

    // Orantısal skor: normal testlerin oranı
    const normalPct = Math.round(((totalTests - anomalies) / totalTests) * 100);

    let label = 'Mükemmel';
    let color = 'text-emerald-500';

    if (normalPct < 50) { label = 'Yüksek Risk'; color = 'text-red-600'; }
    else if (normalPct < 75) { label = 'Dikkat Gerektirir'; color = 'text-orange-500'; }
    else if (normalPct < 95) { label = 'İyi'; color = 'text-blue-500'; }

    return { score: normalPct, label, color, anomalies };
  }, [record, company]);

  const patientHistory = useMemo(() => {
      const matches = orderedRecords.filter(r => {
          const isSameReg = record.registrationNumber && record.registrationNumber !== '-' &&
                           r.registrationNumber === record.registrationNumber;
          const isSameName = r.patientName.toLowerCase() === record.patientName.toLowerCase();
          return isSameReg || isSameName;
      });

      return matches.sort((a, b) => parseTrDate(a.date) - parseTrDate(b.date));
  }, [record, orderedRecords]);

  // Anormal bulgular ve eksik testler
  const { abnormalFindings, missingTests } = useMemo(() => {
      const abnormal: { name: string; value: string; unit: string; status: ResultStatus }[] = [];
      const missing: string[] = [];
      const flat = flattenTests(company.tests);

      flat.forEach(t => {
          const res = record.results[t.id];
          const status = record.status[t.id];
          if (!res || res.value === undefined || String(res.value).trim() === '' || String(res.value) === '-') {
              missing.push(t.name);
          } else if (isAbnormalStatus(status)) {
              abnormal.push({ name: t.name, value: String(res.value), unit: t.unit, status: status });
          }
      });
      return { abnormalFindings: abnormal, missingTests: missing };
  }, [record, company]);

  // Kayıt gezinme
  const recordIndex = orderedRecords.findIndex(r => r.id === record.id);
  const prevRecord = recordIndex > 0 ? orderedRecords[recordIndex - 1] : null;
  const nextRecord = recordIndex < orderedRecords.length - 1 ? orderedRecords[recordIndex + 1] : null;

  // Keyboard navigation
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
          const idx = orderedRecords.findIndex(r => r.id === record.id);
          if (e.key === 'ArrowLeft' && idx > 0) onNavigate(orderedRecords[idx - 1]);
          if (e.key === 'ArrowRight' && idx < orderedRecords.length - 1) onNavigate(orderedRecords[idx + 1]);
          if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [record.id, orderedRecords, onNavigate, onClose]);

  const handleGenerateAiComment = async () => {
      setIsGeneratingSummary(true);
      try {
          const summary = await generateMedicalSummary(record);
          setAiComment(summary);
      } catch {
          setAiComment('Yorum oluşturulamadı. Lütfen tekrar deneyin.');
      } finally {
          setIsGeneratingSummary(false);
      }
  };

  const handlePrint = () => {
      window.print();
  };

  const handleSave = () => {
      const updatedRecord: PatientRecord = { ...record, results: { ...record.results }, status: { ...record.status }, doctorNotes };
      const flatTests = flattenTests(company.tests);

      Object.entries(editValues).forEach(([testId, rawVal]) => {
          const targetDef = flatTests.find(t => t.id === testId);
          if (targetDef) {
             let finalValue: string | number = rawVal;
             if (targetDef.type === 'numeric') { finalValue = parseFloat(rawVal); }

             if (typeof finalValue === 'number' && isNaN(finalValue)) {
                 finalValue = rawVal;
             }

             const isEmptyString = typeof finalValue === 'string' && finalValue.trim() === '';
             if (!isEmptyString) {
                 updatedRecord.results[testId] = { testName: targetDef.name, value: finalValue, unit: targetDef.unit };
                 updatedRecord.status[testId] = calculateStatus(finalValue, targetDef.range, targetDef.type, targetDef.key);
             }
          }
      });
      onUpdateRecord(updatedRecord);
      setIsEditing(false);
      setEditValues({});
  };

  const startEditing = () => {
      const initialValues: Record<string, string> = {};
      Object.entries(record.results).forEach(([key, res]) => { initialValues[key] = res.value.toString(); });
      setEditValues(initialValues);
      setIsEditing(true);
  };

  return (
    <Modal open={true} onClose={onClose} overlayClassName="p-0 sm:p-4" closeOnBackdrop={false}>
       <div className={`${modalPanel} rounded-none sm:rounded-3xl w-full max-w-6xl h-full sm:h-[92vh] md:h-[85vh] flex flex-col overflow-hidden`} id="printable-content">
           {/* YAZDIRMA GÖRÜNÜMÜ */}
           <div className="hidden print:block p-8 h-full bg-white relative">
               <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center text-white"><Activity size={32} /></div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{org.name}</h1>
                            <p className="text-sm text-slate-500 font-semibold tracking-wide">{reportSettings.title || "SAĞLIK TARAMASI RAPORU"}</p>
                            <p className="text-xs text-slate-400 mt-1">{[org.taxOffice && `${org.taxOffice} V.D.`, org.taxNumber && `V.N: ${org.taxNumber}`, org.phone && `Tel: ${org.phone}`].filter(Boolean).join(' | ') || org.tagline}</p>
                        </div>
                    </div>
                    <div className="text-right">
                         <div className="bg-slate-100 px-3 py-1 rounded inline-block mb-1"><p className="text-[10px] font-bold text-slate-500 uppercase">PROTOKOL NO</p><p className="text-sm font-mono font-bold text-slate-900">{record.id.substring(0,8)}</p></div>
                         <p className="text-xs text-slate-500">Rapor Tarihi: {new Date().toLocaleDateString('tr-TR')}</p>
                    </div>
               </div>
               <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
                    <div><p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Firma Adı</p><p className="text-base font-bold text-slate-900">{company.name}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Hasta Adı Soyadı</p><p className="text-xl font-bold text-slate-900">{record.patientName}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Sicil / ID No</p><p className="text-sm font-bold text-slate-800">{record.registrationNumber || '-'}</p></div>
                    <div><p className="text-[10px] font-bold text-slate-500 uppercase mb-0.5">Görevi</p><p className="text-sm font-bold text-slate-800">{record.jobTitle || '-'}</p></div>
               </div>
               <div className="space-y-4">
                   <h3 className="font-bold text-slate-900 border-b border-slate-300 pb-1 mb-2 text-sm uppercase flex items-center gap-2"><FileText size={14}/> Tetkik Sonuçları</h3>
                   <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                       {company.tests.map(test => {
                           const res = record.results[test.id];
                           const status = record.status[test.id];
                           const isPanel = test.subTests && test.subTests.length > 0;
                           const isText = test.type === 'text' || test.key.includes('kulturu') || test.key.includes('goz');
                           const colSpan = (isPanel || isText) ? "col-span-2" : "col-span-1";
                           if (isPanel) {
                               return (
                                   <div key={test.id} className={`${colSpan} mb-4 break-inside-avoid`}>
                                       <div className="flex items-center justify-between bg-slate-100 px-2 py-1 border-l-4 border-slate-500 mb-1"><span className="font-bold text-sm text-slate-800">{test.name}</span><span className="text-[10px] font-bold text-slate-500">{test.subTests?.length} Parametre</span></div>
                                       <div className="grid grid-cols-3 gap-x-4 gap-y-1 pl-2">
                                           {test.subTests?.map(sub => {
                                               const subRes = record.results[sub.id];
                                               const subStatus = record.status[sub.id];
                                               const isAbnormal = isAbnormalStatus(subStatus);
                                               return (
                                                   <div key={sub.id} className="flex justify-between items-baseline border-b border-slate-200 border-dashed pb-0.5"><span className="text-xs text-slate-600">{sub.name}</span><div className="text-right"><span className={`text-xs font-bold ${isAbnormal ? 'text-black underline decoration-red-500 decoration-2' : 'text-slate-900'}`}>{subRes ? subRes.value : '-'}</span><span className="text-[8px] text-slate-400 ml-1 w-6 inline-block text-left">{sub.unit}</span></div></div>
                                               );
                                           })}
                                       </div>
                                   </div>
                               )
                           }
                           return (
                               <div key={test.id} className={`${colSpan} flex justify-between items-end border-b border-slate-200 pb-1 break-inside-avoid`}><span className="text-sm font-medium text-slate-700">{test.name}</span><div className="flex items-baseline gap-2">{status === ResultStatus.HIGH && <span className="text-[9px] font-bold px-1 border border-black rounded-sm">YÜKSEK</span>}{status === ResultStatus.LOW && <span className="text-[9px] font-bold px-1 border border-black rounded-sm">DÜŞÜK</span>}<span className={`text-sm font-bold ${status !== ResultStatus.NORMAL && status !== ResultStatus.UNKNOWN ? 'text-black underline' : 'text-slate-900'}`}>{res ? res.value : '-'}</span><span className="text-xs text-slate-500 w-8">{test.unit}</span></div></div>
                           );
                       })}
                   </div>
               </div>
               {record.doctorNotes && (<div className="mt-8 border border-slate-300 rounded-lg p-4 bg-slate-50 break-inside-avoid"><h4 className="font-bold text-slate-900 text-sm mb-2 uppercase flex items-center gap-2"><Stethoscope size={16}/> Doktor Kanaat ve Sonuç</h4><p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{record.doctorNotes}</p></div>)}
               <div className="flex justify-between items-end mt-12 pt-8 border-t-2 border-slate-800 break-inside-avoid">
                    <div className="w-1/3"><p className="text-[10px] text-slate-500 mb-6">* Bu rapor elektronik ortamda doğrulanmıştır.<br/>* Referans aralıkları laboratuvar kitlerine göre değişebilir.</p></div>
                    <div className="flex gap-12">
                        <div className="text-center"><p className="text-xs font-bold text-slate-900">{reportSettings.labTechName || "İsimsiz"}</p><p className="text-[10px] text-slate-500 mb-8">{reportSettings.labTechTitle || "Laboratuvar Sorumlusu"}</p><div className="h-px w-32 bg-slate-400"></div><p className="text-[10px] text-slate-500 mt-1">İmza / Kaşe</p></div>
                        <div className="text-center"><p className="text-xs font-bold text-slate-900">{reportSettings.doctorName || "İsimsiz"}</p><p className="text-[10px] text-slate-500 mb-8">{reportSettings.doctorTitle || "İşyeri Hekimi"}</p><div className="h-px w-32 bg-slate-400"></div><p className="text-[10px] text-slate-500 mt-1">İmza / Kaşe</p></div>
                    </div>
               </div>
           </div>

           {/* EKRAN GÖRÜNÜMÜ */}
           <div className="flex flex-col md:flex-row h-full print:hidden">

               {/* MOBİL: Kompakt hasta başlığı */}
               <div className="md:hidden bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0">
                   <div className="relative w-11 h-11 rounded-full bg-white p-0.5 shadow-sm shrink-0">
                       <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center text-slate-400">
                           <UserCircle size={28} className="opacity-50"/>
                       </div>
                       <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${patientScore.score >= 85 ? 'bg-emerald-500' : patientScore.score >= 60 ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                   </div>
                   <div className="flex-1 min-w-0">
                       <h2 className="text-base font-bold text-slate-900 truncate">{record.patientName}</h2>
                       <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500">
                           <span className="truncate">{record.jobTitle || 'Pozisyon Belirtilmemiş'}</span>
                           <span className="text-slate-300">•</span>
                           <span className="font-mono whitespace-nowrap">{record.date}</span>
                       </div>
                   </div>
                   <div className="flex flex-col items-end gap-1 shrink-0">
                       <span className={`text-sm font-black ${patientScore.color}`}>{patientScore.score}<span className="text-[8px] text-slate-400 font-bold">/100</span></span>
                       <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${record.isReviewed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                           {record.isReviewed ? 'Onaylı' : 'Bekliyor'}
                       </span>
                   </div>
                   <button onClick={onClose} className="p-1.5 -mr-1 bg-slate-200/70 hover:bg-slate-300 rounded-full text-slate-500 shrink-0 transition-colors"><XIcon size={16}/></button>
               </div>

               {/* DESKTOP: Sol panel */}
               <div className="hidden md:flex w-1/3 bg-slate-50 border-r border-slate-200 flex-col p-6 overflow-y-auto">
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="w-24 h-24 rounded-full bg-white p-1 shadow-md mb-4 relative">
                            <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-100 to-slate-100 flex items-center justify-center text-slate-400">
                                <UserCircle size={64} className="opacity-50"/>
                            </div>
                            <div className={`absolute bottom-0 right-0 w-6 h-6 rounded-full border-2 border-white ${patientScore.score >= 85 ? 'bg-emerald-500' : patientScore.score >= 60 ? 'bg-orange-500' : 'bg-red-500'}`}></div>
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">{record.patientName}</h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">{record.jobTitle || 'Pozisyon Belirtilmemiş'}</p>
                        <div className="flex gap-2 mt-3">
                            <span className="text-xs font-bold bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-600">{record.registrationNumber || 'ID Yok'}</span>
                            <span className="text-xs font-bold bg-white border border-slate-200 px-2 py-1 rounded-md text-slate-600">{record.date}</span>
                        </div>
                        <div className={`mt-4 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${record.isReviewed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                            {record.isReviewed ? <CheckCircle2 size={14}/> : <Shield size={14}/>}
                            {record.isReviewed ? 'ONAYLANDI' : 'BEKLEMEDE'}
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-blue-500"></div>
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">Genel Sağlık Skoru</h3>

                        {/* Skor göstergesi */}
                        <div className="flex items-center gap-5 mb-4">
                            <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
                                    <circle cx="48" cy="48" r="40" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                                    <circle
                                        cx="48" cy="48" r="40"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        className={`${patientScore.color} transition-all duration-1000 ease-out`}
                                        strokeDasharray={`${2 * Math.PI * 40}`}
                                        strokeDashoffset={`${2 * Math.PI * 40 * (1 - patientScore.score / 100)}`}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className={`text-2xl font-black ${patientScore.color}`}>{patientScore.score}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">/100</span>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-lg font-black ${patientScore.color} leading-tight`}>{patientScore.label}</p>
                                <p className="text-xs text-slate-500 mt-1">{patientScore.anomalies > 0 ? `${patientScore.anomalies} riskli bulgu` : "Tüm değerler normal"}</p>
                            </div>
                        </div>

                        {/* Dağılım barı */}
                        {(() => {
                            const flat = flattenTests(company.tests);
                            let normal = 0, abnormal = 0, missing = 0;
                            flat.forEach(t => {
                                const res = record.results[t.id];
                                const s = record.status[t.id];
                                if (!res || String(res.value).trim() === '' || String(res.value) === '-') missing++;
                                else if (isAbnormalStatus(s)) abnormal++;
                                else normal++;
                            });
                            const total = normal + abnormal + missing;
                            if (total === 0) return null;
                            const nPct = (normal / total) * 100;
                            const aPct = (abnormal / total) * 100;
                            const mPct = (missing / total) * 100;
                            return (
                                <div>
                                    <div className="flex gap-3 mb-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                            <span className="text-[10px] font-bold text-slate-600">{normal} Normal</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                                            <span className="text-[10px] font-bold text-slate-600">{abnormal} Anormal</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                                            <span className="text-[10px] font-bold text-slate-600">{missing} Eksik</span>
                                        </div>
                                    </div>
                                    <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100">
                                        <div className="bg-emerald-500 transition-all duration-500" style={{ width: `${nPct}%` }} />
                                        <div className="bg-red-500 transition-all duration-500" style={{ width: `${aPct}%` }} />
                                        <div className="bg-slate-300 transition-all duration-500" style={{ width: `${mPct}%` }} />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                    <div className="space-y-2 mt-auto">
                        {!isEditing && (
                            <button
                                onClick={() => onToggleReview(record.id)}
                                className={`w-full py-3 rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 ${record.isReviewed ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'}`}
                            >
                                {record.isReviewed ? (
                                    <>
                                        <XIcon size={18}/>
                                        ONAYI KALDIR
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={18}/>
                                        ONAYLA
                                    </>
                                )}
                            </button>
                        )}
                        {isEditing ? (
                            <button
                                onClick={handleSave}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold transition-all shadow-md shadow-blue-200 hover:bg-blue-700 active:scale-95 flex items-center justify-center gap-2"
                            >
                                <Save size={18}/> KAYDET
                            </button>
                        ) : (
                            <button
                                onClick={startEditing}
                                className="w-full py-3 bg-white border-2 border-slate-100 text-slate-600 hover:text-blue-600 hover:border-blue-200 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                            >
                                <Edit2 size={18}/> DÜZENLE
                            </button>
                        )}
                         {!isEditing && (
                            <button
                                onClick={() => { setModalMode('ai'); if (!aiComment) handleGenerateAiComment(); }}
                                className="w-full py-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border border-indigo-100"
                            >
                                <Sparkles size={18}/>
                                AI YORUMU
                            </button>
                         )}
                         <button
                            onClick={handlePrint}
                            className="w-full py-3 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200 mt-2"
                         >
                             <Printer size={18}/> YAZDIR / PDF
                         </button>
                    </div>
               </div>
               <div className="flex-1 bg-white p-4 md:p-6 overflow-y-auto relative min-h-0">
                   <button onClick={onClose} className="absolute top-3 right-3 md:top-4 md:right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors text-slate-500 hover:text-red-500 z-10"><XIcon size={20}/></button>

                   {/* Kayıt gezinme */}
                   <div className="flex items-center justify-between mb-4">
                       <button
                           onClick={() => prevRecord && onNavigate(prevRecord)}
                           disabled={!prevRecord}
                           className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                       >
                           <ChevronLeft size={14}/> Önceki
                       </button>
                       <span className="text-xs text-slate-400 font-medium">{recordIndex + 1} / {orderedRecords.length}</span>
                       <button
                           onClick={() => nextRecord && onNavigate(nextRecord)}
                           disabled={!nextRecord}
                           className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                       >
                           Sonraki <ChevronRight size={14}/>
                       </button>
                   </div>

                   <div className="flex items-center gap-1.5 md:gap-2 mb-6 border-b border-slate-100 pb-2 overflow-x-auto scrollbar-none">
                       <button
                           onClick={() => setModalMode('results')}
                           className={`px-3 md:px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 md:gap-2 whitespace-nowrap shrink-0 ${modalMode === 'results' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                       >
                           <FileText size={15}/> Sonuçlar
                       </button>
                       <button
                           onClick={() => { setModalMode('ai'); if (!aiComment) handleGenerateAiComment(); }}
                           className={`px-3 md:px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 md:gap-2 whitespace-nowrap shrink-0 ${modalMode === 'ai' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                       >
                           <Sparkles size={15}/> AI Yorumu
                       </button>
                       {patientHistory.length > 1 && (
                           <button
                               onClick={() => setModalMode('history')}
                               className={`px-3 md:px-4 py-2 text-xs md:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 md:gap-2 whitespace-nowrap shrink-0 ${modalMode === 'history' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                           >
                               <History size={15}/> Geçmiş ({patientHistory.length})
                           </button>
                       )}
                   </div>
                   <div className="pb-20">
                       {modalMode === 'results' ? (
                           <div className="grid grid-cols-1 gap-6">

                               {/* ANORMAL BULGU ÖZETİ */}
                               {abnormalFindings.length > 0 && (
                                   <div className="bg-red-50/50 border border-red-200 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
                                       <div className="flex items-center gap-2 mb-3">
                                           <AlertTriangle size={16} className="text-red-500" />
                                           <h4 className="font-bold text-sm text-red-700">Anormal Bulgular ({abnormalFindings.length})</h4>
                                       </div>
                                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                           {abnormalFindings.map((f, i) => (
                                               <div key={i} className="flex items-center justify-between bg-white/80 rounded-lg px-3 py-2 border border-red-100">
                                                   <span className="text-xs font-medium text-slate-700">{f.name}</span>
                                                   <div className="flex items-center gap-2">
                                                       <span className={`text-xs font-bold ${f.status === ResultStatus.HIGH ? 'text-red-600' : 'text-orange-600'}`}>
                                                           {f.value} {f.unit}
                                                       </span>
                                                       <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${f.status === ResultStatus.HIGH ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                           {f.status === ResultStatus.HIGH ? 'Yüksek' : 'Düşük'}
                                                       </span>
                                                   </div>
                                               </div>
                                           ))}
                                       </div>
                                   </div>
                               )}

                               {/* EKSİK TESTLER */}
                               {missingTests.length > 0 && (
                                   <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4">
                                       <div className="flex items-center gap-2 mb-2">
                                           <FileWarning size={14} className="text-slate-400" />
                                           <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wide">Veri Yok ({missingTests.length})</h4>
                                       </div>
                                       <div className="flex flex-wrap gap-1.5">
                                           {missingTests.map((name, i) => (
                                               <span key={i} className="text-[10px] bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md">{name}</span>
                                           ))}
                                       </div>
                                   </div>
                               )}

                               {company.tests.map(test => {
                                   const isPanel = test.subTests && test.subTests.length > 0;
                                   if (isPanel) {
                                       return (
                                           <div key={test.id} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                               <div className="bg-slate-100/50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                                                       <h4 className="font-bold text-slate-700">{test.name}</h4>
                                                       <span className="text-xs font-bold bg-white px-2 py-1 rounded border border-slate-200 text-slate-500">{test.subTests?.length} Parametre</span>
                                               </div>
                                               <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                   {test.subTests?.map(sub => {
                                                       const res = record.results[sub.id];
                                                       const status = record.status[sub.id];
                                                       const val = isEditing ? editValues[sub.id] : res?.value;

                                                       return (
                                                           <div key={sub.id} className="flex flex-col gap-1">
                                                               <label className="text-xs font-bold text-slate-500 uppercase">{sub.name}</label>
                                                               {isEditing ? (
                                                                   <input
                                                                      type="text"
                                                                      className="border border-slate-300 rounded-lg px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 w-full"
                                                                      value={editValues[sub.id] || ''}
                                                                      onChange={(e) => setEditValues({...editValues, [sub.id]: e.target.value})}
                                                                   />
                                                               ) : (
                                                                   <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                                                       <span className={`font-bold ${status === ResultStatus.HIGH ? 'text-red-600' : status === ResultStatus.LOW ? 'text-orange-600' : 'text-slate-800'}`}>{val || '-'}</span>
                                                                       <span className="text-[10px] text-slate-400">{sub.unit}</span>
                                                                   </div>
                                                               )}
                                                           </div>
                                                       );
                                                   })}
                                               </div>
                                           </div>
                                       )
                                   }
                                   const res = record.results[test.id];
                                   const status = record.status[test.id];
                                   const val = isEditing ? editValues[test.id] : res?.value;

                                   return (
                                       <div key={test.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-colors">
                                           <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 ${status === ResultStatus.HIGH ? 'bg-red-500' : status === ResultStatus.LOW ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                               {test.type === 'text' ? <AlignLeft size={20}/> : <Activity size={20}/>}
                                           </div>
                                           <div className="flex-1">
                                               <h4 className="font-bold text-slate-700">{test.name}</h4>
                                               <div className="flex gap-2 text-xs text-slate-400 mt-0.5">
                                                   <span>{test.unit || 'Birim Yok'}</span>
                                                   {test.range && <span>• Ref: {test.range.min}-{test.range.max}</span>}
                                               </div>
                                           </div>
                                           <div className="w-1/3">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 w-full font-bold text-slate-800"
                                                        value={editValues[test.id] || ''}
                                                        onChange={(e) => setEditValues({...editValues, [test.id]: e.target.value})}
                                                    />
                                                ) : (
                                                    <div className="text-right">
                                                        <p className={`text-lg font-black ${status === ResultStatus.HIGH ? 'text-red-600' : status === ResultStatus.LOW ? 'text-orange-600' : 'text-slate-800'}`}>{val || '-'}</p>
                                                        {isAbnormalStatus(status) && (
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${status === ResultStatus.HIGH ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                                {status === ResultStatus.HIGH ? 'Yüksek' : 'Düşük'}
                                                            </span>
                                                        )}
                                                        {/* Referans aralığı göstergesi */}
                                                        {test.range && typeof res?.value === 'number' && (() => {
                                                            const rangeSpan = test.range!.max - test.range!.min;
                                                            const numVal = res!.value as number;
                                                            const pct = Math.max(0, Math.min(100, ((numVal - test.range!.min) / rangeSpan) * 100));
                                                            return (
                                                                <div className="mt-1.5">
                                                                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden relative">
                                                                        <div className="absolute inset-y-0 left-0 bg-emerald-400/40 rounded-full" style={{ width: '100%' }} />
                                                                        <div
                                                                            className={`absolute inset-y-0 rounded-full ${status === ResultStatus.NORMAL ? 'bg-blue-500' : status === ResultStatus.HIGH ? 'bg-red-500' : 'bg-orange-500'}`}
                                                                            style={{ left: `${Math.max(0, pct - 2)}%`, width: '4px', height: '100%' }}
                                                                        />
                                                                    </div>
                                                                    <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                                                                        <span>{test.range!.min}</span>
                                                                        <span>{test.range!.max}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                           </div>
                                       </div>
                                   );
                               })}
                               <div className="mt-4">
                                   <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Stethoscope size={16}/> Hekim Kanaati</h4>
                                   {isEditing ? (
                                       <textarea
                                           className="w-full h-32 border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 text-sm"
                                           value={doctorNotes}
                                           onChange={(e) => setDoctorNotes(e.target.value)}
                                           placeholder="Hekim notu giriniz..."
                                       />
                                   ) : (
                                       <div className="bg-yellow-50/50 border border-yellow-100 rounded-xl p-4 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                                           {record.doctorNotes || "Hekim notu girilmemiş."}
                                       </div>
                                   )}
                               </div>
                           </div>
                       ) : modalMode === 'ai' ? (
                           /* AI YORUMU SEKMESİ */
                           <div className="space-y-6">
                               <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-2">
                                       <Sparkles size={18} className="text-indigo-500" />
                                       <h3 className="font-bold text-lg text-slate-800">AI Tıbbi Yorum</h3>
                                   </div>
                                   <button
                                       onClick={handleGenerateAiComment}
                                       disabled={isGeneratingSummary}
                                       className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all border border-indigo-100 disabled:opacity-50"
                                   >
                                       {isGeneratingSummary ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                       {isGeneratingSummary ? 'Oluşturuluyor...' : 'Yeniden Oluştur'}
                                   </button>
                               </div>

                               {isGeneratingSummary && !aiComment ? (
                                   <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                       <Loader2 size={32} className="animate-spin mb-4" />
                                       <p className="text-sm font-medium">AI yorumu oluşturuluyor...</p>
                                       <p className="text-xs mt-1">Bu işlem birkaç saniye sürebilir</p>
                                   </div>
                               ) : aiComment ? (
                                   <div className="space-y-4">
                                       <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6">
                                           <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{aiComment}</p>
                                       </div>
                                       <div className="flex items-center gap-2 text-xs text-slate-400">
                                           <Shield size={12} />
                                           <span>Bu yorum otomatik oluşturulmuştur. Nihai karar hekime aittir.</span>
                                       </div>
                                       <button
                                           onClick={() => { setDoctorNotes(prev => prev ? `${prev}\n\n[AI]: ${aiComment}` : `[AI]: ${aiComment}`); setModalMode('results'); }}
                                           className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold transition-all hover:bg-indigo-700 flex items-center justify-center gap-2"
                                       >
                                           <Save size={16} /> Hekim Kanaati'ne Ekle
                                       </button>
                                   </div>
                               ) : (
                                   <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                       <Sparkles size={48} className="opacity-20 mb-4" />
                                       <p className="text-sm font-medium">Henüz AI yorumu oluşturulmadı.</p>
                                       <p className="text-xs mt-1">Yukarıdaki butona tıklayarak yorum oluşturun.</p>
                                   </div>
                               )}
                           </div>
                       ) : (
                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                               {company.tests.map(test => {
                                    const flatTests = test.subTests || [test];
                                    return flatTests.filter(t => t.type === 'numeric').map(t => {
                                        const history = patientHistory.map(h => ({
                                            date: h.date,
                                            value: typeof h.results[t.id]?.value === 'number' ? h.results[t.id]?.value as number : 0
                                        })).filter(h => h.value > 0);

                                        if (history.length < 2) return null;

                                        return (
                                            <div key={t.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="text-sm font-bold text-slate-700">{t.name}</h4>
                                                    <span className="text-[10px] bg-white border border-slate-200 px-1.5 rounded text-slate-400">{t.unit}</span>
                                                </div>
                                                <TrendChart
                                                    history={history}
                                                    min={t.range?.min || 0}
                                                    max={t.range?.max || 100}
                                                    unit={t.unit}
                                                />
                                            </div>
                                        );
                                    });
                               })}
                               {company.tests.every(test => {
                                    const flat = test.subTests || [test];
                                    return flat.filter(t => t.type === 'numeric').every(t => {
                                        const history = patientHistory.map(h => ({ value: typeof h.results[t.id]?.value === 'number' ? h.results[t.id]?.value : 0 })).filter(h => (h.value as number) > 0);
                                        return history.length < 2;
                                    });
                               }) && (
                                   <div className="col-span-3 flex flex-col items-center justify-center py-20 text-slate-400">
                                       <History size={48} className="opacity-20 mb-2"/>
                                       <p className="text-sm">Trend analizi için yeterli sayısal veri bulunamadı.</p>
                                   </div>
                               )}
                           </div>
                       )}
                   </div>
               </div>

               {/* MOBİL: Alt aksiyon çubuğu */}
               <div className="md:hidden border-t border-slate-200 bg-white p-3 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
                   {isEditing ? (
                       <button
                           onClick={handleSave}
                           className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-95"
                       >
                           <Save size={15}/> Kaydet
                       </button>
                   ) : (
                       <>
                           <button
                               onClick={() => onToggleReview(record.id)}
                               className={`flex-1 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-95 ${record.isReviewed ? 'bg-slate-100 text-slate-500' : 'bg-emerald-600 text-white'}`}
                           >
                               {record.isReviewed ? <><XIcon size={15}/> Onayı Kaldır</> : <><CheckCircle2 size={15}/> Onayla</>}
                           </button>
                           <button
                               onClick={startEditing}
                               className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-95"
                           >
                               <Edit2 size={15}/> Düzenle
                           </button>
                           <button
                               onClick={() => { setModalMode('ai'); if (!aiComment) handleGenerateAiComment(); }}
                               className="flex-1 py-2.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl font-bold text-xs whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-95"
                           >
                               <Sparkles size={15}/> AI Yorumu
                           </button>
                       </>
                   )}
                   <button
                       onClick={handlePrint}
                       className="py-2.5 px-4 bg-slate-800 text-white rounded-xl font-bold text-xs whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-95"
                   >
                       <Printer size={15}/> Yazdır
                   </button>
               </div>
           </div>
       </div>
    </Modal>
  );
};
