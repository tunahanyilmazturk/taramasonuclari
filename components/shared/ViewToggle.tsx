import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

interface ViewToggleProps {
  view: 'card' | 'list';
  onChange: (view: 'card' | 'list') => void;
  storageKey: string;
}

/**
 * Kart/Liste görünüm geçiş butonu — localStorage'da saklanır.
 */
export const ViewToggle: React.FC<ViewToggleProps> = ({ view, onChange, storageKey }) => {
  const handleToggle = (newView: 'card' | 'list') => {
    onChange(newView);
    localStorage.setItem(`mediscan_view_${storageKey}`, newView);
  };

  return (
    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
      <button
        onClick={() => handleToggle('card')}
        className={`p-1.5 rounded-md transition-all ${view === 'card' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        title="Kart Görünümü"
      >
        <LayoutGrid size={16} />
      </button>
      <button
        onClick={() => handleToggle('list')}
        className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        title="Liste Görünümü"
      >
        <List size={16} />
      </button>
    </div>
  );
};
