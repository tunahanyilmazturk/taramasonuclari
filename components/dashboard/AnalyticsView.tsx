import React from 'react';
import { BarChart3, ScatterChart, Briefcase, Activity } from 'lucide-react';
import { Company, PatientRecord } from '../../types';
import { DistributionBar } from './charts';
import type { DashboardStats, ChartData, DepartmentStat } from './dashboardTypes';

interface AnalyticsViewProps {
  stats: DashboardStats | null;
  chartData: ChartData | null;
  departmentStats: DepartmentStat[];
  selectedCompany?: Company;
  selectedAnalyticsTestId: string;
  onSelectAnalyticsTest: (id: string) => void;
  records: PatientRecord[];
  onOpenRecord: (record: PatientRecord) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  stats,
  chartData,
  departmentStats,
  selectedCompany,
  selectedAnalyticsTestId,
  onSelectAnalyticsTest,
  records,
  onOpenRecord
}) => {
  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <BarChart3 size={48} className="mb-4 opacity-20"/>
        <p>Analiz için veri bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-500">
        <div className="md:col-span-3 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
           <div className="flex items-center gap-8 relative z-10">
              <div className="relative w-28 h-28 flex items-center justify-center">
                   <svg className="w-full h-full transform -rotate-90">
                       <circle cx="56" cy="56" r="46" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-blue-900 opacity-20" />
                       <circle cx="56" cy="56" r="46" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" strokeDasharray={`${2 * Math.PI * 46}`} strokeDashoffset={`${2 * Math.PI * 46 * (stats.anomalyRate / 100)}`} strokeLinecap="round" />
                   </svg>
                   <div className="absolute inset-0 flex items-center justify-center font-black text-3xl">%{100 - stats.anomalyRate}</div>
              </div>
              <div>
                  <h3 className="text-3xl font-bold tracking-tight">Genel Sağlık Skoru</h3>
                  <p className="text-blue-100 opacity-90 mt-2 max-w-lg text-lg leading-relaxed font-light">Bu firmadaki personelin <strong className="text-white font-bold">%{(100 - stats.anomalyRate)}</strong>'ünün tüm tetkik sonuçları referans aralıkları içerisindedir.</p>
              </div>
           </div>
           <div className="flex gap-6 relative z-10">
               <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10 min-w-[120px]"><span className="block text-3xl font-bold">{stats.totalRecords}</span><span className="text-xs opacity-75 uppercase tracking-wider font-semibold">Personel</span></div>
               <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10 min-w-[120px]"><span className="block text-3xl font-bold">{stats.totalAnomalies}</span><span className="text-xs opacity-75 uppercase tracking-wider font-semibold">Toplam Bulgu</span></div>
           </div>
        </div>

        <div className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><ScatterChart size={20}/></div>
                    <div>
                        <h4 className="font-bold text-slate-800 uppercase tracking-wide">Parametre Dağılım Analizi</h4>
                        <p className="text-xs text-slate-400">Çalışanların seçili testteki değer dağılımı</p>
                    </div>
                </div>
                <select
                  value={selectedAnalyticsTestId}
                  onChange={(e) => onSelectAnalyticsTest(e.target.value)}
                  className="text-sm border-slate-200 rounded-xl focus:ring-purple-500 focus:border-purple-500 bg-slate-50 font-bold text-slate-700 py-2 px-3 min-w-[200px]"
                >
                    <option value="" disabled>Test Seçin...</option>
                    {(selectedCompany?.tests ?? []).flatMap(t => t.subTests ? t.subTests : [t])
                      .filter(t => t.type === 'numeric')
                      .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                    }
                </select>
            </div>
            <div className="p-6 overflow-x-auto">
                {chartData ? (
                    <div className="relative h-64 w-full min-w-[600px] select-none">
                        <div className="absolute left-0 bottom-0 top-0 w-px bg-slate-200"></div>
                        <div className="absolute left-0 bottom-0 w-full h-px bg-slate-200"></div>

                        {/* Reference Range Background */}
                        <div
                          className="absolute top-4 bottom-8 bg-green-50/50 border-x border-green-100"
                          style={{
                              left: `${((chartData.definition.range!.min - chartData.minPlot) / chartData.range) * 100}%`,
                              width: `${((chartData.definition.range!.max - chartData.definition.range!.min) / chartData.range) * 100}%`
                          }}
                        >
                            <div className="absolute top-0 left-0 -translate-y-full text-[10px] font-bold text-green-600">Min: {chartData.definition.range!.min}</div>
                            <div className="absolute top-0 right-0 -translate-y-full text-[10px] font-bold text-green-600">Max: {chartData.definition.range!.max}</div>
                            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-green-600/20 uppercase tracking-widest pointer-events-none">Referans Aralığı</div>
                        </div>

                        {/* Data Points */}
                        {chartData.values.map((point, i) => {
                            const leftPct = ((point.val - chartData.minPlot) / chartData.range) * 100;
                            const isHigh = point.val > chartData.definition.range!.max;
                            const isLow = point.val < chartData.definition.range!.min;
                            const topPct = 20 + (Math.sin(i * 132.1) * 0.5 + 0.5) * 60;

                            return (
                                <div
                                  key={point.id}
                                  className={`absolute w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all hover:scale-150 hover:z-20 group cursor-pointer ${isHigh ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-green-500'}`}
                                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                                  onClick={() => { const rec = records.find(r => r.id === point.id); if (rec) onOpenRecord(rec); }}
                                >
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-slate-900 text-white text-xs rounded-lg py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30 shadow-xl">
                                        <p className="font-bold">{point.name}</p>
                                        <p className="text-slate-300 text-[10px]">{point.job || 'Görev Yok'}</p>
                                        <div className="mt-1 font-mono font-bold text-yellow-300">{point.val} {chartData.definition.unit}</div>
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-slate-900 rotate-45"></div>
                                    </div>
                                </div>
                            )
                        })}

                        {/* Axis Labels */}
                        <div className="absolute bottom-0 left-0 translate-y-full pt-2 text-[10px] font-mono text-slate-400">{chartData.minPlot.toFixed(1)}</div>
                        <div className="absolute bottom-0 right-0 translate-y-full pt-2 text-[10px] font-mono text-slate-400">{chartData.maxPlot.toFixed(1)}</div>
                    </div>
                ) : (
                    <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <ScatterChart size={32} className="opacity-20 mb-2"/>
                        <p className="text-sm font-medium">Görüntülemek için sayısal bir test seçin.</p>
                    </div>
                )}
            </div>
        </div>

        {/* DEPARTMENT RISK HEATMAP */}
        <div className="md:col-span-3 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Briefcase size={20}/></div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wide">Departman Bazlı Risk Analizi</h4>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Görevi / Bölüm</th>
                            <th className="px-4 py-4 text-center">Personel</th>
                            <th className="px-4 py-4 text-center">Risk Skoru</th>
                            <th className="px-4 py-4">Baskın Risk Faktörü</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {departmentStats.map((dept, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-700">{dept.job}</td>
                                <td className="px-4 py-4 text-center text-slate-500 font-medium">{dept.total}</td>
                                <td className="px-4 py-4 text-center">
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="w-24 h-2.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                            <div style={{width: `${dept.anomalyRate}%`}} className={`h-full rounded-full shadow-sm ${dept.anomalyRate > 50 ? 'bg-red-500' : dept.anomalyRate > 20 ? 'bg-orange-500' : 'bg-green-500'}`}></div>
                                        </div>
                                        <span className="text-xs font-bold text-slate-600 w-8 text-left">%{dept.anomalyRate}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-4">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        {dept.topRisk}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {stats.allTestStats.map(stat => (
            <div key={stat.name} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <div>
                    <div className="flex justify-between items-start mb-3"><h4 className="font-bold text-slate-800 truncate pr-2 text-base" title={stat.name}>{stat.name}</h4>{stat.total > 0 && stat.normal !== stat.total && (<span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded-full font-bold shadow-sm border border-red-100">%{(100 - ((stat.normal / stat.total) * 100)).toFixed(0)} Risk</span>)}</div>
                    <DistributionBar high={stat.high} low={stat.low} normal={stat.normal} total={stat.total} />
                </div>
                <div className="mt-5 pt-4 border-t border-slate-50 flex items-center justify-between text-xs text-slate-400 font-medium"><div className="flex items-center gap-1.5"><Activity size={14} /><span>{stat.total} Sonuç</span></div>{stat.high > 0 && <span className="text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-md">{stat.high} Yüksek</span>}</div>
            </div>
        ))}
    </div>
  );
};
