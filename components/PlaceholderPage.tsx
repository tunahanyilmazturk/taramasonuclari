import React from 'react';
import { LucideIcon, Hammer, ArrowRight } from 'lucide-react';

interface PlannedFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface PlaceholderPageProps {
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  features: PlannedFeature[];
  onGoToDashboard?: () => void;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  features,
  onGoToDashboard
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16 animate-in fade-in slide-in-from-bottom-4 duration-300">

      {/* Başlık */}
      <div className="text-center pt-6">
        <div className={`w-20 h-20 ${iconBg} ${iconColor} rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg`}>
          <Icon size={38} />
        </div>
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">{title}</h1>
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
            <Hammer size={10} /> Yakında
          </span>
        </div>
        <p className="text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">{subtitle}</p>
      </div>

      {/* Planlanan Özellikler */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {features.map((f, i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4 hover:border-blue-200 hover:shadow-md transition-all"
          >
            <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center shrink-0 border border-slate-100">
              <f.icon size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800">{f.title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{f.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Alt Bilgi */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-700">Bu modül geliştirme aşamasında</h4>
          <p className="text-xs text-slate-500 mt-0.5">Mobil tarama operasyonları için hazırlanıyor — temel akış Sonuçlar sayfasında aktif.</p>
        </div>
        {onGoToDashboard && (
          <button
            onClick={onGoToDashboard}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95 whitespace-nowrap shrink-0"
          >
            Sonuçlara Git <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
