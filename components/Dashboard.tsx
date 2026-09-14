import React, { useState, useRef, useMemo, useEffect, lazy, Suspense } from 'react';
import { Company, PatientRecord, ResultStatus, ExtractedResult, TestDefinition } from '../types';
import { storageService } from '../services/storageService';
import { extractTextFromPdf } from '../services/pdfService';
import { analyzeMedicalText } from '../services/geminiService';
import { aiConfigService } from '../services/aiConfigService';
import { savePdf as savePdfBlob, openPdfInNewTab } from '../services/pdfStorage';
import { exportToExcel } from '../services/excelService';
import { DashboardModals } from './DashboardModals';
import { ConfirmModal } from './ConfirmModal';
import {
  calculateStatus, computeRecordValues, findTestById, flattenTests,
  includesTr, isAbnormalStatus, normalizeTr, parseTrDate
} from '../utils/lab';
import { StatsCards } from './dashboard/StatsCards';
import { RecordsTable, EditingCell, SortConfig, FilterType, ReviewFilter } from './dashboard/RecordsTable';
import { PatientModal } from './dashboard/PatientModal';
import type { DashboardStats, ChartData, DepartmentStat, TestStat } from './dashboard/dashboardTypes';
import {
  Building2, Sparkles, RotateCcw, Download, List, BarChart3, Loader2,
  UploadCloud, UserPlus, ArrowRight, ArrowLeft, CheckCircle2, Plus, FlaskConical, Check,
  FileText, Eye, AlertTriangle, ChevronRight, MapPin, Search, Stethoscope, CalendarDays,
  KeyRound, Cpu, X
} from 'lucide-react';

const AnalyticsView = lazy(() =>
  import('./dashboard/AnalyticsView').then(m => ({ default: m.AnalyticsView }))
);

interface DashboardProps {
  companies: Company[];
  allTests: TestDefinition[];
  records: PatientRecord[];
  onAddRecord: (record: PatientRecord) => void;
  onAddRecords?: (records: PatientRecord[]) => void;
  onUpdateRecord: (record: PatientRecord) => void;
  onToggleReview: (id: string) => void;
  onDeleteRecord: (id: string, skipConfirm?: boolean) => void;
  onClearRecords: (companyId: string) => void;
  onClearDemoRecords: (companyId: string) => number;
  onUpdateCompanyTests: (companyId: string, tests: TestDefinition[]) => void;
  onLoadDemo: () => void;
  onNavigate?: (tab: string) => void; // modül bağlantıları (ör. yaklaşan taramalar → Taramalar)
  onBack?: (fallback: string) => void; // uygulama içi geri — önceki sayfaya döner
  detailRecordId?: string; // #/dashboard/<record-id> alt rotasından gelen kayıt kimliği
}

interface ManualForm {
  patientName: string;
  registrationNumber: string;
  jobTitle: string;
  date: string;
  doctorNotes: string;
  values: Record<string, string>;
}

const emptyManualForm = (): ManualForm => ({
  patientName: '',
  registrationNumber: '',
  jobTitle: '',
  date: new Date().toISOString().split('T')[0],
  doctorNotes: '',
  values: {}
});

export const Dashboard: React.FC<DashboardProps> = ({
  companies,
  allTests,
  records,
  onAddRecord,
  onAddRecords,
  onUpdateRecord,
  onToggleReview,
  onDeleteRecord,
  onClearRecords,
  onClearDemoRecords,
  onUpdateCompanyTests,
  onLoadDemo,
  onNavigate,
  onBack,
  detailRecordId
}) => {
  // Yarım kalan sonuç-giriş sihirbazı taslağı — yenilemede seçimler korunur
  // (yüklenen PDF dosyaları File nesnesi olduğu için saklanamaz; firma/tarama/test seçimi korunur)
  const [initialWizard] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem('mediscan_dashboard_wizard') || 'null');
      return d && typeof d === 'object' ? d : null;
    } catch { return null; }
  });

  // Sayfa modu: overview = tüm sonuçları takip / workspace = firma bazlı sihirbaz
  const [pageMode, setPageMode] = useState<'overview' | 'workspace'>(initialWizard?.pageMode === 'workspace' ? 'workspace' : 'overview');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialWizard?.companyId ?? '');
  const [selectedScreeningId, setSelectedScreeningId] = useState<string>(initialWizard?.screeningId ?? ''); // '' = seçilmedi, 'free' = serbest giriş
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set(initialWizard?.testIds ?? []));
  const [wizardStep, setWizardStep] = useState<'setup' | 'input' | 'results'>(initialWizard?.step === 'input' ? 'input' : 'setup');

  // Sihirbaz seçimlerini localStorage'a yaz — sayfa yenilense bile korunur
  useEffect(() => {
    if (pageMode === 'workspace' && selectedCompanyId) {
      localStorage.setItem('mediscan_dashboard_wizard', JSON.stringify({
        pageMode, step: wizardStep === 'results' ? 'input' : wizardStep,
        companyId: selectedCompanyId, screeningId: selectedScreeningId, testIds: [...selectedTestIds]
      }));
    } else {
      localStorage.removeItem('mediscan_dashboard_wizard');
    }
  }, [pageMode, wizardStep, selectedCompanyId, selectedScreeningId, selectedTestIds]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState({ current: 0, total: 0, currentFile: '' });
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  // Gelişmiş işlem göstergesi — dosya bazında durum takibi
  type FileProgress = { name: string; size: number; status: 'pending' | 'processing' | 'done' | 'error'; error?: string; recordId?: string };
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);
  const [cancelProcessing, setCancelProcessing] = useState(false);
  const [showNoApiKeyModal, setShowNoApiKeyModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Görünüm modu tercihi localStorage'da saklanır — yenilemede korunur
  const [viewMode, setViewModeState] = useState<'list' | 'analytics'>(() =>
    localStorage.getItem('mediscan_dashboard_view') === 'analytics' ? 'analytics' : 'list');
  const setViewMode = (mode: 'list' | 'analytics') => {
    setViewModeState(mode);
    localStorage.setItem('mediscan_dashboard_view', mode);
  };
  const [isCompact, setIsCompact] = useState(false);
  const [selectedAnalyticsTestId, setSelectedAnalyticsTestId] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [jobFilter, setJobFilter] = useState<string>('all');

  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = isCompact ? 100 : 50;

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Hasta detayı URL'den türetilir (#/dashboard/<id>) — yenilemede/paylaşımda korunur
  const [localRecordId, setLocalRecordId] = useState<string | null>(null); // onNavigate yoksa yedek
  const viewingRecordId = detailRecordId ?? localRecordId;
  const viewingRecord = useMemo(
    () => viewingRecordId ? records.find(r => r.id === viewingRecordId) ?? null : null,
    [viewingRecordId, records]
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Operation & Reset/Clear States
  const [isNewOperationModalOpen, setIsNewOperationModalOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [newOpClearFirst, setNewOpClearFirst] = useState(false);

  // Comprehensive Manual Patient Entry Modal States
  const [isNewManualModalOpen, setIsNewManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState<ManualForm>(emptyManualForm);
  const [manualFormError, setManualFormError] = useState('');
  const [savedCountInSession, setSavedCountInSession] = useState(0);
  const manualNameInputRef = useRef<HTMLInputElement>(null);

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // Firma seçildiğinde tarama seçimini sıfırla — testler seçilen taramadan gelir
  const handleSelectCompany = (companyId: string) => {
      setSelectedCompanyId(companyId);
      setSelectedScreeningId('');
      setSelectedTestIds(new Set());
  };

  // Firma seçimi geçersizse ilk firmaya dön — sadece önceden bir seçim vardıysa (silinmiş olabilir)
  if (companies.length > 0 && selectedCompanyId && !selectedCompany) {
    setSelectedCompanyId(companies[0].id);
  }

  // Seçili test tanımları — master havuzdan seçilen üst seviye testler
  const selectedTests = useMemo(() => {
      return allTests.filter(t => selectedTestIds.has(t.id));
  }, [allTests, selectedTestIds]);

  const selectedTestCount = selectedTests.length;

  // Firma değiştiğinde tarama/test seçimini sıfırla (render-time derived state)
  // Not: ilk değer taslaktan gelir — mount'ta geri yüklenen seçimlerin silinmesini engeller
  const [prevCompanyId, setPrevCompanyId] = useState<string>(initialWizard?.companyId ?? '');
  if (selectedCompanyId !== prevCompanyId) {
      setPrevCompanyId(selectedCompanyId);
      setSelectedScreeningId('');
      setSelectedTestIds(new Set());
  }

  // Seçili firmaya ait taramalar — testler taramadan beslenir
  const companyScreenings = useMemo(() => {
      if (!selectedCompanyId) return [];
      const rank = (s: { status: string }) => s.status === 'devam_ediyor' ? 0 : s.status === 'planlandi' ? 1 : 2;
      return storageService.getScreenings()
          .filter(s => s.companyId === selectedCompanyId && s.status !== 'iptal')
          .sort((a, b) => rank(a) - rank(b) || a.date.localeCompare(b.date));
  }, [selectedCompanyId]);

  const selectedScreening = companyScreenings.find(s => s.id === selectedScreeningId);

  // Adım 1 → Adım 2: seçimi firmanın şablonuna kaydet ve ilerle
  const handleConfirmSetup = () => {
      if (!selectedCompany || selectedTestCount === 0) return;
      onUpdateCompanyTests(selectedCompany.id, selectedTests);
      setWizardStep('input');
  };

  // Analiz testi seçilmemişse ilk sayısal testi varsayılan yap
  if (selectedCompany && !selectedAnalyticsTestId) {
      const numericTest = flattenTests(selectedCompany.tests).find(t => t.type === 'numeric');
      if (numericTest) setSelectedAnalyticsTestId(numericTest.id);
  }

  const companyRecordsBase = useMemo(() =>
    records.filter(r => r.companyId === selectedCompanyId),
  [records, selectedCompanyId]);

  // ── GENEL BAKIŞ VERİLERİ ──
  const companySummaries = useMemo(() => {
      return companies.map(c => {
          const recs = records.filter(r => r.companyId === c.id);
          const reviewed = recs.filter(r => r.isReviewed).length;
          const anomalies = recs.filter(r => Object.values(r.status).some(isAbnormalStatus)).length;
          const lastDate = recs.reduce((latest, r) => Math.max(latest, parseTrDate(r.date)), 0);
          return { company: c, total: recs.length, reviewed, anomalies, lastDate };
      }).sort((a, b) => b.lastDate - a.lastDate);
  }, [companies, records]);

  const overviewStats = useMemo(() => {
      const todayTs = new Date(new Date().toISOString().split('T')[0] + 'T00:00:00').getTime();
      const weekAgoTs = todayTs - 7 * 24 * 60 * 60 * 1000;
      const reviewed = records.filter(r => r.isReviewed).length;
      const anomalies = records.filter(r => Object.values(r.status).some(isAbnormalStatus)).length;
      return {
          totalRecords: records.length,
          pendingReview: records.filter(r => !r.isReviewed).length,
          reviewed,
          anomalyRecords: anomalies,
          activeCompanies: new Set(records.map(r => r.companyId)).size,
          todayRecords: records.filter(r => parseTrDate(r.date) === todayTs).length,
          weekRecords: records.filter(r => parseTrDate(r.date) >= weekAgoTs).length,
          reviewRate: records.length > 0 ? Math.round((reviewed / records.length) * 100) : 0,
          anomalyRate: records.length > 0 ? Math.round((anomalies / records.length) * 100) : 0
      };
  }, [records]);

  // ── Genel bakış: arama + durum filtresi ──
  const [overviewSearch, setOverviewSearch] = useState('');
  const [recentFilter, setRecentFilter] = useState<'all' | 'pending' | 'anomaly' | 'reviewed'>('all');

  const filteredRecent = useMemo(() => {
      let list = [...records].sort((a, b) => parseTrDate(b.date) - parseTrDate(a.date));
      if (recentFilter === 'pending') list = list.filter(r => !r.isReviewed);
      if (recentFilter === 'reviewed') list = list.filter(r => r.isReviewed);
      if (recentFilter === 'anomaly') list = list.filter(r => Object.values(r.status).some(isAbnormalStatus));
      const q = normalizeTr(overviewSearch.trim());
      if (q) {
          list = list.filter(r =>
              normalizeTr(r.patientName).includes(q) ||
              normalizeTr(r.registrationNumber ?? '').includes(q) ||
              normalizeTr(companies.find(c => c.id === r.companyId)?.name ?? '').includes(q)
          );
      }
      return list.slice(0, 15);
  }, [records, recentFilter, overviewSearch, companies]);

  // ── Yaklaşan taramalar (Taramalar modülüyle entegrasyon) — localStorage'dan canlı okunur ──
  const today = new Date().toISOString().split('T')[0];
  const upcomingScreenings = storageService.getScreenings()
      .filter(s => s.status !== 'iptal' && s.status !== 'tamamlandi' && s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 4);

  // Genel inceleme ilerlemesi
  const reviewProgress = useMemo(() => {
      if (records.length === 0) return 0;
      return Math.round((records.filter(r => r.isReviewed).length / records.length) * 100);
  }, [records]);

  const startNewResult = () => {
      setPageMode('workspace');
      setWizardStep('setup');
      setSelectedCompanyId('');
      setSelectedScreeningId('');
      setSelectedTestIds(new Set());
      setViewMode('list');
      clearFilters();
  };

  const openCompanyWorkspace = (companyId: string) => {
      setSelectedCompanyId(companyId);
      setViewMode('list');
      clearFilters();
      const hasRecords = records.some(r => r.companyId === companyId);
      setWizardStep(hasRecords ? 'results' : 'setup');
      setPageMode('workspace');
  };

  // Hasta modalı — firmayı kayıt üzerinden çöz (genel bakışta da çalışır)
  const viewingCompany = viewingRecord ? companies.find(c => c.id === viewingRecord.companyId) : null;
  const viewingCompanyRecords = useMemo(() =>
      viewingRecord ? records.filter(r => r.companyId === viewingRecord.companyId) : [],
  [viewingRecord, records]);

  const availableJobs = useMemo(() => {
      const jobs = new Set(companyRecordsBase.map(r => r.jobTitle).filter((j): j is string => Boolean(j)));
      return Array.from(jobs);
  }, [companyRecordsBase]);

  const displayedRecords = useMemo(() => {
    const filtered = companyRecordsBase
      .filter(r => normalizeTr(r.patientName).includes(normalizeTr(searchTerm)))
      .filter(r => {
        if (filterType === 'all') return true;
        if (filterType === 'risky') {
            return Object.values(r.status).some(isAbnormalStatus);
        }
        if (filterType === 'missing') {
            const missingMeta = !r.registrationNumber || r.registrationNumber === '-' || r.registrationNumber === 'Belirtilmemiş';
            const unknownResults = Object.values(r.status).some(s => s === ResultStatus.UNKNOWN);
            return missingMeta || unknownResults;
        }
        return true;
      })
      .filter(r => {
          if (reviewFilter === 'all') return true;
          if (reviewFilter === 'reviewed') return r.isReviewed;
          if (reviewFilter === 'pending') return !r.isReviewed;
          return true;
      })
      .filter(r => {
          if (jobFilter === 'all') return true;
          return r.jobTitle === jobFilter;
      });

    if (sortConfig.key) {
        filtered.sort((a, b) => {
            let valA: string | number;
            let valB: string | number;

            if (sortConfig.key === 'patientName') {
                valA = normalizeTr(a.patientName);
                valB = normalizeTr(b.patientName);
            } else if (sortConfig.key === 'date') {
                valA = parseTrDate(a.date);
                valB = parseTrDate(b.date);
            } else if (sortConfig.key === 'fileName') {
                valA = normalizeTr(a.fileName);
                valB = normalizeTr(b.fileName);
            } else if (sortConfig.key === 'status') {
                valA = a.isReviewed ? 1 : 0;
                valB = b.isReviewed ? 1 : 0;
            }
            else {
                const resA = a.results[sortConfig.key!];
                const resB = b.results[sortConfig.key!];

                if (resA && typeof resA.value === 'number') valA = resA.value;
                else if (resA) valA = normalizeTr(String(resA.value));
                else valA = -Infinity;

                if (resB && typeof resB.value === 'number') valB = resB.value;
                else if (resB) valB = normalizeTr(String(resB.value));
                else valB = -Infinity;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return filtered;
  }, [companyRecordsBase, searchTerm, filterType, reviewFilter, jobFilter, sortConfig]);

  const chartData: ChartData | null = useMemo(() => {
      if (!selectedCompany || !selectedAnalyticsTestId || companyRecordsBase.length === 0) return null;

      const definition = findTestById(selectedCompany.tests, selectedAnalyticsTestId);
      if (!definition || !definition.range) return null;

      const min = definition.range.min;
      const max = definition.range.max;

      const values = companyRecordsBase.flatMap(r => {
          const res = r.results[selectedAnalyticsTestId];
          if (!res || typeof res.value !== 'number') return [];
          return [{ id: r.id, name: r.patientName, val: res.value, job: r.jobTitle }];
      });

      if (values.length === 0) return null;

      const minVal = Math.min(...values.map(v => v.val), min * 0.8);
      const maxVal = Math.max(...values.map(v => v.val), max * 1.2);
      const range = maxVal - minVal;

      return {
          definition,
          values,
          minPlot: minVal,
          maxPlot: maxVal,
          range
      };
  }, [selectedCompany, selectedAnalyticsTestId, companyRecordsBase]);

  const totalPages = Math.ceil(displayedRecords.length / itemsPerPage);
  const paginatedRecords = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return displayedRecords.slice(start, start + itemsPerPage);
  }, [displayedRecords, currentPage, itemsPerPage]);

  const departmentStats: DepartmentStat[] = useMemo(() => {
      const stats: Record<string, { total: number, anomalies: number, risks: Record<string, number> }> = {};

      companyRecordsBase.forEach(rec => {
          const job = rec.jobTitle || 'Belirtilmemiş';
          if (!stats[job]) stats[job] = { total: 0, anomalies: 0, risks: {} };

          stats[job].total++;
          let hasAnomaly = false;

          Object.entries(rec.status).forEach(([testId, status]) => {
              if (isAbnormalStatus(status)) {
                  hasAnomaly = true;
                  const res = rec.results[testId];
                  const testName = res?.testName || 'Bilinmeyen';
                  let category = 'Genel';
                  if (includesTr(testName, 'işitme') || includesTr(testName, 'odyo')) category = 'İşitme';
                  else if (includesTr(testName, 'göz')) category = 'Göz';
                  else if (includesTr(testName, 'hemogram') || includesTr(testName, 'wbc')) category = 'Kan';
                  else if (includesTr(testName, 'akciğer')) category = 'Solunum';
                  else if (includesTr(testName, 'alt') || includesTr(testName, 'ast')) category = 'Karaciğer';

                  stats[job].risks[category] = (stats[job].risks[category] || 0) + 1;
              }
          });
          if (hasAnomaly) stats[job].anomalies++;
      });

      return Object.entries(stats)
        .map(([job, data]) => {
            const topRisk = Object.entries(data.risks).sort((a, b) => b[1] - a[1])[0];
            return {
                job,
                total: data.total,
                anomalyRate: Math.round((data.anomalies / data.total) * 100),
                topRisk: topRisk ? `${topRisk[0]} (%${Math.round((topRisk[1] / data.total) * 100)})` : 'Yok'
            };
        })
        .sort((a, b) => b.anomalyRate - a.anomalyRate);
  }, [companyRecordsBase]);

  const handleSort = (key: string) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const toggleColumnVisibility = (testId: string) => {
      const newHidden = new Set(hiddenColumns);
      if (newHidden.has(testId)) newHidden.delete(testId);
      else newHidden.add(testId);
      setHiddenColumns(newHidden);
  };

  const clearFilters = () => {
      setSearchTerm('');
      setFilterType('all');
      setReviewFilter('all');
      setJobFilter('all');
      setSortConfig({ key: 'date', direction: 'desc' });
      setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm !== '' || filterType !== 'all' || reviewFilter !== 'all' || jobFilter !== 'all';

  // Filtre değişimlerinde sayfayı başa al
  const handleSearchChange = (v: string) => { setSearchTerm(v); setCurrentPage(1); };
  const handleFilterTypeChange = (v: FilterType) => { setFilterType(v); setCurrentPage(1); };
  const handleReviewFilterChange = (v: ReviewFilter) => { setReviewFilter(v); setCurrentPage(1); };
  const handleJobFilterChange = (v: string) => { setJobFilter(v); setCurrentPage(1); };

  const stats: DashboardStats | null = useMemo(() => {
    if (!selectedCompany || companyRecordsBase.length === 0) return null;

    let totalAnomalies = 0;
    let patientsWithIssues = 0;
    let nightRestrictionCount = 0;
    let colorBlindCount = 0;
    let hearingLossCount = 0;

    const testAnomalyCounts: Record<string, TestStat> = {};

    displayedRecords.forEach(rec => {
      let hasIssue = false;

      const eyeTestDef = selectedCompany.tests.find(t => t.key.includes('goz'));
      if (eyeTestDef) {
          const eyeResult = rec.results[eyeTestDef.id]?.value;
          if (eyeResult != null) {
              const eyeStr = String(eyeResult);
              if (includesTr(eyeStr, 'gece çalışamaz') || includesTr(eyeStr, 'uygun değildir')) nightRestrictionCount++;
              if (includesTr(eyeStr, 'renk körlüğü var')) colorBlindCount++;
          }
      }
      const earTestDef = selectedCompany.tests.find(t => t.key.includes('odyometri'));
      if (earTestDef) {
           const earResult = rec.results[earTestDef.id]?.value;
           if (earResult != null && (includesTr(String(earResult), 'kayıp') || includesTr(String(earResult), 'sorun') || includesTr(String(earResult), 'patoloji'))) hearingLossCount++;
      }

      Object.entries(rec.status).forEach(([testId, status]) => {
        if (!testAnomalyCounts[testId]) {
            let testName = 'Bilinmeyen';
            const parent = selectedCompany.tests.find(t => t.id === testId);
            if (parent) testName = parent.name;
            else {
                const sub = flattenTests(selectedCompany.tests).find(s => s.id === testId);
                if (sub) testName = sub.name;
            }
            testAnomalyCounts[testId] = { name: testName, count: 0, high: 0, low: 0, normal: 0, total: 0 };
        }

        testAnomalyCounts[testId].total++;

        if (status === ResultStatus.HIGH) {
            testAnomalyCounts[testId].high++;
            testAnomalyCounts[testId].count++;
            hasIssue = true;
            totalAnomalies++;
        } else if (status === ResultStatus.LOW) {
            testAnomalyCounts[testId].low++;
            testAnomalyCounts[testId].count++;
            hasIssue = true;
            totalAnomalies++;
        } else {
            testAnomalyCounts[testId].normal++;
        }

      });
      if (hasIssue) patientsWithIssues++;
    });

    const topRisks = Object.values(testAnomalyCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRecords: displayedRecords.length,
      anomalyRate: displayedRecords.length > 0 ? Math.round((patientsWithIssues / displayedRecords.length) * 100) : 0,
      totalAnomalies,
      topRisks,
      allTestStats: Object.values(testAnomalyCounts),
      nightRestrictionCount,
      colorBlindCount,
      hearingLossCount
    };
  }, [displayedRecords, selectedCompany, companyRecordsBase]);

  const openManualModal = () => {
    setManualForm(emptyManualForm());
    setManualFormError('');
    setSavedCountInSession(0);
    setIsNewManualModalOpen(true);
    setTimeout(() => {
      manualNameInputRef.current?.focus();
    }, 150);
  };

  const handleSaveManualPatient = (continueWithNew = false) => {
    if (!selectedCompany) return;
    if (!manualForm.patientName.trim()) {
      setManualFormError('Lütfen hasta adını ve soyadını giriniz.');
      manualNameInputRef.current?.focus();
      return;
    }
    setManualFormError('');

    const { results, statusMap } = computeRecordValues(
      selectedCompany.tests,
      def => manualForm.values[def.id]
    );

    const newRecord: PatientRecord = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      companyId: selectedCompany.id,
      patientName: manualForm.patientName.trim(),
      registrationNumber: manualForm.registrationNumber.trim() || 'Belirtilmemiş',
      jobTitle: manualForm.jobTitle.trim() || 'Belirtilmemiş',
      date: manualForm.date || new Date().toISOString().split('T')[0],
      fileName: 'Manuel Giriş',
      results,
      status: statusMap,
      doctorNotes: manualForm.doctorNotes.trim() || undefined,
      isReviewed: false
    };

    onAddRecord(newRecord);
    setSavedCountInSession(prev => prev + 1);

    if (continueWithNew) {
      setManualForm({ ...emptyManualForm(), date: manualForm.date });
      setManualFormError('');
      setTimeout(() => {
        manualNameInputRef.current?.focus();
      }, 100);
    } else {
      setIsNewManualModalOpen(false);
      setManualForm(emptyManualForm());
      setManualFormError('');
      setSavedCountInSession(0);
    }
  };

  const handleStartNewOperation = (actionType?: 'pdf' | 'manual') => {
    if (!selectedCompany) return;

    if (newOpClearFirst) {
      onClearRecords(selectedCompany.id);
    }

    clearFilters();
    setSelectedRecordIds(new Set());

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setIsNewOperationModalOpen(false);

    if (actionType === 'pdf') {
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 100);
    } else if (actionType === 'manual') {
      openManualModal();
    }
  };

  const handleConfirmClear = () => {
    if (!selectedCompany) return;
    onClearRecords(selectedCompany.id);
    setSelectedRecordIds(new Set());
    clearFilters();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsClearConfirmOpen(false);
    // Kayıtlar temizlendi — sihirbazı başa döndür
    setWizardStep('setup');
  };

  const processFiles = async (files: File[], forceLocal = false) => {
    if (!selectedCompany || files.length === 0) return;

    // API key kontrolü — Gemini seçili ama anahtar yoksa kullanıcıya seçenek sun
    const provider = aiConfigService.getProvider();
    const apiKey = aiConfigService.getApiKey();
    if (!forceLocal && provider !== 'local' && !apiKey) {
      setPendingFiles(files);
      setShowNoApiKeyModal(true);
      return;
    }

    // Demo kayıtları otomatik temizle — gerçek sonuç eklemeden önce demo veriyi kaldır
    onClearDemoRecords(selectedCompany.id);

    // Adım 1'de seçilen testler firmaya kaydedildi — selectedCompany.tests güncel
    const testsToLookFor = selectedTests.length > 0 ? selectedTests : selectedCompany.tests;

    setIsProcessing(true);
    setWizardStep('results'); // İşleniyor ekranına geç
    setCancelProcessing(false);
    setProcessingStatus({ current: 0, total: files.length, currentFile: '' });
    // Dosya bazında durum takibi — önizleme + durum ikonları
    setFileProgress(files.map(f => ({ name: f.name, size: f.size, status: 'pending' as const })));

    try {
      // Paralel işleme — local provider'da 3, API'de 2 worker
      const CONCURRENCY_LIMIT = forceLocal || provider === 'local' ? 3 : 2;
      const BATCH_FLUSH_SIZE = 5;
      const REQUEST_DELAY_MS = forceLocal || provider === 'local' ? 200 : 1500;

      let activeRecordsBuffer: PatientRecord[] = [];
      let processedCount = 0;
      let fileIndex = 0;

      const updateFileStatus = (idx: number, status: 'pending' | 'processing' | 'done' | 'error', error?: string) => {
        setFileProgress(prev => prev.map((f, i) => i === idx ? { ...f, status, error } : f));
      };

      const processNext = async (): Promise<void> => {
          while (fileIndex < files.length) {
            if (cancelProcessing) return;

            const currentIndex = fileIndex++;
            const file = files[currentIndex];

            setProcessingStatus(prev => ({
                ...prev,
                current: Math.min(processedCount + 1, files.length),
                currentFile: file.name
            }));
            updateFileStatus(currentIndex, 'processing');

          try {
              if (file.type !== 'application/pdf') {
                  throw new Error("PDF formatında değil");
              }

              const text = await extractTextFromPdf(file);
              const analysis = await analyzeMedicalText(text, testsToLookFor, 5, forceLocal);

              const { results, statusMap } = computeRecordValues(testsToLookFor, def => {
                  const found = analysis.extractedResults.find(r =>
                      normalizeTr(r.testName) === normalizeTr(def.name) ||
                      (def.key && normalizeTr(r.testName).includes(def.key))
                  );
                  return found?.value;
              });

              const newRecord: PatientRecord = {
                  id: Date.now().toString() + Math.random().toString().slice(2, 5),
                  companyId: selectedCompany.id,
                  patientName: analysis.patientName || "Bilinmeyen Hasta",
                  registrationNumber: analysis.registrationNumber || "Belirtilmemiş",
                  jobTitle: analysis.jobTitle || "Belirtilmemiş",
                  date: analysis.date || new Date().toISOString().split('T')[0],
                  fileName: file.name,
                  results,
                  status: statusMap,
                  isReviewed: false
              };

              activeRecordsBuffer.push(newRecord);
              updateFileStatus(currentIndex, 'done');

              // PDF'in orijinal dosyasını IndexedDB'ye sakla — sonra açılabilsin
              savePdfBlob(newRecord.id, file);

          } catch (err: unknown) {
              const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
              updateFileStatus(currentIndex, 'error', message);
              console.error(`Error processing ${file.name}:`, err);
          } finally {
              processedCount++;
              if (activeRecordsBuffer.length >= BATCH_FLUSH_SIZE) {
                  const recordsToFlush = [...activeRecordsBuffer];
                  activeRecordsBuffer = [];
                  if (onAddRecords) {
                      onAddRecords(recordsToFlush);
                  } else {
                      recordsToFlush.forEach(r => onAddRecord(r));
                  }
              }
          }
          // Rate limit'e takılmamak için istekler arası bekle
          if (fileIndex < files.length && !cancelProcessing) {
              await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MS));
          }
          }
      };

      const workers = [];
      for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
          workers.push(processNext());
      }

      await Promise.all(workers);

      if (activeRecordsBuffer.length > 0) {
          if (onAddRecords) {
              onAddRecords(activeRecordsBuffer);
          } else {
              activeRecordsBuffer.forEach(r => onAddRecord(r));
          }
      }
    } catch (err: unknown) {
      console.error("Batch processing error:", err);
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata';
      setFileProgress(prev => prev.map((f, i) => i === 0 ? { ...f, status: 'error', error: `İşlem hatası: ${message}` } : f));
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openPatientModal = (record: PatientRecord) => {
      if (onNavigate) onNavigate(`dashboard/${record.id}`);
      else setLocalRecordId(record.id);
  };

  /** PDF'i yeni sekmede aç — IndexedDB'den blob al, aç */
  const handleOpenPdf = async (record: PatientRecord) => {
      const ok = await openPdfInNewTab(record.id, record.fileName);
      if (!ok) {
          console.warn(`${record.patientName}: PDF dosyası bulunamadı (sadece işlenen metin saklanmış olabilir).`);
      }
  };

  /** Hasta modalında önceki/sonraki gezinme + kapatma — URL'yi günceller */
  const navigateRecord = (record: PatientRecord | null) => {
      if (!record) {
          setLocalRecordId(null);
          if (onBack) onBack('dashboard'); // gerçek geri — önceki sayfaya döner
          else onNavigate?.('dashboard');
      } else if (onNavigate) {
          onNavigate(`dashboard/${record.id}`);
      } else {
          setLocalRecordId(record.id);
      }
  };

  const handleUpdateAndView = (updated: PatientRecord) => {
      onUpdateRecord(updated); // kayıtlar üst state'te — modal URL'den türediği için otomatik güncellenir
  };

  const handleToggleReviewSynced = (id: string) => {
      onToggleReview(id);
  };

  const startEditing = (record: PatientRecord, testId: string, currentValue?: ExtractedResult) => {
    setEditingCell({ recordId: record.id, testId });
    setEditValue(currentValue?.value?.toString() || '');
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveEditing = (record: PatientRecord, testId: string) => {
    if (!selectedCompany) return;
    const testDef = findTestById(selectedCompany.tests, testId);

    if (testDef) {
      let finalValue: string | number = editValue;
      if (testDef.type === 'numeric') {
         const normalized = editValue.replace(',', '.');
         const num = parseFloat(normalized);
         if (!isNaN(num)) finalValue = num;
      }

      const newStatus = calculateStatus(finalValue, testDef.range, testDef.type, testDef.key);

      const updatedRecord = {
        ...record,
        results: { ...record.results, [testId]: { testName: testDef.name, value: finalValue, unit: testDef.unit } },
        status: { ...record.status, [testId]: newStatus }
      };
      onUpdateRecord(updatedRecord);
    }
    setEditingCell(null);
    setEditValue('');
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.checked) setSelectedRecordIds(new Set(displayedRecords.map(r => r.id)));
      else setSelectedRecordIds(new Set());
  };
  const handleSelectRow = (id: string) => {
      const newSet = new Set(selectedRecordIds);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      setSelectedRecordIds(newSet);
  };

  const handleBulkDelete = () => {
      setBulkDeleteConfirm(true);
  };

  const doBulkDelete = () => {
      selectedRecordIds.forEach(id => onDeleteRecord(id, true));
      setSelectedRecordIds(new Set());
      setBulkDeleteConfirm(false);
  };

  const handleBulkExport = () => {
      if (!selectedCompany) return;
      const recordsToExport = companyRecordsBase.filter(r => selectedRecordIds.has(r.id));
      exportToExcel(recordsToExport, selectedCompany.tests);
  };
  const handleBatchUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files: File[] = e.target.files ? Array.from(e.target.files) : [];
      processFiles(files);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); const files = Array.from(e.dataTransfer.files).map(f => f as File).filter(f => f.type === 'application/pdf'); if (files.length > 0) processFiles(files); };

  if (companies.length === 0) return <div className="flex flex-col items-center justify-center h-[60vh] text-center text-slate-400"><div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6"><Building2 size={32} /></div><h2 className="text-2xl font-bold text-slate-900 mb-2">Henüz Firma Tanımlanmamış</h2><p className="text-slate-500 max-w-md mb-6">Tarama yapmaya başlamak için önce bir firma oluşturmalı ve o firma için gerekli test şablonunu belirlemelisiniz.</p><div className="px-4 py-2 bg-slate-100 rounded text-sm text-slate-600">Soldaki menüden <strong>Firmalar</strong> sekmesine gidin.</div></div>;

  return (
    <div className="space-y-6 pb-20 relative">

      {/* ═══════════════════ GENEL BAKIŞ — SONUÇ TAKİBİ ═══════════════════ */}
      {pageMode === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-300">

          {/* Başlık + Ana Aksiyon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                <FlaskConical size={24} className="text-blue-600" /> Sonuçlar
              </h1>
              <p className="text-xs text-slate-500 mt-1">Tüm firmaların sonuç durumunu takip edin veya yeni sonuç hazırlayın</p>
            </div>
            <button
              onClick={startNewResult}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95 shrink-0"
            >
              <Plus size={16} /> Yeni Sonuç Oluştur
            </button>
          </div>

          {/* Hızlı Aksiyon Kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Yeni Sonuç', desc: 'PDF yükle veya manuel gir', icon: Plus, color: 'blue', onClick: startNewResult },
              { label: 'Yeni Tarama', desc: 'Tarama planla', icon: Stethoscope, color: 'emerald', onClick: () => onNavigate?.('screenings/new') },
              { label: 'Yeni Teklif', desc: 'Firmaya teklif ver', icon: FileText, color: 'violet', onClick: () => onNavigate?.('quotes/new') },
              { label: 'Firma Ekle', desc: 'Yeni firma tanımla', icon: Building2, color: 'amber', onClick: () => onNavigate?.('companies') }
            ].map(action => {
              const Icon = action.icon;
              const colorMap: Record<string, string> = {
                  blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100 border-blue-200',
                  emerald: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200',
                  violet: 'bg-violet-50 text-violet-600 hover:bg-violet-100 border-violet-200',
                  amber: 'bg-amber-50 text-amber-600 hover:bg-amber-100 border-amber-200'
              };
              return (
                  <button key={action.label} onClick={action.onClick}
                      className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left ${colorMap[action.color]}`}>
                      <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm"><Icon size={18}/></div>
                      <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{action.label}</p>
                          <p className="text-[10px] opacity-70 truncate">{action.desc}</p>
                      </div>
                  </button>
              );
            })}
          </div>

          {/* Genel İstatistikler — tıklanabilir filtre kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => setRecentFilter('all')}
              className={`bg-white rounded-2xl border p-4 flex items-center gap-3 text-left transition-all ${recentFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-100 shadow-sm' : 'border-slate-200 hover:border-blue-200'}`}
            >
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0"><Building2 size={18}/></div>
              <div><p className="text-xl font-black text-slate-800 tabular-nums">{overviewStats.activeCompanies}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Aktif Firma</p></div>
            </button>
            <button
              onClick={() => setRecentFilter('all')}
              className={`bg-white rounded-2xl border p-4 flex items-center gap-3 text-left transition-all ${recentFilter === 'all' ? 'border-indigo-400 ring-2 ring-indigo-100 shadow-sm' : 'border-slate-200 hover:border-indigo-200'}`}
            >
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0"><FileText size={18}/></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xl font-black text-slate-800 tabular-nums">{overviewStats.totalRecords}</p>
                  {overviewStats.todayRecords > 0 && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">+{overviewStats.todayRecords} bugün</span>}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Toplam Sonuç</p>
              </div>
            </button>
            <button
              onClick={() => setRecentFilter('pending')}
              className={`bg-white rounded-2xl border p-4 flex items-center gap-3 text-left transition-all ${recentFilter === 'pending' ? 'border-amber-400 ring-2 ring-amber-100 shadow-sm' : 'border-slate-200 hover:border-amber-200'}`}
            >
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0"><Eye size={18}/></div>
              <div><p className="text-xl font-black text-slate-800 tabular-nums">{overviewStats.pendingReview}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bekleyen İnceleme</p></div>
            </button>
            <button
              onClick={() => setRecentFilter('anomaly')}
              className={`bg-white rounded-2xl border p-4 flex items-center gap-3 text-left transition-all ${recentFilter === 'anomaly' ? 'border-red-400 ring-2 ring-red-100 shadow-sm' : 'border-slate-200 hover:border-red-200'}`}
            >
              <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0"><AlertTriangle size={18}/></div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-xl font-black text-slate-800 tabular-nums">{overviewStats.anomalyRecords}</p>
                  {overviewStats.anomalyRate > 0 && <span className="text-[9px] font-bold text-red-500">%{overviewStats.anomalyRate}</span>}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bulgulu Kayıt</p>
              </div>
            </button>
          </div>

          {/* Bugün özeti + Bu hafta + İnceleme ilerlemesi — yan yana */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Bugün özeti */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl border border-blue-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays size={15} className="text-blue-600" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Bugün</h3>
                <span className="text-[10px] text-slate-400 ml-auto">{new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-black text-blue-700 tabular-nums">{overviewStats.todayRecords}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Yeni Kayıt</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-700 tabular-nums">{upcomingScreenings.filter(s => s.date === today).length}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Tarama Bugün</p>
                </div>
              </div>
            </div>

            {/* Bu hafta */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={15} className="text-slate-500" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Bu Hafta</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-black text-slate-800 tabular-nums">{overviewStats.weekRecords}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Yeni Kayıt</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800 tabular-nums">{overviewStats.reviewRate}%</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">İnceleme Oranı</p>
                </div>
              </div>
            </div>

            {/* Genel inceleme ilerlemesi */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={15} className="text-emerald-500" />
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">İnceleme İlerlemesi</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500" style={{ width: `${reviewProgress}%` }} />
                </div>
                <span className="text-sm font-black text-slate-700 tabular-nums shrink-0">%{reviewProgress}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2">{overviewStats.reviewed}/{overviewStats.totalRecords} kayıt incelendi</p>
            </div>
          </div>

          {/* Yaklaşan Taramalar — Taramalar modülü bağlantısı */}
          {upcomingScreenings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Stethoscope size={13}/> Yaklaşan Taramalar
                </h2>
                {onNavigate && (
                  <button onClick={() => onNavigate('screenings')} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors">
                    Tümünü Gör →
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {upcomingScreenings.map(s => {
                  const comp = companies.find(c => c.id === s.companyId);
                  const pct = s.plannedCount > 0 ? Math.round((s.completedCount / s.plannedCount) * 100) : 0;
                  const isToday = s.date === today;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onNavigate?.('screenings')}
                      className="bg-white rounded-2xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all group"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${isToday ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                          {isToday ? 'BUGÜN' : new Date(s.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${s.status === 'devam_ediyor' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                          {s.status === 'devam_ediyor' ? 'DEVAM EDİYOR' : 'PLANLANDI'}
                        </span>
                      </div>
                      <h3 className="text-xs font-black text-slate-800 truncate group-hover:text-blue-700 transition-colors">{s.title}</h3>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{comp?.name || '—'}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-2">
                        <MapPin size={10} className="shrink-0"/> <span className="truncate">{s.location || '—'}</span>
                      </div>
                      {s.plannedCount > 0 && (
                        <div className="mt-2.5">
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="text-[9px] text-slate-400 mt-1">{s.completedCount}/{s.plannedCount} kişi</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Firma Bazlı Takip */}
          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Firma Bazlı Takip</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {companySummaries.map(({ company, total, reviewed, anomalies, lastDate }) => {
                const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
                return (
                  <button
                    key={company.id}
                    onClick={() => openCompanyWorkspace(company.id)}
                    className="group bg-white rounded-2xl border border-slate-200 p-5 text-left hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex items-center justify-center text-sm font-black shrink-0 group-hover:bg-blue-600 transition-colors">
                        {company.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-black text-slate-800 truncate">{company.name}</h3>
                        <p className="text-[11px] text-slate-400 truncate">{company.sector || 'Sektör belirtilmemiş'}</p>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold mb-3">
                      <span className="text-slate-600 flex items-center gap-1"><FileText size={11}/> {total} sonuç</span>
                      {anomalies > 0 && <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={11}/> {anomalies} bulgulu</span>}
                      {total === 0 && <span className="text-slate-300 italic font-medium">Henüz kayıt yok</span>}
                    </div>
                    {total > 0 && (
                      <>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400 font-medium">
                          <span>{reviewed}/{total} incelendi (%{pct})</span>
                          {lastDate > 0 && <span>Son: {new Date(lastDate).toLocaleDateString('tr-TR')}</span>}
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Son Eklenen Sonuçlar */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Son Eklenen Sonuçlar</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Durum çipleri */}
                <div className="flex bg-slate-100 rounded-xl p-0.5 gap-0.5">
                  {([
                    { id: 'all', label: 'Tümü' },
                    { id: 'pending', label: 'Bekleyen' },
                    { id: 'reviewed', label: 'İncelenen' },
                    { id: 'anomaly', label: 'Bulgulu' }
                  ] as const).map(f => (
                    <button
                      key={f.id}
                      onClick={() => setRecentFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                        recentFilter === f.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {/* Arama */}
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={overviewSearch}
                    onChange={e => setOverviewSearch(e.target.value)}
                    placeholder="Hasta, protokol, firma..."
                    className="pl-7 pr-3 py-1.5 w-44 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
            {filteredRecent.length === 0 ? (
              records.length === 0 ? (
              <div className="py-14 text-center">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileText size={26} className="text-slate-300"/></div>
                <h3 className="text-sm font-bold text-slate-600">Henüz sonuç kaydı yok</h3>
                <p className="text-xs text-slate-400 mt-1 mb-4">İlk sonucu oluşturmak için sihirbazı başlatın veya demo veri yükleyin.</p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={startNewResult} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all">
                    Yeni Sonuç Oluştur
                  </button>
                  <button onClick={onLoadDemo} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors">
                    Örnek Veri Yükle
                  </button>
                </div>
              </div>
              ) : (
              <div className="py-12 text-center">
                <Search size={24} className="mx-auto text-slate-300 mb-3" />
                <h3 className="text-sm font-bold text-slate-600">Eşleşen kayıt yok</h3>
                <p className="text-xs text-slate-400 mt-1 mb-3">Arama veya filtre kriterlerine uyan sonuç bulunamadı.</p>
                <button onClick={() => { setOverviewSearch(''); setRecentFilter('all'); }} className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                  Filtreleri Temizle
                </button>
              </div>
              )
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/70 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-5 py-2.5">Hasta</th>
                      <th className="px-4 py-2.5">Firma</th>
                      <th className="px-4 py-2.5">Tarih</th>
                      <th className="px-4 py-2.5">Durum</th>
                      <th className="px-4 py-2.5 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecent.map(rec => {
                      const comp = companies.find(c => c.id === rec.companyId);
                      const hasAnomaly = Object.values(rec.status).some(isAbnormalStatus);
                      return (
                        <tr key={rec.id} onClick={() => openPatientModal(rec)} className="hover:bg-blue-50/40 cursor-pointer transition-colors">
                          <td className="px-5 py-3">
                            <p className="font-bold text-slate-800 text-xs">{rec.patientName}</p>
                            <p className="text-[10px] text-slate-400">{rec.registrationNumber || '-'}{rec.jobTitle ? ` • ${rec.jobTitle}` : ''}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 font-medium">{comp?.name || '-'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500">{rec.date}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {hasAnomaly && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">BULGULU</span>}
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${rec.isReviewed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                                {rec.isReviewed ? 'İNCELENDİ' : 'BEKLİYOR'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right"><ChevronRight size={15} className="text-slate-300 inline"/></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════ SİHİRBAZ — SONUÇ HAZIRLAMA ═══════════════════ */}
      {pageMode === 'workspace' && (
        <>
          {/* Geri dönüş */}
          <button
            onClick={() => setPageMode('overview')}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors -mb-2"
          >
            <ArrowLeft size={14} /> Tüm Sonuçlara Dön
          </button>

      {/* WIZARD STEP INDICATOR + RESULTS TOOLBAR (birleşik kompakt) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sticky top-20 z-20 shadow-sm">
        {/* Üst satır: step indicator + firma bilgisi */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Step indicator — kompakt */}
            {[
              { key: 'setup', label: 'Firma & Test', icon: Building2 },
              { key: 'input', label: 'Veri Girişi', icon: UploadCloud },
              { key: 'results', label: 'Sonuçlar', icon: CheckCircle2 },
            ].map((step, idx) => {
              const isActive = wizardStep === step.key;
              const isDone = (wizardStep === 'input' && idx === 0) || (wizardStep === 'results' && idx <= 1);
              return (
                <React.Fragment key={step.key}>
                  {idx > 0 && <div className={`w-4 sm:w-8 h-0.5 shrink-0 ${isDone || isActive ? 'bg-blue-400' : 'bg-slate-200'}`} />}
                  <button
                    onClick={() => {
                      if (step.key === 'setup') setWizardStep('setup');
                      else if (step.key === 'input' && selectedCompanyId) setWizardStep('input');
                      else if (step.key === 'results' && companyRecordsBase.length > 0) setWizardStep('results');
                    }}
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                      isActive ? 'bg-blue-600 text-white shadow-sm' :
                      isDone ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' :
                      'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <step.icon size={13} />
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Sağ taraf: firma adı + butonlar (results step'inde) */}
          {wizardStep === 'results' && selectedCompany && companyRecordsBase.length > 0 && !isProcessing ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-2.5 py-1.5 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg flex items-center justify-center shrink-0"><Building2 size={14} /></div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{selectedCompany.name}</p>
                  <p className="text-[9px] text-slate-400">{companyRecordsBase.length} kayıt · {selectedTestCount} test</p>
                </div>
              </div>
              <button
                onClick={() => { setNewOpClearFirst(false); setIsNewOperationModalOpen(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-bold text-xs transition-all shadow-sm active:scale-95"
                title="Yeni İşlem"
              >
                <Sparkles size={14} />
                <span className="hidden sm:inline">Yeni İşlem</span>
              </button>
              <button
                onClick={() => setIsClearConfirmOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 rounded-lg font-bold text-xs transition-all active:scale-95"
                title="Temizle"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Temizle</span>
              </button>
              <div className="bg-slate-100/80 p-0.5 rounded-lg flex gap-0.5 border border-slate-200">
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="Liste Görünümü"><List size={15} /></button>
                <button onClick={() => setViewMode('analytics')} className={`p-1.5 rounded-md transition-all ${viewMode === 'analytics' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`} title="Analiz Raporu"><BarChart3 size={15} /></button>
              </div>
              <button
                onClick={() => exportToExcel(companyRecordsBase, selectedCompany.tests)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-bold text-xs transition-all shadow-sm active:scale-95"
                title="Excel Raporu"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Excel</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ═══ ADIM 1: FİRMA & TEST SEÇİMİ ═══ */}
      {wizardStep === 'setup' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Firma & Test Seçimi</h2>
            <p className="text-sm text-slate-500">Tarama yapılacak firmayı seçin, ardından çıkarılacak testleri belirleyin</p>
          </div>

          {/* Firma Seçimi */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building2 size={14}/> 1. Firma Seçin
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {companies.map(company => {
                const isSelected = selectedCompanyId === company.id;
                const recordCount = records.filter(r => r.companyId === company.id).length;
                return (
                  <button
                    key={company.id}
                    onClick={() => handleSelectCompany(company.id)}
                    className={`relative flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/50 shadow-md shadow-blue-100 ring-1 ring-blue-200'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                      isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {company.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>{company.name}</h4>
                      <p className="text-[10px] text-slate-400">{company.tests.length} test • {recordCount} kayıt</p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0">
                        <Check size={12} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tarama Seçimi — testler taramadan gelir */}
          {selectedCompany && (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Stethoscope size={14}/> 2. Tarama Seçin
                </h3>
                <span className="text-xs text-slate-500">{selectedScreeningId === 'free' ? 'Serbest giriş' : selectedScreening ? `${selectedTestCount} test yüklendi` : ''}</span>
              </div>

              {companyScreenings.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center">
                  <CalendarDays size={26} className="mx-auto text-slate-300 mb-3" />
                  <h4 className="text-sm font-bold text-slate-600">Bu firmaya ait tarama bulunamadı</h4>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Taramalar sayfasından operasyon planlayın veya serbest girişle devam edin.</p>
                  {onNavigate && (
                    <button onClick={() => onNavigate('screenings')} className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
                      Tarama Planla →
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {companyScreenings.map(s => {
                    const isSel = selectedScreeningId === s.id;
                    const sTests = s.testIds.map(id => allTests.find(t => t.id === id)?.name).filter(Boolean);
                    const statusMeta = s.status === 'devam_ediyor'
                      ? { label: 'DEVAM EDİYOR', cls: 'bg-amber-50 text-amber-600 border-amber-200' }
                      : s.status === 'tamamlandi'
                        ? { label: 'TAMAMLANDI', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' }
                        : { label: 'PLANLANDI', cls: 'bg-blue-50 text-blue-600 border-blue-100' };
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedScreeningId(s.id); setSelectedTestIds(new Set(s.testIds)); }}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all ${
                          isSel
                            ? 'border-blue-500 bg-blue-50/50 shadow-md shadow-blue-100 ring-1 ring-blue-200'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${isSel ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <span className="text-sm font-black leading-none">{new Date(s.date).getDate()}</span>
                          <span className="text-[8px] font-bold uppercase">{new Date(s.date).toLocaleDateString('tr-TR', { month: 'short' })}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={`text-sm font-bold truncate ${isSel ? 'text-blue-800' : 'text-slate-700'}`}>{s.title}</h4>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border shrink-0 ${statusMeta.cls}`}>{statusMeta.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <MapPin size={9}/> {s.location || '—'} · {s.plannedCount} kişi planlandı
                          </p>
                          {/* Tarama testleri önizleme */}
                          <div className="flex flex-wrap gap-1 mt-2">
                            {sTests.slice(0, 6).map((name, i) => (
                              <span key={i} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${isSel ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{name}</span>
                            ))}
                            {sTests.length > 6 && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">+{sTests.length - 6}</span>}
                          </div>
                        </div>
                        {isSel && (
                          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white shrink-0"><Check size={12}/></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Serbest giriş — taramasız manuel devam */}
              <button
                onClick={() => { setSelectedScreeningId('free'); setSelectedTestIds(new Set(selectedCompany.tests.map(t => t.id))); }}
                className={`mt-2.5 w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 border-dashed text-xs font-bold transition-all ${
                  selectedScreeningId === 'free'
                    ? 'border-blue-400 bg-blue-50/50 text-blue-700'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <FlaskConical size={14}/> Taramasız Serbest Giriş — firma şablonundaki testlerle ({selectedCompany.tests.length})
              </button>
            </div>
          )}

          {/* İleri Butonu */}
          {selectedCompany && selectedTestCount > 0 && (
            <div className="max-w-4xl mx-auto flex justify-end pt-2">
              <button
                onClick={handleConfirmSetup}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-sm transition-all shadow-lg shadow-blue-200 active:scale-95"
              >
                Devam Et <ArrowRight size={18} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ ADIM 2: VERİ GİRİŞİ ═══ */}
      {wizardStep === 'input' && selectedCompany && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Veri Girişi</h2>
            <p className="text-sm text-slate-500">
              <span className="font-bold text-blue-600">{selectedCompany.name}</span> için {selectedTestCount} test seçildi — veri girişi yöntemi seçin
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* PDF Yükleme Kartı */}
            <button
              onClick={() => { setNewOpClearFirst(false); handleStartNewOperation('pdf'); }}
              className="group relative bg-white rounded-3xl border-2 border-slate-200 p-8 text-left hover:border-blue-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <UploadCloud size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Toplu PDF Taraması</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">Laboratuvar sonuç PDF'lerini seçin. AI veya yerel sistem otomatik analiz etsin.</p>
              <div className="flex items-center gap-2 text-blue-600 text-sm font-bold">
                PDF Seç ve Yükle <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Manuel Giriş Kartı */}
            <button
              onClick={openManualModal}
              className="group relative bg-white rounded-3xl border-2 border-slate-200 p-8 text-left hover:border-indigo-400 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <UserPlus size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Manuel Hasta Girişi</h3>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">Hasta bilgilerini ve test değerlerini form üzerinden elle girin.</p>
              <div className="flex items-center gap-2 text-indigo-600 text-sm font-bold">
                Formu Aç <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>

          {/* Drag & Drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mt-8 max-w-3xl mx-auto border-2 border-dashed rounded-3xl p-8 text-center transition-all ${isDragging ? 'border-blue-400 bg-blue-50/50 scale-[1.01]' : 'border-slate-300 hover:border-slate-400'}`}
          >
            <UploadCloud size={32} className={`mx-auto mb-3 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
            <p className="text-sm font-bold text-slate-600">PDF dosyalarını buraya sürükleyip bırakın</p>
            <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleBatchUpload} />
          </div>

          <div className="flex items-center justify-between max-w-3xl mx-auto mt-4">
            <button onClick={() => setWizardStep('setup')} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">
              <ArrowLeft size={14} /> Geri
            </button>
            <button onClick={onLoadDemo} className="text-xs text-slate-400 hover:text-blue-500 transition-colors font-medium">
              Örnek veri ile test et →
            </button>
          </div>
        </div>
      )}

      {/* ═══ İŞLENİYOR ═══ */}
      {isProcessing && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-3xl mx-auto">
            {/* Başlık + spinner */}
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                <Loader2 size={28} className="animate-spin" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-slate-900">PDF'ler İşleniyor</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {processingStatus.currentFile && <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">{processingStatus.currentFile}</span>}
                </p>
              </div>
              {/* Özet rozetleri */}
              <div className="flex items-center gap-2 shrink-0">
                {fileProgress.filter(f => f.status === 'done').length > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100">
                    <CheckCircle2 size={13} /> {fileProgress.filter(f => f.status === 'done').length}
                  </span>
                )}
                {fileProgress.filter(f => f.status === 'error').length > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100">
                    <AlertTriangle size={13} /> {fileProgress.filter(f => f.status === 'error').length}
                  </span>
                )}
                {fileProgress.filter(f => f.status === 'processing').length > 0 && (
                  <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold border border-blue-100">
                    <Loader2 size={13} className="animate-spin" /> {fileProgress.filter(f => f.status === 'processing').length}
                  </span>
                )}
              </div>
            </div>

            {/* İlerleme çubuğu */}
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden mb-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${processingStatus.total > 0 ? (processingStatus.current / processingStatus.total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-slate-400 font-medium">{processingStatus.current} / {processingStatus.total} dosya işlendi</p>
              <p className="text-xs font-bold text-blue-600">
                %{processingStatus.total > 0 ? Math.round((processingStatus.current / processingStatus.total) * 100) : 0}
              </p>
            </div>

            {/* Dosya listesi — durum ikonları + boyut */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
              {fileProgress.map((f, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-2.5 ${i % 2 ? 'bg-slate-50/50' : 'bg-white'} ${f.status === 'processing' ? 'bg-blue-50/50' : ''}`}>
                  {/* Durum ikonu */}
                  <div className="shrink-0">
                    {f.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                    {f.status === 'processing' && <Loader2 size={18} className="text-blue-500 animate-spin" />}
                    {f.status === 'done' && <CheckCircle2 size={18} className="text-emerald-500" />}
                    {f.status === 'error' && <AlertTriangle size={18} className="text-red-500" />}
                  </div>
                  {/* Dosya adı + hata */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${f.status === 'error' ? 'text-red-600' : 'text-slate-700'}`}>{f.name}</p>
                    {f.error && <p className="text-[10px] text-red-400 truncate">{f.error}</p>}
                  </div>
                  {/* Boyut */}
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {f.size < 1024 * 1024 ? `${Math.round(f.size / 1024)} KB` : `${(f.size / (1024 * 1024)).toFixed(1)} MB`}
                  </span>
                </div>
              ))}
            </div>

            {/* İptal butonu */}
            <div className="flex justify-center mt-5">
              <button
                onClick={() => { setCancelProcessing(true); setIsProcessing(false); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 rounded-lg transition-all"
              >
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADIM 3: SONUÇLAR ═══ */}
      {wizardStep === 'results' && selectedCompany && companyRecordsBase.length > 0 && !isProcessing && (
        <>
          {/* Sonuç İçeriği */}
          {viewMode === 'list' ? (
            <>
              <RecordsTable
                selectedCompany={selectedCompany}
                displayedRecords={displayedRecords}
                paginatedRecords={paginatedRecords}
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                filterType={filterType}
                onFilterTypeChange={handleFilterTypeChange}
                reviewFilter={reviewFilter}
                onReviewFilterChange={handleReviewFilterChange}
                jobFilter={jobFilter}
                onJobFilterChange={handleJobFilterChange}
                availableJobs={availableJobs}
                hasActiveFilters={hasActiveFilters}
                onClearFilters={clearFilters}
                hiddenColumns={hiddenColumns}
                onToggleColumn={toggleColumnVisibility}
                showColumnMenu={showColumnMenu}
                onToggleColumnMenu={() => setShowColumnMenu(!showColumnMenu)}
                isCompact={isCompact}
                onToggleCompact={() => setIsCompact(!isCompact)}
                sortConfig={sortConfig}
                onSort={handleSort}
                selectedRecordIds={selectedRecordIds}
                onSelectAll={handleSelectAll}
                onSelectRow={handleSelectRow}
                onClearSelection={() => setSelectedRecordIds(new Set())}
                onBulkDelete={handleBulkDelete}
                onBulkExport={handleBulkExport}
                editingCell={editingCell}
                editValue={editValue}
                onEditValueChange={setEditValue}
                onStartEdit={startEditing}
                onSaveEdit={saveEditing}
                onCancelEdit={cancelEditing}
                onToggleReview={handleToggleReviewSynced}
                onDeleteRecord={onDeleteRecord}
                onOpenRecord={openPatientModal}
                onOpenPdf={handleOpenPdf}
                onClearRecords={onClearRecords}
                onLoadDemo={onLoadDemo}
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </>
          ) : (
              <Suspense fallback={
                <div className="flex items-center justify-center py-20 text-slate-400">
                  <Loader2 className="animate-spin" size={32} />
                </div>
              }>
                {stats && stats.totalRecords > 0 && <StatsCards stats={stats} />}
                <AnalyticsView
                  stats={stats}
                  chartData={chartData}
                  departmentStats={departmentStats}
                  selectedCompany={selectedCompany}
                  selectedAnalyticsTestId={selectedAnalyticsTestId}
                  onSelectAnalyticsTest={setSelectedAnalyticsTestId}
                  records={companyRecordsBase}
                  onOpenRecord={openPatientModal}
                />
              </Suspense>
          )}
        </>
      )}
        </>
      )}

      {viewingRecord && viewingCompany && (
        <PatientModal
          key={viewingRecord.id}
          record={viewingRecord}
          company={viewingCompany}
          orderedRecords={viewingCompanyRecords}
          onUpdateRecord={handleUpdateAndView}
          onToggleReview={handleToggleReviewSynced}
          onNavigate={navigateRecord}
          onClose={() => navigateRecord(null)}
        />
      )}

      {viewingRecordId && !viewingRecord && (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <AlertTriangle size={28} className="mx-auto text-amber-500" />
          <p className="text-sm font-bold text-slate-700">Kayıt bulunamadı</p>
          <p className="text-xs text-slate-400">Bu sonuç kaydı silinmiş olabilir.</p>
          <button onClick={() => navigateRecord(null)} className="px-4 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors">
            Sonuçlara Dön
          </button>
        </div>
      )}

      <DashboardModals
        isNewOperationModalOpen={isNewOperationModalOpen}
        setIsNewOperationModalOpen={setIsNewOperationModalOpen}
        newOpClearFirst={newOpClearFirst}
        setNewOpClearFirst={setNewOpClearFirst}
        handleStartNewOperation={handleStartNewOperation}
        isClearConfirmOpen={isClearConfirmOpen}
        setIsClearConfirmOpen={setIsClearConfirmOpen}
        handleConfirmClear={handleConfirmClear}
        isNewManualModalOpen={isNewManualModalOpen}
        setIsNewManualModalOpen={setIsNewManualModalOpen}
        selectedCompany={selectedCompany ?? null}
        companyRecordsCount={companyRecordsBase.length}
        savedCountInSession={savedCountInSession}
        manualForm={manualForm}
        setManualForm={setManualForm}
        manualFormError={manualFormError}
        manualNameInputRef={manualNameInputRef}
        handleSaveManualPatient={handleSaveManualPatient}
      />

      {/* Bulk Delete Confirm Modal */}
      <ConfirmModal
        open={bulkDeleteConfirm}
        title="Kayıtları Sil"
        message={`${selectedRecordIds.size} kaydı silmek istediğinize emin misiniz?`}
        confirmLabel="Evet, Sil"
        onConfirm={doBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />

      {/* API Key Yok Modalı */}
      {showNoApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setShowNoApiKeyModal(false); setPendingFiles(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 bg-amber-500 text-white flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2"><KeyRound size={18}/> API Anahtarı Gerekli</h3>
              <button onClick={() => { setShowNoApiKeyModal(false); setPendingFiles(null); }} className="text-white/80 hover:text-white transition-colors p-1">
                <X size={18}/>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                  <AlertTriangle size={20}/>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Gemini API anahtarı tanımlı değil</p>
                  <p className="text-xs text-slate-500 mt-1">PDF sonuçlarını yapay zeka ile okumak için bir API anahtarı gerekir. Anahtarınız yoksa yerel sistem (pattern tabanlı) ile devam edebilirsiniz.</p>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Cpu size={14} className="text-blue-500"/>
                  <span><b>Yerel Sistem:</b> API anahtarı olmadan çalışır, regex/pattern tabanlı okuma yapar. Hassas metinlerde AI kadar başarılı olmayabilir.</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0 flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowNoApiKeyModal(false);
                  if (pendingFiles) processFiles(pendingFiles, true);
                  setPendingFiles(null);
                }}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-200 flex items-center justify-center gap-2"
              >
                <Cpu size={16}/> Yerel Sistem ile Devam Et
              </button>
              <button
                onClick={() => { setShowNoApiKeyModal(false); setPendingFiles(null); }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
