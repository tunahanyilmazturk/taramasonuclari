import React from 'react';
import {
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight
} from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  pageSize: number;
  onPageChange: (page: number | ((p: number) => number)) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemName?: string;
}

/**
 * Sayfalama kontrolleri — sayfa numarası, önceki/sonraki, sayfa boyutu seçici.
 */
export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage, totalPages, totalItems, startIndex, endIndex,
  pageSize, onPageChange, onPageSizeChange,
  pageSizeOptions = [5, 7, 10, 12, 24, 50],
  itemName = 'kayıt'
}) => {
  if (totalItems === 0) return null;

  return (
    <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-500 font-medium">
          {totalItems} {itemName}tan {startIndex + 1}–{endIndex} arası gösteriliyor
        </span>
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(parseInt(e.target.value))}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 font-medium cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {pageSizeOptions.map(opt => (
              <option key={opt} value={opt}>{opt} / sayfa</option>
            ))}
          </select>
        )}
      </div>
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
  );
};
