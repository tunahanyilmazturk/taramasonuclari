import React from 'react';
import { Users, Activity, TrendingUp, HardHat, Moon, Eye, CheckCircle2 } from 'lucide-react';
import type { DashboardStats } from './dashboardTypes';

interface StatsCardsProps {
  stats: DashboardStats;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex items-center gap-4 relative overflow-hidden group">
        <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 shadow-sm"><Users size={24} /></div>
        <div className="relative z-10"><p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Toplam Tarama</p><h3 className="text-2xl font-black text-slate-800 tracking-tight">{stats.totalRecords} <span className="text-sm font-medium text-slate-400">Kişi</span></h3></div>
    </div>
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex items-center gap-4 relative overflow-hidden group">
         <div className={`absolute right-0 top-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform ${stats.anomalyRate > 20 ? 'bg-orange-50' : 'bg-green-50'}`}></div>
         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${stats.anomalyRate > 20 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}><Activity size={24} /></div>
         <div className="relative z-10"><p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Bulgu Oranı</p><h3 className="text-2xl font-black text-slate-800 tracking-tight">%{stats.anomalyRate} <span className="text-sm font-medium text-slate-400">Anormal</span></h3></div>
    </div>
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex items-center gap-4 relative overflow-hidden group">
         <div className={`absolute right-0 top-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform ${stats.nightRestrictionCount > 0 || stats.colorBlindCount > 0 ? 'bg-red-50' : 'bg-green-50'}`}></div>
         <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${stats.nightRestrictionCount > 0 || stats.colorBlindCount > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}><HardHat size={24} /></div>
         <div className="relative z-10"><p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Operasyonel Kısıt</p><div className="flex flex-col"><span className="text-sm font-bold text-slate-800 flex items-center gap-1"><Moon size={12} className="text-slate-400"/> {stats.nightRestrictionCount > 0 ? <span className="text-red-600">{stats.nightRestrictionCount} Gece Çalışamaz</span> : "Uygun"}</span>{stats.colorBlindCount > 0 && (<span className="text-xs font-semibold text-orange-600 flex items-center gap-1 mt-0.5"><Eye size={10}/> {stats.colorBlindCount} Renk Körlüğü</span>)}</div></div>
    </div>
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 mb-3"><div className="p-1 bg-red-50 rounded text-red-500"><TrendingUp size={14} /></div><p className="text-xs text-slate-500 font-bold uppercase tracking-wide">En Sık Görülen Riskler</p></div>
        <div className="space-y-2">
            {stats.topRisks.length > 0 ? (stats.topRisks.slice(0,3).map((risk, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span className="text-slate-700 font-medium truncate max-w-[120px]">{risk.name}</span>
                    </div>
                    <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-md text-xs font-bold border border-red-100">{risk.count}</span>
                </div>
            ))) : (<div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-2 rounded-lg border border-green-100"><CheckCircle2 size={16} /> Tüm değerler normal</div>)}
        </div>
    </div>
  </div>
);
