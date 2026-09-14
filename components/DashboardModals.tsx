import React, { useRef, useState } from 'react';
import { 
  Sparkles, 
  UploadCloud, 
  UserPlus, 
  Trash2, 
  AlertTriangle, 
  X as XIcon, 
  CheckCircle2, 
  AlertCircle, 
  User as UserCircle, 
  Activity, 
  Plus,
  FileUp,
  Loader2
} from 'lucide-react';
import { Company } from '../types';
import { Modal, modalPanel } from './Modal';
import { extractTextFromPdf } from '../services/pdfService';
import { analyzeMedicalText } from '../services/geminiService';

interface DashboardModalsProps {
  isNewOperationModalOpen: boolean;
  setIsNewOperationModalOpen: (open: boolean) => void;
  newOpClearFirst: boolean;
  setNewOpClearFirst: (clear: boolean) => void;
  handleStartNewOperation: (mode: 'pdf' | 'manual') => void;
  isClearConfirmOpen: boolean;
  setIsClearConfirmOpen: (open: boolean) => void;
  handleConfirmClear: () => void;
  isNewManualModalOpen: boolean;
  setIsNewManualModalOpen: (open: boolean) => void;
  selectedCompany: Company | null;
  companyRecordsCount: number;
  savedCountInSession: number;
  manualForm: {
    patientName: string;
    registrationNumber: string;
    jobTitle: string;
    date: string;
    doctorNotes: string;
    values: Record<string, string>;
  };
  setManualForm: React.Dispatch<React.SetStateAction<{
    patientName: string;
    registrationNumber: string;
    jobTitle: string;
    date: string;
    doctorNotes: string;
    values: Record<string, string>;
  }>>;
  manualFormError: string | null;
  manualNameInputRef: React.RefObject<HTMLInputElement | null>;
  handleSaveManualPatient: (keepOpenForNext?: boolean) => void;
}

export const DashboardModals: React.FC<DashboardModalsProps> = ({
  isNewOperationModalOpen,
  setIsNewOperationModalOpen,
  newOpClearFirst,
  setNewOpClearFirst,
  handleStartNewOperation,
  isClearConfirmOpen,
  setIsClearConfirmOpen,
  handleConfirmClear,
  isNewManualModalOpen,
  setIsNewManualModalOpen,
  selectedCompany,
  companyRecordsCount,
  savedCountInSession,
  manualForm,
  setManualForm,
  manualFormError,
  manualNameInputRef,
  handleSaveManualPatient
}) => {
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [extractionReport, setExtractionReport] = useState<{
    foundCount: number;
    totalTests: number;
    missingTests: string[];
    ek2Details?: import('../types').Ek2Details;
  } | null>(null);

  // PDF'den otomatik form doldurma
  const handlePdfAutoFill = async (file: File) => {
    if (!selectedCompany) return;
    setIsPdfProcessing(true);
    setPdfStatus('idle');
    setExtractionReport(null);
    try {
      const text = await extractTextFromPdf(file);
      const result = await analyzeMedicalText(text, selectedCompany.tests);

      const newValues: Record<string, string> = { ...manualForm.values };
      result.extractedResults.forEach(r => {
        const allTests = selectedCompany.tests.flatMap(t => t.subTests || [t]);
        const testDef = allTests.find(t => t.name === r.testName);
        if (testDef) {
          newValues[testDef.id] = String(r.value);
        }
      });

      setManualForm({
        ...manualForm,
        patientName: result.patientName || manualForm.patientName,
        registrationNumber: result.registrationNumber || manualForm.registrationNumber,
        jobTitle: result.jobTitle || manualForm.jobTitle,
        date: result.date || manualForm.date,
        values: newValues
      });
      setPdfStatus('success');
      setExtractionReport({
        foundCount: result.foundCount,
        totalTests: result.totalTests,
        missingTests: result.missingTests,
        ek2Details: result.ek2Details
      });
    } catch (e) {
      console.error('PDF auto-fill error:', e);
      setPdfStatus('error');
    } finally {
      setIsPdfProcessing(false);
    }
  };

  if (!selectedCompany) return null;

  return (
    <>
      {/* 1. YENİ İŞLEM BAŞLAT MODALI */}
      <Modal open={isNewOperationModalOpen} onClose={() => setIsNewOperationModalOpen(false)}>
          <div className={`${modalPanel} rounded-3xl w-full max-w-lg overflow-hidden`}>
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-200">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Yeni İşlem Başlat</h3>
                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{selectedCompany.name}</span> için işlem seçin
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsNewOperationModalOpen(false)} 
                className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-100 rounded-2xl">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-700">Mevcut Kayıt Durumu:</span>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-100 shadow-xs">
                  {companyRecordsCount} Kayıt
                </span>
              </div>

              {companyRecordsCount > 0 && (
                <label className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={newOpClearFirst}
                    onChange={(e) => setNewOpClearFirst(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 block">Önceki taramayı temizle ve sıfırdan başla</span>
                    <span className="text-slate-400 block mt-0.5">Bu firmanın mevcut {companyRecordsCount} kaydı silinerek yeni işleme geçilir.</span>
                  </div>
                </label>
              )}

              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleStartNewOperation('pdf')}
                  className="w-full p-4 bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-blue-400 rounded-2xl flex items-center gap-4 transition-all group text-left shadow-xs hover:shadow-md cursor-pointer"
                >
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <UploadCloud size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">Toplu PDF Taraması Başlat</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Laboratuvar sonuç PDF'lerini seçin, yapay zeka otomatik analiz etsin.</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleStartNewOperation('manual')}
                  className="w-full p-4 bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-400 rounded-2xl flex items-center gap-4 transition-all group text-left shadow-xs hover:shadow-md cursor-pointer"
                >
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                    <UserPlus size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">Yeni Manuel Hasta & Tetkik Girişi</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Hasta adı, sicil no ve test parametrelerini form üzerinden elle kaydedin.</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsNewOperationModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Vazgeç
              </button>
            </div>
          </div>
      </Modal>

      {/* 2. TARAMAYI TEMİZLE ONAY MODALI */}
      <Modal open={isClearConfirmOpen} onClose={() => setIsClearConfirmOpen(false)} closeOnBackdrop={false}>
          <div className={`${modalPanel} rounded-3xl w-full max-w-md overflow-hidden`}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Tarama Listesini Temizle</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto mb-4">
                <span className="font-semibold text-slate-800">"{selectedCompany.name}"</span> firmasına ait kayıtlı <span className="font-bold text-red-600">{companyRecordsCount} hasta sonucu</span> listeden kaldırılacaktır.
              </p>
              <div className="bg-amber-50 text-amber-800 text-[11px] p-3 rounded-xl border border-amber-200 text-left font-medium">
                ⚠️ Bu işlem bu firmanın mevcut tarama kayıtlarını sıfırlar. İsterseniz temizlemeden önce sağ üstteki "Excel Raporu" butonu ile yedek alabilirsiniz.
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleConfirmClear}
                className="px-4 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-200 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Trash2 size={14} />
                Evet, Tümünü Temizle
              </button>
            </div>
          </div>
      </Modal>

      {/* 3. YENİ MANUEL HASTA & TETKİK GİRİŞİ MODALI */}
      <Modal open={isNewManualModalOpen} onClose={() => setIsNewManualModalOpen(false)} overlayClassName="p-2 sm:p-4" closeOnBackdrop={false}>
          <div className={`${modalPanel} rounded-3xl w-full max-w-3xl max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden`}>
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-xs">
                  <UserPlus size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Yeni Hasta & Tetkik Girişi</h3>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                      {selectedCompany.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">Hasta bilgilerini ve tetkik değerlerini girin</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {savedCountInSession > 0 && (
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    {savedCountInSession} hasta eklendi
                  </span>
                )}
                <button 
                  type="button"
                  onClick={() => setIsNewManualModalOpen(false)} 
                  className="p-1.5 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
                >
                  <XIcon size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {manualFormError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-1">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{manualFormError}</span>
                </div>
              )}

              {/* PDF Otomatik Doldurma */}
              <div
                onClick={() => pdfInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                  isPdfProcessing
                    ? 'border-indigo-300 bg-indigo-50/50'
                    : pdfStatus === 'success'
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : pdfStatus === 'error'
                        ? 'border-red-300 bg-red-50/50'
                        : 'border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/30'
                }`}
              >
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfAutoFill(file);
                    e.target.value = '';
                  }}
                />
                {isPdfProcessing ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 size={20} className="animate-spin text-indigo-500" />
                    <span className="text-sm font-bold text-indigo-600">PDF işleniyor, değerler dolduruluyor...</span>
                  </div>
                ) : pdfStatus === 'success' ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={20} className="text-emerald-500" />
                    <span className="text-sm font-bold text-emerald-600">Değerler başarıyla dolduruldu! Kontrol edip kaydedin.</span>
                  </div>
                ) : pdfStatus === 'error' ? (
                  <div className="flex items-center justify-center gap-2">
                    <AlertCircle size={20} className="text-red-500" />
                    <span className="text-sm font-bold text-red-600">PDF okunamadı. Tekrar deneyin.</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <FileUp size={20} className="text-indigo-500" />
                    <div>
                      <span className="text-sm font-bold text-slate-700">PDF'den Otomatik Doldur</span>
                      <p className="text-[11px] text-slate-400 mt-0.5">Laboratuvar PDF'i seçin, test değerleri otomatik doldurulsun</p>
                    </div>
                  </div>
                )}
              </div>

              {/* PDF Çıkarım Raporu — hangi testler bulundu/bulunamadı */}
              {extractionReport && pdfStatus === 'success' && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 space-y-2 animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold text-blue-700">
                      {extractionReport.foundCount}/{extractionReport.totalTests} test başarıyla okundu
                    </span>
                    {extractionReport.foundCount === extractionReport.totalTests && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">TAM</span>
                    )}
                  </div>
                  {extractionReport.missingTests.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-slate-500 self-center mr-1">Bulunamayan:</span>
                      {extractionReport.missingTests.slice(0, 8).map(t => (
                        <span key={t} className="text-[10px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                          {t}
                        </span>
                      ))}
                      {extractionReport.missingTests.length > 8 && (
                        <span className="text-[10px] text-slate-400">+{extractionReport.missingTests.length - 8} daha</span>
                      )}
                    </div>
                  )}
                  {/* Ek-2 Belgesi — çıkarılan hasta bilgileri */}
                  {extractionReport.ek2Details && (
                    <div className="mt-2 pt-2 border-t border-blue-100 space-y-1.5">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-wide">Ek-2 Belgesi — Hasta Kartı</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {extractionReport.ek2Details.name && (
                          <p className="text-[11px] text-slate-700"><span className="text-slate-400">Ad:</span> {extractionReport.ek2Details.name}</p>
                        )}
                        {extractionReport.ek2Details.birthInfo && (
                          <p className="text-[11px] text-slate-700"><span className="text-slate-400">Doğum:</span> {extractionReport.ek2Details.birthInfo}</p>
                        )}
                        {extractionReport.ek2Details.gender && (
                          <p className="text-[11px] text-slate-700"><span className="text-slate-400">Cinsiyet:</span> {extractionReport.ek2Details.gender}</p>
                        )}
                        {extractionReport.ek2Details.phone && (
                          <p className="text-[11px] text-slate-700"><span className="text-slate-400">Tel:</span> {extractionReport.ek2Details.phone}</p>
                        )}
                        {extractionReport.ek2Details.job && (
                          <p className="text-[11px] text-slate-700"><span className="text-slate-400">İş:</span> {extractionReport.ek2Details.job}</p>
                        )}
                        {extractionReport.ek2Details.bloodType && (
                          <p className="text-[11px] text-slate-700"><span className="text-slate-400">Kan:</span> {extractionReport.ek2Details.bloodType}</p>
                        )}
                        {(extractionReport.ek2Details.height || extractionReport.ek2Details.weight || extractionReport.ek2Details.bmi) && (
                          <p className="text-[11px] text-slate-700 col-span-2">
                            <span className="text-slate-400">Fizik:</span>{' '}
                            {[
                              extractionReport.ek2Details.height && `Boy: ${extractionReport.ek2Details.height} cm`,
                              extractionReport.ek2Details.weight && `Kilo: ${extractionReport.ek2Details.weight} kg`,
                              extractionReport.ek2Details.bmi && `VKİ: ${extractionReport.ek2Details.bmi}`
                            ].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {extractionReport.ek2Details.conclusion && (
                          <p className="text-[11px] text-slate-700 col-span-2 italic border-l-2 border-emerald-300 pl-2">
                            {extractionReport.ek2Details.conclusion}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Hasta Bilgileri Bölümü */}
              <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <UserCircle size={15} className="text-slate-400" /> Hasta & Çalışan Bilgileri
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Hasta Adı Soyadı <span className="text-red-500">*</span>
                    </label>
                    <input 
                      ref={manualNameInputRef}
                      type="text" 
                      placeholder="Örn: Ahmet Yılmaz" 
                      value={manualForm.patientName} 
                      onChange={(e) => setManualForm({ ...manualForm, patientName: e.target.value })}
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      TC Kimlik / Protokol / Sicil No
                    </label>
                    <input 
                      type="text" 
                      placeholder="Örn: 12345678901" 
                      value={manualForm.registrationNumber} 
                      onChange={(e) => setManualForm({ ...manualForm, registrationNumber: e.target.value })}
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Görevi / Departmanı
                    </label>
                    <input 
                      type="text" 
                      placeholder="Örn: Kaynakçı / Üretim" 
                      value={manualForm.jobTitle} 
                      onChange={(e) => setManualForm({ ...manualForm, jobTitle: e.target.value })}
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Muayene / Sonuç Tarihi
                    </label>
                    <input 
                      type="date" 
                      value={manualForm.date} 
                      onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                      className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Firma Tetkik Değerleri Bölümü */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Activity size={15} className="text-slate-400" /> Tetkik Parametreleri ({selectedCompany.tests.length} Test)
                  </h4>
                  <span className="text-[11px] text-slate-400">Gereken değerleri doldurun, boş bırakılanlar rapora eklenmez</span>
                </div>

                <div className="space-y-4">
                  {selectedCompany.tests.map(test => {
                    const isPanel = test.subTests && test.subTests.length > 0;
                    if (isPanel) {
                      return (
                        <div key={test.id} className="bg-slate-50/80 rounded-2xl border border-slate-200 overflow-hidden">
                          <div className="bg-slate-100/70 px-4 py-2.5 border-b border-slate-200 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-800">{test.name}</span>
                            <span className="text-[10px] font-bold bg-white text-slate-500 px-2 py-0.5 rounded border border-slate-200">
                              {test.subTests?.length} Alt Parametre
                            </span>
                          </div>
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {test.subTests?.map(sub => (
                              <div key={sub.id} className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
                                <div className="flex justify-between items-baseline mb-1">
                                  <label className="text-xs font-bold text-slate-700 truncate" title={sub.name}>
                                    {sub.name}
                                  </label>
                                  {sub.range && (
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                      {sub.range.min}-{sub.range.max} {sub.unit}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <input 
                                    type={sub.type === 'numeric' ? 'number' : 'text'}
                                    step="any"
                                    placeholder={sub.type === 'numeric' ? 'Sayısal' : 'Metin'}
                                    value={manualForm.values[sub.id] || ''}
                                    onChange={(e) => setManualForm({
                                      ...manualForm,
                                      values: { ...manualForm.values, [sub.id]: e.target.value }
                                    })}
                                    className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:bg-white focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                                  />
                                  {sub.unit && <span className="text-[11px] text-slate-400 shrink-0">{sub.unit}</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={test.id} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-slate-800">{test.name}</span>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              {test.unit && <span>Birim: {test.unit}</span>}
                              {test.range && <span>• Ref: {test.range.min} - {test.range.max}</span>}
                            </div>
                          </div>

                          <div className="w-full sm:w-64">
                            <input 
                              type={test.type === 'numeric' ? 'number' : 'text'}
                              step="any"
                              placeholder={test.type === 'numeric' ? 'Değer girin...' : 'Sonuç yazın veya seçin...'}
                              value={manualForm.values[test.id] || ''}
                              onChange={(e) => setManualForm({
                                ...manualForm,
                                values: { ...manualForm.values, [test.id]: e.target.value }
                              })}
                              className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:ring-1 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                            />
                          </div>
                        </div>

                        {test.type === 'text' && (
                          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] text-slate-400 self-center mr-1">Hızlı Seçim:</span>
                            {['Normal', 'Patoloji Saptanmadı', 'Gece Çalışabilir', 'Uygun', 'Takip Önerilir'].map(opt => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setManualForm({
                                  ...manualForm,
                                  values: { ...manualForm.values, [test.id]: opt }
                                })}
                                className="text-[10px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hekim Notu / Kanaati */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Hekim Kanaati / Notu (İsteğe Bağlı)
                </label>
                <textarea 
                  rows={2}
                  placeholder="Muayene notu veya hekim kanaati ekleyin..."
                  value={manualForm.doctorNotes}
                  onChange={(e) => setManualForm({ ...manualForm, doctorNotes: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                />
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsNewManualModalOpen(false)}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
              >
                Vazgeç
              </button>

              <div className="w-full sm:w-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveManualPatient(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                >
                  Kaydet ve Kapat
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveManualPatient(true)}
                  className="flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                  title="Kaydı ekler ve hemen bir sonraki hasta girişine geçer"
                >
                  <Plus size={15} />
                  Kaydet ve Yeni Ekle
                </button>
              </div>
            </div>
          </div>
      </Modal>
    </>
  );
};
