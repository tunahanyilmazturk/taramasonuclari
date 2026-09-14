import React, { useState, useMemo, useRef } from 'react';
import { TestDefinition, TestType } from '../types';
import { ConfirmModal } from './ConfirmModal';
import {
  Trash2, Plus, Save, ChevronRight, ChevronDown, FolderTree,
  Search, ArrowUp, ArrowDown, AlignLeft, Copy, RotateCcw, LayoutList, Layers, Hash, AlertTriangle,
  Download, Upload, Zap, X
} from 'lucide-react';
import { DEFAULT_TESTS, TEST_DEFAULT_PRICES, TEST_CATEGORIES, testCategory } from '../constants';
import { usePagination } from '../hooks/usePagination';
import { PaginationControls } from './shared/PaginationControls';

interface TestConfigProps {
  tests: TestDefinition[];
  onUpdateTests: (tests: TestDefinition[]) => void;
}

// --- ROW COMPONENT ---
interface TestRowProps {
    test: TestDefinition;
    depth: number;
    index: number;
    siblingsCount: number;
    expandedPanels: Set<string>;
    searchTerm: string;
    onToggleExpand: (id: string) => void;
    onUpdateField: (id: string, field: keyof TestDefinition | 'min' | 'max', value: string | number) => void;
    onTypeChange: (id: string, newType: TestType) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
    onClone: (e: React.MouseEvent, test: TestDefinition) => void;
    onAddSub: (id: string) => void;
    onDeleteClick: (e: React.MouseEvent, id: string) => void;
    renderSubTests: (subTests: TestDefinition[], depth: number) => React.ReactNode; 
}

const TestRow: React.FC<TestRowProps> = ({ 
    test, depth, index, siblingsCount, expandedPanels, searchTerm,
    onToggleExpand, onUpdateField, onTypeChange, onMove, onClone, onAddSub, onDeleteClick, renderSubTests
}) => {
    const hasSubTests = test.subTests && test.subTests.length > 0;
    const isExpanded = expandedPanels.has(test.id) || searchTerm.length > 0;
    const isFirst = index === 0;
    const isLast = index === siblingsCount - 1;
    const paddingLeft = depth * 32 + 16; 

    const rowBaseClasses = "group transition-all hover:bg-blue-50/40 border-b border-slate-100 last:border-0";
    const rootRowClasses = "bg-white"; 
    const subRowClasses = "bg-slate-50/30"; 

    return (
        <>
            <tr className={`${rowBaseClasses} ${depth === 0 ? rootRowClasses : subRowClasses}`}>
                {/* NAME COLUMN */}
                <td className="py-3 pr-4 relative">
                    <div className="flex items-center gap-3" style={{ paddingLeft: `${paddingLeft}px` }}>
                        
                        {/* Visual Tree Connectors */}
                        {depth > 0 && (
                            <>
                                <div className="absolute w-px bg-slate-300" style={{ left: `${paddingLeft - 20}px`, top: '-50%', height: isLast ? '100%' : '200%' }} /> 
                                <div className="absolute w-4 h-px bg-slate-300" style={{ left: `${paddingLeft - 20}px`, top: '50%' }} />
                                <div className="absolute w-1.5 h-1.5 rounded-full bg-slate-300 border border-white" style={{ left: `${paddingLeft - 4}px`, top: 'calc(50% - 3px)' }} />
                            </>
                        )}

                        {hasSubTests ? (
                            <button 
                                onClick={() => onToggleExpand(test.id)} 
                                className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-md transition-all ${isExpanded ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-500'}`}
                            >
                                {isExpanded ? <ChevronDown size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />}
                            </button>
                        ) : (
                            <div className="w-6" /> 
                        )}
                        
                        <div className="flex-1 flex flex-col justify-center">
                            <input 
                                type="text" 
                                value={test.name}
                                onChange={(e) => onUpdateField(test.id, 'name', e.target.value)}
                                className={`bg-transparent border-none p-0 focus:ring-0 w-full transition-all text-sm outline-none ${hasSubTests ? 'font-bold text-slate-800' : 'font-medium text-slate-700'}`}
                                placeholder="Test Adı"
                            />
                            <div className="text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                #{test.key}
                            </div>
                        </div>
                    </div>
                </td>

                {/* CATEGORY COLUMN — sadece root testlerde gösterilir, tıklanınca değiştirilebilir */}
                <td className="px-4 py-3">
                    {depth === 0 ? (
                        <select
                            value={testCategory(test)}
                            onChange={(e) => onUpdateField(test.id, 'category', e.target.value)}
                            title="Kategori değiştir"
                            className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md uppercase tracking-wide border-none outline-none cursor-pointer transition-colors"
                        >
                            {TEST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    ) : (
                        <span className="text-slate-300 text-xs">—</span>
                    )}
                </td>

                {/* TYPE COLUMN */}
                <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                        {hasSubTests ? (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md border border-indigo-100 shadow-sm uppercase tracking-wide">
                                <Layers size={12} /> Panel
                            </span>
                        ) : (
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border transition-colors ${test.type === 'text' ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
                                <div className="shrink-0">
                                    {test.type === 'text' ? <AlignLeft size={14}/> : <Hash size={14}/>}
                                </div>
                                <div className="h-4 w-px bg-current opacity-20 mx-1"></div>
                                <select
                                    value={test.type || 'numeric'}
                                    onChange={(e) => onTypeChange(test.id, e.target.value as TestType)}
                                    className="bg-transparent border-none text-[11px] font-bold uppercase p-0 pr-6 focus:ring-0 cursor-pointer outline-none w-full"
                                >
                                    <option value="numeric">Sayısal</option>
                                    <option value="text">Metin</option>
                                </select>
                            </div>
                        )}
                    </div>
                </td>

                {/* UNIT COLUMN */}
                <td className="px-4 py-3">
                    {!hasSubTests && (
                        <input 
                        type="text" 
                        value={test.unit}
                        onChange={(e) => onUpdateField(test.id, 'unit', e.target.value)}
                        className="w-20 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 rounded-none px-1 py-1 text-slate-600 text-sm text-center font-medium transition-all placeholder:text-slate-300 focus:bg-blue-50/50"
                        placeholder="-"
                        />
                    )}
                </td>

                {/* RANGE COLUMN */}
                <td className="px-4 py-3">
                    {test.type === 'numeric' && !hasSubTests ? (
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 w-fit group/range focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <input 
                        type="number" 
                        value={test.range?.min}
                        onChange={(e) => onUpdateField(test.id, 'min', e.target.value)}
                        placeholder="Min"
                        className="w-14 border-none bg-white rounded py-1 px-1 text-center text-xs text-slate-700 focus:ring-0 font-medium shadow-sm"
                        />
                        <span className="text-slate-300 text-[10px] font-bold">-</span>
                        <input 
                        type="number" 
                        value={test.range?.max}
                        onChange={(e) => onUpdateField(test.id, 'max', e.target.value)}
                        placeholder="Max"
                        className="w-14 border-none bg-white rounded py-1 px-1 text-center text-xs text-slate-700 focus:ring-0 font-medium shadow-sm"
                        />
                    </div>
                    ) : (
                        <div className="text-center w-32">
                            <span className="text-slate-300 text-xl font-light mx-auto block">-</span>
                        </div>
                    )}
                </td>

                {/* PRICE COLUMN — tekliflerde varsayılan birim fiyat */}
                <td className="px-4 py-3">
                    {depth === 0 ? (
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 w-fit mx-auto group/price focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                            <span className="text-slate-400 text-[10px] font-bold pl-1">₺</span>
                            <input
                                type="number"
                                min={0}
                                step={1}
                                value={test.unitPrice ?? TEST_DEFAULT_PRICES[test.key] ?? ''}
                                onChange={(e) => onUpdateField(test.id, 'unitPrice', e.target.value === '' ? 0 : Math.max(0, parseFloat(e.target.value) || 0))}
                                placeholder="0"
                                title="Liste fiyatı — teklif kalemlerinde otomatik kullanılır"
                                className="w-16 border-none bg-white rounded py-1 px-1 text-center text-xs text-slate-700 focus:ring-0 font-medium shadow-sm"
                            />
                        </div>
                    ) : (
                        <div className="text-center"><span className="text-slate-300 text-xl font-light">-</span></div>
                    )}
                </td>

                {/* ACTIONS COLUMN */}
                <td className="px-4 py-3 text-right relative z-20">
                    <div className="flex items-center justify-end gap-1">
                        <div className="flex flex-col mr-2 bg-slate-100 rounded-md p-0.5 border border-slate-200">
                            <button 
                                onClick={() => onMove(test.id, 'up')} disabled={isFirst}
                                className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 hover:bg-white rounded transition-colors"
                            >
                                <ArrowUp size={10} strokeWidth={3} />
                            </button>
                            <button 
                                onClick={() => onMove(test.id, 'down')} disabled={isLast}
                                className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-20 hover:bg-white rounded transition-colors"
                            >
                                <ArrowDown size={10} strokeWidth={3} />
                            </button>
                        </div>

                        <button 
                            onClick={(e) => onClone(e, test)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Kopyala"
                        >
                            <Copy size={16} />
                        </button>

                        <button 
                            onClick={() => onAddSub(test.id)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Alt Parametre Ekle"
                        >
                            <Plus size={16} />
                        </button>

                        <button 
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation(); 
                                onDeleteClick(e, test.id);
                            }}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Sil"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </td>
            </tr>
            {hasSubTests && isExpanded && renderSubTests(test.subTests!, depth + 1)}
        </>
    );
};

export const TestConfig: React.FC<TestConfigProps> = ({ tests, onUpdateTests }) => {
  const [editingTests, setEditingTests] = useState<TestDefinition[]>(tests);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'numeric' | 'text'>('all');
  const [isDirty, setIsDirty] = useState(false);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [importConfirm, setImportConfirm] = useState<{ data: TestDefinition[]; count: number } | null>(null);
  const [newTestModal, setNewTestModal] = useState(false);
  const [newTestForm, setNewTestForm] = useState({ name: '', unit: '', type: 'numeric' as TestType, category: 'Diğer', min: '', max: '' });
  const [isPanel, setIsPanel] = useState(false);
  const [subParams, setSubParams] = useState<{ name: string; unit: string; min: string; max: string }[]>([{ name: '', unit: '', min: '', max: '' }]);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Dışarıdan tests güncellenirse ve kullanıcı kirli değilse editörü senkronize et
  // (React 19 "adjust state during render" pattern'i)
  const [prevTests, setPrevTests] = useState<TestDefinition[]>(tests);
  if (prevTests !== tests) {
    setPrevTests(tests);
    if (!isDirty) setEditingTests(tests);
  }

  // --- STATS ---
  const stats = useMemo(() => {
      let totalItems = 0;
      let panels = 0;
      let numeric = 0;
      let text = 0;

      const traverse = (list: TestDefinition[]) => {
          list.forEach(t => {
              totalItems++;
              if (t.subTests && t.subTests.length > 0) {
                  panels++;
                  traverse(t.subTests);
              } else {
                  if (t.type === 'numeric') numeric++;
                  else text++;
              }
          });
      };
      traverse(editingTests);
      return { totalItems, panels, numeric, text };
  }, [editingTests]);

  // --- VALIDATION WARNINGS ---
  const validationWarnings = useMemo(() => {
      const warnings: string[] = [];
      const allKeys = new Map<string, number>();
      const allIds = new Set<string>();

      const traverse = (list: TestDefinition[]) => {
          list.forEach(t => {
              if (allIds.has(t.id)) warnings.push(`Tekrarlayan ID: "${t.id}"`);
              allIds.add(t.id);
              const count = allKeys.get(t.key) || 0;
              allKeys.set(t.key, count + 1);
              if (count > 0) warnings.push(`Tekrarlayan key: "${t.key}" (${t.name})`);
              if (t.type === 'numeric' && (!t.range || t.range.min === t.range.max)) {
                  warnings.push(`Eksik aralık: "${t.name}"`);
              }
              if (t.subTests) traverse(t.subTests);
          });
      };
      traverse(editingTests);
      return warnings;
  }, [editingTests]);

  // --- ACTIONS ---

  const handleSave = () => {
    onUpdateTests(editingTests);
    setIsDirty(false);
  };

  const handleDiscard = () => {
      setDiscardConfirm(true);
  };

  const doDiscard = () => {
      setEditingTests(tests);
      setIsDirty(false);
      setDiscardConfirm(false);
  };

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedPanels(prev => {
        const newSet = new Set(prev);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        return newSet;
    });
  }, []);

  const expandAll = () => {
      const allIds = new Set<string>();
      const traverse = (list: TestDefinition[]) => {
          list.forEach(t => {
              if (t.subTests && t.subTests.length > 0) {
                  allIds.add(t.id);
                  traverse(t.subTests);
              }
          });
      };
      traverse(editingTests);
      setExpandedPanels(allIds);
  };

  const collapseAll = () => setExpandedPanels(new Set());

  // --- PRESET TEMPLATES ---
  const PRESET_CATEGORIES = useMemo(() => {
      const hemogram = DEFAULT_TESTS.find(t => t.key === 'hemogram');
      const tit = DEFAULT_TESTS.find(t => t.key === 'tam_idrar');
      return [
          { label: 'Hemogram (Tam Kan)', icon: '🩸', tests: hemogram ? [hemogram] : [] },
          { label: 'Tam İdrar Tahlili', icon: '🧪', tests: tit ? [tit] : [] },
          { label: 'Seroloji (Kart Testleri)', icon: '🔬', tests: DEFAULT_TESTS.filter(t => t.key.includes('_kart')) },
          { label: 'Seroloji (Kantitatif)', icon: '📊', tests: DEFAULT_TESTS.filter(t => t.key.includes('_val') && !t.key.includes('_kart')) },
          { label: 'Biyokimya', icon: '🧬', tests: DEFAULT_TESTS.filter(t => ['glikoz','kolesterol','alt','ast','kreatinin'].includes(t.key)) },
          { label: 'Görüntüleme', icon: '📷', tests: DEFAULT_TESTS.filter(t => ['akciger_grafisi','lumbosakral_grafi','servikal_grafi','pnomokonyoz_1','pnomokonyoz_2'].includes(t.key)) },
          { label: 'Muayene', icon: '🩺', tests: DEFAULT_TESTS.filter(t => ['ek_2_belgesi'].includes(t.key)) },
          { label: 'Kan Grubu', icon: '🩸', tests: DEFAULT_TESTS.filter(t => ['kan_grubu'].includes(t.key)) },
          { label: 'Aşı', icon: '💉', tests: DEFAULT_TESTS.filter(t => ['tetanoz'].includes(t.key)) },
          { label: 'EKG', icon: '❤️', tests: DEFAULT_TESTS.filter(t => ['ekg'].includes(t.key)) },
          { label: 'Göz Muayenesi', icon: '👁️', tests: DEFAULT_TESTS.filter(t => ['goz'].includes(t.key)) },
          { label: 'Odyometri', icon: '👂', tests: DEFAULT_TESTS.filter(t => ['odyometri'].includes(t.key)) },
          { label: 'Solunum Fonksiyon', icon: '🫁', tests: DEFAULT_TESTS.filter(t => ['sft'].includes(t.key)) },
          { label: 'Portör Kültürleri', icon: '🦠', tests: DEFAULT_TESTS.filter(t => t.key.includes('kulturu') || t.key.includes('gaita_mikroskopi')) },
          { label: 'Ağır Metaller', icon: '⚗️', tests: DEFAULT_TESTS.filter(t => ['krom','kadmiyum','manganez','civa','kursun'].includes(t.key)) },
          { label: 'Toksikoloji', icon: '☠️', tests: DEFAULT_TESTS.filter(t => ['kreatinin_spot_idrar','mukonik_asit','mukonik_asit_oran','fenol_idrar','fenol_oran','hidroksipiren','benzen_idrar','o_kresol'].includes(t.key)) },
      ].filter(cat => cat.tests.length > 0);
  }, []);

  const addPreset = (presetTests: TestDefinition[]) => {
      // Deep clone with new IDs to avoid collisions
      const clone = (t: TestDefinition): TestDefinition => ({
          ...t,
          id: `${t.id}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          subTests: t.subTests?.map(clone)
      });
      setEditingTests(prev => [...prev, ...presetTests.map(clone)]);
      setIsDirty(true);
      setShowPresetMenu(false);
  };

  // --- EXPORT / IMPORT ---
  const handleExport = () => {
      const json = JSON.stringify(editingTests, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test_havuzu_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const parsed = JSON.parse(ev.target?.result as string);
              // Tüm öğelerde zorunlu alanlar var mı kontrol et
              const isValid = Array.isArray(parsed) && parsed.length > 0 &&
                  parsed.every(t => t && typeof t.id === 'string' && typeof t.name === 'string' && typeof t.key === 'string');
              if (isValid) {
                  setImportConfirm({ data: parsed, count: parsed.length });
              } else {
                  setImportError('Geçersiz format. Her test için id, name ve key alanları zorunludur.');
              }
          } catch {
              setImportError('JSON okunamadı. Dosya bozuk veya geçersiz.');
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const doImport = () => {
      if (!importConfirm) return;
      setEditingTests(importConfirm.data);
      setIsDirty(true);
      setImportConfirm(null);
  };

  // --- CRUD OPERATIONS ---

  const updateTestField = React.useCallback((id: string, field: keyof TestDefinition | 'min' | 'max', value: string | number) => {
    setEditingTests(prev => {
        const updateRecursive = (list: TestDefinition[]): TestDefinition[] => {
            return list.map(t => {
                if (t.id === id) {
                    if (field === 'min' || field === 'max') {
                        const numVal = parseFloat(String(value));
                        return { ...t, range: { ...(t.range || { min: 0, max: 0 }), [field]: isNaN(numVal) ? 0 : numVal } };
                    }
                    if (field === 'name') {
                        const nameVal = String(value);
                        // Key'i değiştirme — PDF alias eşleştirmesi key üzerinden çalışır
                        return { ...t, name: nameVal };
                    }
                    return { ...t, [field]: value };
                }
                if (t.subTests) {
                    const updatedSubs = updateRecursive(t.subTests);
                    if (updatedSubs !== t.subTests) return { ...t, subTests: updatedSubs };
                }
                return t;
            });
        };
        return updateRecursive(prev);
    });
    setIsDirty(true);
  }, []);

  const handleTypeChange = React.useCallback((id: string, newType: TestType) => {
    updateTestField(id, 'type', newType);
  }, [updateTestField]);

  // Updated: Triggers Modal
  const handleDeleteClick = React.useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
  }, []);

  // Updated: Actual delete logic triggered by Modal
  const confirmDelete = React.useCallback(() => {
    if (!deletingId) return;

    setEditingTests(prev => {
        const deleteRecursive = (list: TestDefinition[]): TestDefinition[] => {
            const filtered = list.filter(t => t.id !== deletingId);
            if (filtered.length !== list.length) {
                return filtered;
            }
            return list.map(t => {
                if (t.subTests && t.subTests.length > 0) {
                    const updatedSubs = deleteRecursive(t.subTests);
                    if (updatedSubs !== t.subTests) {
                        return { ...t, subTests: updatedSubs };
                    }
                }
                return t;
            });
        };
        const newList = deleteRecursive(prev);
        return [...newList];
    });
    setIsDirty(true);
    setDeletingId(null);
  }, [deletingId]);

  const handleClone = React.useCallback((e: React.MouseEvent, test: TestDefinition) => {
    e.stopPropagation();
    
    const cloneTestRecursive = (t: TestDefinition): TestDefinition => {
        const uniqueId = `copy-${Date.now()}-${Math.floor(Math.random() * 1000000).toString(16)}`;
        return {
            ...t,
            id: uniqueId,
            name: `${t.name} (Kopya)`,
            key: `${t.key}_copy_${Math.floor(Math.random() * 1000)}`,
            subTests: t.subTests ? t.subTests.map(cloneTestRecursive) : undefined
        };
    };

    const newTest = cloneTestRecursive(test);
    
    setEditingTests(prev => {
        const insertRecursive = (list: TestDefinition[]): TestDefinition[] => {
            const index = list.findIndex(t => t.id === test.id);
            if (index !== -1) {
                const newList = [...list];
                newList.splice(index + 1, 0, newTest);
                return newList;
            }
            return list.map(t => {
                if (t.subTests) return { ...t, subTests: insertRecursive(t.subTests) };
                return t;
            });
        };
        return insertRecursive(prev);
    });
    setIsDirty(true);
  }, []);

  const handleAddRootTest = () => {
    setNewTestForm({ name: '', unit: '', type: 'numeric', category: 'Diğer', min: '', max: '' });
    setIsPanel(false);
    setSubParams([{ name: '', unit: '', min: '', max: '' }]);
    setNewTestModal(true);
  };

  // Otomatik tamamlama — mevcut test isimlerinden öneri
  const existingTestNames = useMemo(() => {
    const names: string[] = [];
    const traverse = (list: TestDefinition[]) => list.forEach(t => { names.push(t.name); if (t.subTests) traverse(t.subTests); });
    traverse(editingTests);
    return names.map(n => n.toLowerCase());
  }, [editingTests]);

  const nameSuggestions = useMemo(() => {
    const q = newTestForm.name.trim().toLowerCase();
    if (!q) return [];
    return editingTests
      .flatMap(t => [t, ...(t.subTests ?? [])])
      .filter(t => t.name.toLowerCase().includes(q) && !t.name.toLowerCase().startsWith(q))
      .map(t => t.name)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 4);
  }, [newTestForm.name, editingTests]);

  const isDuplicateName = existingTestNames.includes(newTestForm.name.trim().toLowerCase());

  const confirmAddRootTest = () => {
    if (!newTestForm.name.trim()) return;
    const uniqueId = `root-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const keyBase = newTestForm.name.trim().toLowerCase().replace(/\s+/g, '_');

    if (isPanel) {
      const validSubs = subParams.filter(s => s.name.trim());
      if (validSubs.length === 0) return;
      const newTest: TestDefinition = {
        id: uniqueId,
        name: newTestForm.name.trim(),
        key: keyBase,
        category: newTestForm.category,
        type: 'text', // Panel kendisi metin tipi — alt parametreler sayısal
        unit: '',
        subTests: validSubs.map((s, i) => ({
          id: `${uniqueId}_sub_${i}_${Math.floor(Math.random() * 10000)}`,
          name: s.name.trim(),
          key: `${keyBase}_${s.name.trim().toLowerCase().replace(/\s+/g, '_')}`,
          unit: s.unit.trim(),
          type: 'numeric' as TestType,
          range: { min: parseFloat(s.min) || 0, max: parseFloat(s.max) || 0 }
        }))
      };
      setEditingTests(prev => [...prev, newTest]);
    } else {
      const newTest: TestDefinition = {
        id: uniqueId,
        name: newTestForm.name.trim(),
        key: keyBase,
        unit: newTestForm.unit.trim(),
        type: newTestForm.type,
        category: newTestForm.category,
        ...(newTestForm.type === 'numeric' ? { range: { min: parseFloat(newTestForm.min) || 0, max: parseFloat(newTestForm.max) || 0 } } : {})
      };
      setEditingTests(prev => [...prev, newTest]);
    }
    setIsDirty(true);
    setNewTestModal(false);
  };

  const handleAddSubTest = React.useCallback((parentId: string) => {
      setEditingTests(prev => {
          const addRecursive = (list: TestDefinition[]): TestDefinition[] => {
              return list.map(t => {
                  if (t.id === parentId) {
                      const newSub: TestDefinition = {
                          id: `sub-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                          name: 'Yeni Parametre',
                          key: `yeni_parametre_${Math.floor(Math.random() * 1000)}`,
                          unit: '',
                          type: 'numeric',
                          range: { min: 0, max: 10 }
                      };
                      return { ...t, subTests: [...(t.subTests || []), newSub] };
                  }
                  if (t.subTests) {
                      return { ...t, subTests: addRecursive(t.subTests) };
                  }
                  return t;
              });
          };
          return addRecursive(prev);
      });
      setExpandedPanels(prev => new Set(prev).add(parentId));
      setIsDirty(true);
  }, []);

  const handleMove = React.useCallback((id: string, direction: 'up' | 'down') => {
      setEditingTests(prev => {
          const moveRecursive = (list: TestDefinition[]): TestDefinition[] => {
              const index = list.findIndex(t => t.id === id);
              if (index !== -1) {
                  const newList = [...list];
                  if (direction === 'up' && index > 0) {
                      [newList[index], newList[index - 1]] = [newList[index - 1], newList[index]];
                  } else if (direction === 'down' && index < list.length - 1) {
                      [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
                  }
                  return newList;
              }
              return list.map(t => {
                  if (t.subTests) return { ...t, subTests: moveRecursive(t.subTests) };
                  return t;
              });
          };
          return moveRecursive(prev);
      });
      setIsDirty(true);
  }, []);

  // --- FILTERING + GROUPING ---
  const filteredTests = useMemo(() => {
    let result = editingTests;

    if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        result = result.filter(t => {
            const selfMatch = t.name.toLowerCase().includes(lowerTerm) || t.key.includes(lowerTerm);
            const subMatch = t.subTests?.some(s => s.name.toLowerCase().includes(lowerTerm));
            return selfMatch || subMatch;
        });
    }

    if (typeFilter !== 'all') {
        result = result.filter(t => {
            if (t.subTests && t.subTests.length > 0) return true;
            return t.type === typeFilter;
        });
    }

    return result;
  }, [editingTests, searchTerm, typeFilter]);

  // Sayfalama — arama aktifken tüm sonuçlar gösterilir
  const {
      paginatedItems: paginatedTests,
      currentPage, totalPages, pageSize,
      setCurrentPage, setPageSize,
      totalItems: pagedTotal, startIndex, endIndex
  } = usePagination(filteredTests, 'testpool', 15);

  const renderSubTests = React.useCallback((subTests: TestDefinition[], depth: number) => {
      return subTests.map((sub, i) => (
          <TestRow 
              key={sub.id}
              test={sub}
              depth={depth}
              index={i}
              siblingsCount={subTests.length}
              expandedPanels={expandedPanels}
              searchTerm={searchTerm}
              onToggleExpand={toggleExpand}
              onUpdateField={updateTestField}
              onTypeChange={handleTypeChange}
              onMove={handleMove}
              onClone={handleClone}
              onAddSub={handleAddSubTest}
              onDeleteClick={handleDeleteClick}
              renderSubTests={renderSubTests}
          />
      ));
  }, [expandedPanels, searchTerm, toggleExpand, updateTestField, handleTypeChange, handleMove, handleClone, handleAddSubTest, handleDeleteClick]);

  return (
    <div className="space-y-6 pb-20 relative">
      {/* HEADER & STATS */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                    <FolderTree className="text-blue-600" size={32}/>
                    Genel Test Havuzu
                </h2>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-medium text-slate-500 bg-white px-4 py-2 rounded-full border border-slate-200 w-fit shadow-sm">
                    <span className="flex items-center gap-1.5"><LayoutList size={14} className="text-blue-500"/> <b className="text-slate-800">{stats.totalItems}</b> Toplam Tanım</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="flex items-center gap-1.5"><Layers size={14} className="text-indigo-500"/> <b className="text-slate-800">{stats.panels}</b> Panel</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="flex items-center gap-1.5"><Hash size={14} className="text-blue-500"/> <b className="text-slate-800">{stats.numeric}</b> Sayısal</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="flex items-center gap-1.5"><AlignLeft size={14} className="text-slate-500"/> <b className="text-slate-800">{stats.text}</b> Metin</span>
                </div>
            </div>
            
            <div className="flex items-center gap-3">
                {isDirty && (
                     <button 
                        onClick={handleDiscard}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        <RotateCcw size={16} />
                        Vazgeç
                    </button>
                )}
                
                <button 
                onClick={handleSave}
                disabled={!isDirty}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 ${
                    isDirty 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                }`}
                >
                <Save size={18} />
                {isDirty ? 'Değişiklikleri Kaydet' : 'Kaydedildi'}
                </button>
            </div>
        </div>

        {/* TOOLBAR */}
        <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-20 z-20">
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 lg:items-center lg:justify-between">

                {/* ── SOL: Arama + Filtre ── */}
                <div className="flex items-center gap-3 flex-1 lg:flex-initial">
                    <div className="relative flex-1 lg:w-72 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder="Test adı veya kodu ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-shadow shadow-sm"
                        />
                    </div>
                    <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
                        <button onClick={() => setTypeFilter('all')} className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${typeFilter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Tümü</button>
                        <button onClick={() => setTypeFilter('numeric')} className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${typeFilter === 'numeric' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}><Hash size={12}/> Sayısal</button>
                        <button onClick={() => setTypeFilter('text')} className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${typeFilter === 'text' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}><AlignLeft size={12}/> Metin</button>
                    </div>
                </div>

                {/* ── SAĞ: Aksiyonlar ── */}
                <div className="flex items-center gap-2 flex-wrap justify-end">

                    {/* Görünüm kontrolleri */}
                    <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-100">
                        <button onClick={expandAll} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all" title="Tüm panelleri aç">
                            <ChevronDown size={14} strokeWidth={2.5}/> Aç
                        </button>
                        <button onClick={collapseAll} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all" title="Tüm panelleri kapat">
                            <ChevronRight size={14} strokeWidth={2.5}/> Kapat
                        </button>
                    </div>

                    {/* İçe/Dışa aktarma */}
                    <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-100">
                        <button onClick={handleExport} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all" title="Test havuzunu JSON olarak dışa aktar">
                            <Download size={14}/> Dışa
                        </button>
                        <button onClick={() => importFileRef.current?.click()} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-all" title="JSON dosyasından test havuzu içe aktar">
                            <Upload size={14}/> İçe
                        </button>
                        <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
                    </div>

                    {/* Şablon Ekle */}
                    <div className="relative">
                        <button
                            onClick={() => setShowPresetMenu(!showPresetMenu)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-100 transition-all"
                            title="Hazır test paneli ekle"
                        >
                            <Zap size={14} />
                            Şablon
                        </button>
                        {showPresetMenu && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl py-2 z-50 w-56 animate-in fade-in slide-in-from-top-2">
                                {PRESET_CATEGORIES.map(cat => (
                                    <button
                                        key={cat.label}
                                        onClick={() => addPreset(cat.tests)}
                                        className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors flex items-center gap-2"
                                    >
                                        <span>{cat.icon}</span>
                                        {cat.label}
                                        <span className="ml-auto text-[10px] text-slate-400">{cat.tests.length} test</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Birincil aksiyon */}
                    <button
                        onClick={handleAddRootTest}
                        className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 font-bold text-sm px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-200 active:scale-95"
                    >
                        <Plus size={16} />
                        Yeni Test
                    </button>
                </div>
            </div>
        </div>

        {/* DOĞRULAMA UYARILARI */}
        {validationWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-700">{validationWarnings.length} doğrulama uyarısı</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {validationWarnings.slice(0, 10).map((w, i) => (
                        <span key={i} className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200">{w}</span>
                    ))}
                    {validationWarnings.length > 10 && (
                        <span className="text-[10px] text-slate-400">+{validationWarnings.length - 10} daha</span>
                    )}
                </div>
            </div>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200 text-xs uppercase tracking-wider backdrop-blur-sm">
                <tr>
                <th className="px-6 py-4 w-[28%] pl-10">Test Adı / Kod</th>
                <th className="px-4 py-4 w-[12%]">Kategori</th>
                <th className="px-4 py-4 w-[10%]">Veri Tipi</th>
                <th className="px-4 py-4 w-[8%] text-center">Birim</th>
                <th className="px-4 py-4 w-[18%] text-center">Referans Aralığı</th>
                <th className="px-4 py-4 w-[13%] text-center">Liste Fiyatı</th>
                <th className="px-4 py-4 w-[15%] text-right pr-8">İşlemler</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {filteredTests.length > 0 ? (
                    paginatedTests.map((test, i) => (
                        <TestRow
                            key={test.id}
                            test={test}
                            depth={0}
                            index={startIndex + i}
                            siblingsCount={filteredTests.length}
                            expandedPanels={expandedPanels}
                            searchTerm={searchTerm}
                            onToggleExpand={toggleExpand}
                            onUpdateField={updateTestField}
                            onTypeChange={handleTypeChange}
                            onMove={handleMove}
                            onClone={handleClone}
                            onAddSub={handleAddSubTest}
                            onDeleteClick={handleDeleteClick}
                            renderSubTests={renderSubTests}
                        />
                    ))
                ) : (
                    <tr>
                        <td colSpan={7} className="py-24 text-center text-slate-400 bg-slate-50/30">
                            <div className="flex flex-col items-center justify-center">
                                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                    <Search className="opacity-20 text-slate-800" size={40} />
                                </div>
                                <p className="font-bold text-slate-600">Aradığınız kriterlere uygun test bulunamadı.</p>
                                <p className="text-xs mt-1">Lütfen arama terimini değiştirin veya filtreleri kaldırın.</p>
                                <button onClick={() => { setSearchTerm(''); setTypeFilter('all'); }} className="mt-4 text-blue-600 hover:text-blue-700 font-bold text-xs bg-blue-50 px-4 py-2 rounded-lg transition-colors">Filtreleri Temizle</button>
                            </div>
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>
        
        {/* Sayfalama */}
        <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={pagedTotal}
            startIndex={startIndex}
            endIndex={endIndex}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 15, 25, 50, 100]}
            itemName="test"
        />
      </div>

      {/* --- DELETE CONFIRMATION MODAL --- */}
      <ConfirmModal
          open={deletingId !== null}
          title="Testi Sil"
          message="Bu testi silmek üzeresiniz. Panel ise alt parametreler de silinecektir."
          confirmLabel="Evet, Sil"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingId(null)}
      />

      {/* --- DISCARD CONFIRM MODAL --- */}
      <ConfirmModal
          open={discardConfirm}
          title="Değişiklikleri Geri Al"
          message="Yapılan tüm değişiklikler geri alınacak. Emin misiniz?"
          confirmLabel="Geri Al"
          variant="warning"
          onConfirm={doDiscard}
          onCancel={() => setDiscardConfirm(false)}
      />

      {/* --- IMPORT CONFIRM MODAL --- */}
      <ConfirmModal
          open={importConfirm !== null}
          title="Test Havuzunu İçe Aktar"
          message={`${importConfirm?.count} test tanımı içe aktarılacak. Mevcut liste değiştirilecek.`}
          confirmLabel="İçe Aktar"
          variant="info"
          onConfirm={doImport}
          onCancel={() => setImportConfirm(null)}
      />

      {/* --- IMPORT ERROR MODAL --- */}
      <ConfirmModal
          open={importError !== null}
          title="İçe Aktarma Hatası"
          message={importError || ''}
          confirmLabel="Tamam"
          variant="warning"
          onConfirm={() => setImportError(null)}
          onCancel={() => setImportError(null)}
      />

      {/* --- NEW TEST MODAL --- */}
      {newTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setNewTestModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  <div className="p-5 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
                      <h3 className="font-bold text-base flex items-center gap-2"><Plus size={18} className="text-blue-400"/> Yeni {isPanel ? 'Panel' : 'Test'} Ekle</h3>
                      <button onClick={() => setNewTestModal(false)} className="text-slate-400 hover:text-white transition-colors p-1">
                          <X size={18}/>
                      </button>
                  </div>

                  <div className="p-5 space-y-4">

                      {/* Mod seçici: Test / Panel */}
                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                          <button
                              type="button"
                              onClick={() => { setIsPanel(false); setSubParams([{ name: '', unit: '', min: '', max: '' }]); }}
                              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${!isPanel ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                          >
                              <Hash size={13}/> Tek Test
                          </button>
                          <button
                              type="button"
                              onClick={() => setIsPanel(true)}
                              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${isPanel ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                          >
                              <Layers size={13}/> Panel (Alt Parametreli)
                          </button>
                      </div>

                      {/* Test/Panel Adı + Otomatik tamamlama */}
                      <div className="relative">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">
                              {isPanel ? 'Panel Adı *' : 'Test Adı *'}
                          </label>
                          <input
                              type="text"
                              value={newTestForm.name}
                              onChange={e => setNewTestForm(p => ({ ...p, name: e.target.value }))}
                              className={`w-full border rounded-xl text-sm focus:ring-2 p-2.5 bg-slate-50 focus:bg-white transition-all font-medium ${isDuplicateName ? 'border-amber-400 focus:ring-amber-400 focus:border-amber-400' : 'border-slate-200 focus:ring-blue-500 focus:border-blue-500'}`}
                              placeholder={isPanel ? 'Örn: Hemogram' : 'Örn: Glikoz'}
                              autoFocus
                          />
                          {/* Öneri listesi */}
                          {nameSuggestions.length > 0 && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                                  {nameSuggestions.map(s => (
                                      <button
                                          key={s}
                                          type="button"
                                          onClick={() => setNewTestForm(p => ({ ...p, name: s }))}
                                          className="w-full text-left px-3 py-2 text-xs font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                                      >
                                          <Search size={11} className="text-slate-300"/> {s}
                                      </button>
                                  ))}
                              </div>
                          )}
                          {/* Tekrar uyarısı */}
                          {isDuplicateName && (
                              <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                                  <AlertTriangle size={11}/> Bu isimde bir test zaten var
                              </p>
                          )}
                      </div>

                      {/* Kategori */}
                      <div>
                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Kategori</label>
                          <select
                              value={newTestForm.category}
                              onChange={e => setNewTestForm(p => ({ ...p, category: e.target.value }))}
                              className="w-full border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-slate-50 focus:bg-white transition-all font-medium cursor-pointer"
                          >
                              {TEST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                      </div>

                      {/* ── TEK TEST MODU ── */}
                      {!isPanel && (
                          <>
                              <div className="grid grid-cols-2 gap-3">
                                  <div>
                                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Veri Tipi</label>
                                      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                                          <button
                                              type="button"
                                              onClick={() => setNewTestForm(p => ({ ...p, type: 'numeric' }))}
                                              className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${newTestForm.type === 'numeric' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                          >
                                              <Hash size={12}/> Sayısal
                                          </button>
                                          <button
                                              type="button"
                                              onClick={() => setNewTestForm(p => ({ ...p, type: 'text' }))}
                                              className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold transition-all ${newTestForm.type === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                                          >
                                              <AlignLeft size={12}/> Metin
                                          </button>
                                      </div>
                                  </div>
                                  <div>
                                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Birim</label>
                                      <input
                                          type="text"
                                          value={newTestForm.unit}
                                          onChange={e => setNewTestForm(p => ({ ...p, unit: e.target.value }))}
                                          className="w-full border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-slate-50 focus:bg-white transition-all font-medium"
                                          placeholder="mg/dL"
                                      />
                                  </div>
                              </div>

                              {newTestForm.type === 'numeric' && (
                                  <div className="grid grid-cols-2 gap-3">
                                      <div>
                                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Min Referans</label>
                                          <input
                                              type="number"
                                              value={newTestForm.min}
                                              onChange={e => setNewTestForm(p => ({ ...p, min: e.target.value }))}
                                              className="w-full border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-slate-50 focus:bg-white transition-all font-medium"
                                              placeholder="0"
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Max Referans</label>
                                          <input
                                              type="number"
                                              value={newTestForm.max}
                                              onChange={e => setNewTestForm(p => ({ ...p, max: e.target.value }))}
                                              className="w-full border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 p-2.5 bg-slate-50 focus:bg-white transition-all font-medium"
                                              placeholder="100"
                                          />
                                      </div>
                                  </div>
                              )}

                              {/* Referans önizleme kartı */}
                              {newTestForm.name.trim() && (
                                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Önizleme</p>
                                      <div className="flex items-center justify-between">
                                          <div>
                                              <p className="text-sm font-bold text-slate-800">{newTestForm.name}</p>
                                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">#{newTestForm.name.trim().toLowerCase().replace(/\s+/g, '_')}</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                              {newTestForm.type === 'numeric' ? (
                                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-50 border border-blue-100 text-blue-600 px-2 py-1 rounded-lg">
                                                      <Hash size={10}/> Sayısal
                                                  </span>
                                              ) : (
                                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600 px-2 py-1 rounded-lg">
                                                      <AlignLeft size={10}/> Metin
                                                  </span>
                                              )}
                                              {newTestForm.unit && (
                                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{newTestForm.unit}</span>
                                              )}
                                          </div>
                                      </div>
                                      {newTestForm.type === 'numeric' && (newTestForm.min || newTestForm.max) && (
                                          <div className="mt-3 pt-3 border-t border-slate-200">
                                              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
                                                  <span>Referans Aralığı</span>
                                                  <span className="text-emerald-600">{newTestForm.min || '—'} – {newTestForm.max || '—'} {newTestForm.unit}</span>
                                              </div>
                                              <div className="relative h-2 bg-slate-200 rounded-full">
                                                  <div className="absolute h-full bg-emerald-400 rounded-full" style={{ left: '20%', right: '20%' }} />
                                                  <div className="absolute -top-0.5 w-3 h-3 bg-blue-600 rounded-full shadow" style={{ left: '50%', transform: 'translateX(-50%)' }} />
                                              </div>
                                              <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                                                  <span>Düşük</span><span>Normal</span><span>Yüksek</span>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              )}
                          </>
                      )}

                      {/* ── PANEL MODU — alt parametreler ── */}
                      {isPanel && (
                          <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                  <label className="text-[11px] font-bold text-slate-500 uppercase">Alt Parametreler ({subParams.filter(s => s.name.trim()).length})</label>
                                  <button
                                      type="button"
                                      onClick={() => setSubParams(prev => [...prev, { name: '', unit: '', min: '', max: '' }])}
                                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                  >
                                      <Plus size={11}/> Parametre Ekle
                                  </button>
                              </div>
                              {subParams.map((sub, i) => (
                                  <div key={i} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                                      <input
                                          type="text"
                                          value={sub.name}
                                          onChange={e => setSubParams(prev => prev.map((s, idx) => idx === i ? { ...s, name: e.target.value } : s))}
                                          className="flex-1 border border-slate-200 rounded-lg text-xs p-2 bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 font-medium"
                                          placeholder="Parametre adı (örn: WBC)"
                                      />
                                      <input
                                          type="text"
                                          value={sub.unit}
                                          onChange={e => setSubParams(prev => prev.map((s, idx) => idx === i ? { ...s, unit: e.target.value } : s))}
                                          className="w-16 border border-slate-200 rounded-lg text-xs p-2 bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-center font-medium"
                                          placeholder="birim"
                                      />
                                      <input
                                          type="number"
                                          value={sub.min}
                                          onChange={e => setSubParams(prev => prev.map((s, idx) => idx === i ? { ...s, min: e.target.value } : s))}
                                          className="w-14 border border-slate-200 rounded-lg text-xs p-2 bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-center font-medium"
                                          placeholder="min"
                                      />
                                      <input
                                          type="number"
                                          value={sub.max}
                                          onChange={e => setSubParams(prev => prev.map((s, idx) => idx === i ? { ...s, max: e.target.value } : s))}
                                          className="w-14 border border-slate-200 rounded-lg text-xs p-2 bg-white focus:ring-1 focus:ring-blue-400 focus:border-blue-400 text-center font-medium"
                                          placeholder="maks"
                                      />
                                      {subParams.length > 1 && (
                                          <button
                                              type="button"
                                              onClick={() => setSubParams(prev => prev.filter((_, idx) => idx !== i))}
                                              className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                          >
                                              <Trash2 size={13}/>
                                          </button>
                                      )}
                                  </div>
                              ))}
                              {subParams.filter(s => s.name.trim()).length === 0 && (
                                  <p className="text-[10px] text-slate-400 text-center py-2">En az bir alt parametre girin</p>
                              )}
                          </div>
                      )}
                  </div>

                  <div className="p-5 pt-0 flex gap-3 sticky bottom-0 bg-white">
                      <button
                          onClick={() => setNewTestModal(false)}
                          className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold text-sm transition-all"
                      >
                          İptal
                      </button>
                      <button
                          onClick={confirmAddRootTest}
                          disabled={!newTestForm.name.trim() || (isPanel && subParams.filter(s => s.name.trim()).length === 0)}
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                          <Plus size={16}/> Ekle
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};