import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Modal, modalPanel } from './Modal';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles = {
  danger: {
    iconBg: 'bg-red-100 text-red-600',
    confirmBtn: 'bg-red-600 hover:bg-red-700 shadow-red-200',
    border: 'border-red-200',
    strip: 'bg-red-500'
  },
  warning: {
    iconBg: 'bg-amber-100 text-amber-600',
    confirmBtn: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
    border: 'border-amber-200',
    strip: 'bg-amber-500'
  },
  info: {
    iconBg: 'bg-blue-100 text-blue-600',
    confirmBtn: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
    border: 'border-blue-200',
    strip: 'bg-blue-500'
  }
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Evet',
  cancelLabel = 'Vazgeç',
  variant = 'danger',
  onConfirm,
  onCancel
}) => {
  const styles = variantStyles[variant];

  // level="top" — açık form modallarının üstünde render edilir
  return (
    <Modal open={open} onClose={onCancel} level="top">
      <div className={`${modalPanel} rounded-2xl w-full max-w-sm overflow-hidden`}>
        <div className={`h-1 ${styles.strip}`} />
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 ${styles.iconBg} rounded-xl flex items-center justify-center shrink-0`}>
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</p>
            </div>
            <button
              onClick={onCancel}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-md active:scale-95 ${styles.confirmBtn}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
};
