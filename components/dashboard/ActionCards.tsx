import React from 'react';
import {
  UploadCloud, FileUp, UserPlus, Sparkles, RotateCcw, Loader2,
  X as XIcon, AlertTriangle
} from 'lucide-react';

export interface ProcessingStatus {
  current: number;
  total: number;
  currentFile: string;
}

interface ActionCardsProps {
  isDragging: boolean;
  isProcessing: boolean;
  processingStatus: ProcessingStatus;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  companyName?: string;
  recordsCount: number;
  batchErrors: string[];
  onBatchUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onManualAdd: () => void;
  onNewOperation: () => void;
  onClearRequest: () => void;
  onCancelProcessing: () => void;
  onDismissErrors: () => void;
}

export const ActionCards: React.FC<ActionCardsProps> = ({
  isDragging,
  isProcessing,
  processingStatus,
  fileInputRef,
  companyName,
  recordsCount,
  batchErrors,
  onBatchUpload,
  onDragOver,
  onDragLeave,
  onDrop,
  onManualAdd,
  onNewOperation,
  onClearRequest,
  onCancelProcessing,
  onDismissErrors
}) => (
  <>
    {isProcessing && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
            <div className="bg-slate-900/90 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[320px] border border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-600 rounded-lg animate-pulse">
                        <Loader2 size={20} className="animate-spin text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-0.5">
                            <h4 className="font-bold text-sm text-white">Analiz Sürüyor</h4>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-blue-300">{processingStatus.current} / {processingStatus.total}</span>
                                <button
                                  onClick={onCancelProcessing}
                                  className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                  title="Durdur / İptal Et"
                                >
                                  <XIcon size={14} />
                                </button>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate max-w-[200px]">{processingStatus.currentFile}</p>
                    </div>
                </div>
                <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 transition-all duration-300"
                      style={{ width: `${(processingStatus.current / processingStatus.total) * 100}%` }}
                    />
                </div>
            </div>
        </div>
    )}

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Toplu PDF Yükle Card */}
        <div
          className={`sm:col-span-2 bg-white border border-dashed rounded-2xl p-5 text-center transition-all relative overflow-hidden ${isDragging ? 'border-blue-500 bg-blue-50 scale-[0.99] shadow-inner' : isProcessing ? 'border-blue-400 bg-blue-50/30' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/30 hover:shadow-md'} cursor-pointer group`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
            <input
              type="file"
              accept=".pdf"
              multiple
              onChange={onBatchUpload}
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              ref={fileInputRef}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-20"
              disabled={isProcessing}
            />
            <div className="flex flex-col items-center justify-center py-1 relative z-10">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2 transition-transform duration-300 ${isDragging ? 'bg-blue-600 text-white scale-110 shadow-lg' : 'bg-blue-50 text-blue-600 group-hover:scale-110 shadow-sm'}`}>
                    {isDragging ? <FileUp size={22} /> : <UploadCloud size={22} />}
                </div>
                <h3 className="text-base font-bold text-slate-800 mb-0.5">
                    {isDragging ? 'Dosyaları Buraya Bırakın' : 'Toplu PDF Yükle'}
                </h3>
                <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    {isDragging ? 'Yüklemeyi başlatmak için bırakın...' : 'Laboratuvar sonuç PDF\'lerini buraya sürükleyin veya seçin.'}
                </p>
            </div>
        </div>

        {/* 2. Manuel Hasta Ekle Card */}
        <div
          onClick={onManualAdd}
          className="bg-white border border-dashed border-slate-300 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 hover:shadow-md transition-all group relative overflow-hidden"
        >
            <div className="w-11 h-11 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-2 group-hover:scale-110 group-hover:rotate-3 transition-transform shadow-sm">
                <UserPlus size={22} />
            </div>
            <h3 className="font-bold text-slate-700 text-sm">Manuel Hasta Ekle</h3>
            <p className="text-xs text-slate-400 text-center mt-0.5">Hasta ve test sonuçlarını elle girin</p>
        </div>

        {/* 3. Tarama Yönetim & Yeni İşlem Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarama Durumu</span>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  {recordsCount} Kayıt
                </span>
              </div>
              <p className="text-xs text-slate-700 font-semibold truncate" title={companyName}>
                {companyName || 'Firma seçili'}
              </p>
            </div>

            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button
                  onClick={onNewOperation}
                  className="flex-1 py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
                  title="Yeni işlem başlat"
                >
                  <Sparkles size={14} />
                  Yeni İşlem
                </button>

                <button
                  onClick={onClearRequest}
                  disabled={recordsCount === 0}
                  className="py-2 px-2.5 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all border border-slate-200 hover:border-red-200 disabled:opacity-40 disabled:pointer-events-none active:scale-95"
                  title="Taramayı temizle"
                >
                  <RotateCcw size={14} />
                  Temizle
                </button>
            </div>
        </div>
    </div>

    {batchErrors.length > 0 && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 animate-in slide-in-from-top-2 shadow-sm flex items-start justify-between gap-3">
            <div className="flex-1">
                <div className="flex items-center gap-2 font-bold mb-2">
                    <AlertTriangle size={18} />
                    <h4>Bazı dosyalar işlenirken hata oluştu ({batchErrors.length}):</h4>
                </div>
                <ul className="list-disc list-inside text-sm space-y-1 opacity-90 max-h-32 overflow-y-auto">
                    {batchErrors.map((err, i) => (<li key={i}>{err}</li>))}
                </ul>
            </div>
            <button
              onClick={onDismissErrors}
              className="p-1.5 hover:bg-red-100 rounded-lg text-red-500 hover:text-red-700 transition-colors"
              title="Hata mesajlarını gizle"
            >
              <XIcon size={16} />
            </button>
        </div>
    )}
  </>
);
