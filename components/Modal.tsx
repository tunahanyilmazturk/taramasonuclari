import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  /** ESC tuşu ve (closeOnBackdrop açıksa) backdrop tıklaması ile kapanır */
  onClose?: () => void;
  children: React.ReactNode;
  /** Overlay hizalama/padding'i geçersiz kılar (örn. tam ekran için 'p-0 sm:p-4') */
  overlayClassName?: string;
  /** Backdrop tıklamasıyla kapatmayı devre dışı bırak (form modalları için) */
  closeOnBackdrop?: boolean;
  /** 'top' — açık bir modalın üstüne binen onay katmanları için */
  level?: 'base' | 'top';
}

/**
 * Tüm modal panelleri için ortak görsel dil:
 * ince koyu ring + derin gölge + zoom/slide giriş animasyonu.
 * Köşe yuvarlaklığı panele bırakılır (tam ekran modallar 'rounded-none' verebilir).
 */
export const modalPanel =
  'bg-white ring-1 ring-slate-900/10 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] animate-in zoom-in-95 slide-in-from-bottom-3 duration-300';

/**
 * Ortak modal sarmalayıcı.
 * createPortal ile document.body'ye render edilir — sayfa içindeki
 * animate-in/transform içeren sarmalayıcılar `position:fixed`'i bozduğu için
 * (containing block) backdrop'un tüm ekranı kaplaması ancak portal ile garanti edilir.
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  children,
  overlayClassName = 'p-4',
  closeOnBackdrop = true,
  level = 'base'
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);

    // Arka plan scroll'unu kilitle (sayfa <main> içinde scroll ediyor)
    const main = document.querySelector('main');
    const prevOverflow = main?.style.overflow ?? '';
    if (main) main.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      if (main) main.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 ${level === 'top' ? 'z-[200]' : 'z-[100]'} flex items-center justify-center ${overlayClassName}`}
      onMouseDown={
        closeOnBackdrop
          ? (e) => { if (e.target === e.currentTarget) onClose?.(); }
          : undefined
      }
    >
      {/* Katmanlı backdrop — güçlü blur + kenarlara doğru kararan vinyet */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200"
        onMouseDown={closeOnBackdrop ? onClose : undefined}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,6,23,0.4)_100%)] pointer-events-none" />
      {/* İçerik katmanı — relative z-10 olmazsa absolute backdrop panelin üstüne çizilir */}
      <div
        className="relative z-10 w-full h-full flex items-center justify-center"
        onMouseDown={
          closeOnBackdrop
            ? (e) => { if (e.target === e.currentTarget) onClose?.(); }
            : undefined
        }
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
