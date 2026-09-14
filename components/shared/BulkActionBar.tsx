import React from 'react';
import { Trash2, X, CheckSquare } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  itemName?: string; // "tarama", "teklif", "firma" vb.
}

/**
 * Alt-orta sabitlenen toplu işlem çubuğu — seçili öğe sayısını gösterir,
 * toplu silme ve seçimi temizleme butonları içerir.
 */
export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onBulkDelete,
  onClearSelection,
  itemName = 'kayıt'
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-slate-900 text-white px-4 sm:px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 sm:gap-6 animate-in slide-in-from-bottom-4 fade-in border border-slate-700 max-w-[calc(100vw-2rem)]">
      <span className="font-bold text-xs sm:text-sm whitespace-nowrap flex items-center gap-1.5">
        <CheckSquare size={15} /> {selectedCount} {itemName} seçildi
      </span>
      <div className="h-4 w-px bg-slate-700" />
      <button
        onClick={onBulkDelete}
        className="text-red-400 hover:text-red-300 font-medium text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap"
      >
        <Trash2 size={16} /> Toplu Sil
      </button>
      <button onClick={onClearSelection} className="text-slate-400 hover:text-white">
        <X size={16} />
      </button>
    </div>
  );
};
