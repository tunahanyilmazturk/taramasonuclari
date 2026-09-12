import React, { useState, useMemo, useRef } from 'react';
import { TestDefinition, TestType } from '../types';
import { ConfirmModal } from './ConfirmModal';
import { 
  Trash2, Plus, Save, ChevronRight, ChevronDown, FolderTree, 
  Search, ArrowUp, ArrowDown, AlignLeft, Copy, RotateCcw, LayoutList, Layers, Hash, AlertTriangle,
  Download, Upload, Zap
} from 'lucide-react';
import { DEFAULT_TESTS, TEST_DEFAULT_PRICES, TEST_CATEGORIES, testCategory } from '../constants';

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
                            <div className="flex items-center gap-2">
                                <div className="text-[10px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                                    #{test.key}
                                </div>
                                {depth === 0 && (
                                    <select
                                        value={testCategory(test)}
                                        onChange={(e) => onUpdateField(test.id, 'category', e.target.value)}
                                        title="Kategori — teklifte testleri gruplu seçmeyi sağlar"
                                        className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-200 cursor-pointer"
                                    >
                                        {TEST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>
                    </div>
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
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-1 w-fit mx-auto group/price focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
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
                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
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
  const importFileRef = useRef<HTMLInputElement>(null);

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
          { label: 'Muayene & Görüntüleme', icon: '🏥', tests: DEFAULT_TESTS.filter(t => ['akciger_grafisi','odyometri','goz','ekg','tetanoz','kan_grubu','sft'].includes(t.key)) },
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
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].id) {
                  setImportConfirm({ data: parsed, count: parsed.length });
              } else {
                  setImportError('Geçersiz format. JSON array bekleniyor.');
              }
          } catch {
              setImportError('JSON okunamadı.');
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
                        return { ...t, name: nameVal, key: nameVal.toLowerCase().replace(/\s+/g, '_') };
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
    const uniqueId = `root-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const newTest: TestDefinition = {
      id: uniqueId,
      name: 'Yeni Test',
      key: `yeni_test_${Math.floor(Math.random() * 1000)}`,
      unit: '',
      type: 'numeric',
      range: { min: 0, max: 100 }
    };
    setEditingTests(prev => [...prev, newTest]);
    setIsDirty(true);
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

  // --- FILTERING ---
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
                    <span className="flex items-center gap-1.5"><Hash size={14} className="text-emerald-500"/> <b className="text-slate-800">{stats.numeric}</b> Sayısal</span>
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
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-20 z-20">
             <div className="flex items-center gap-3 w-full lg:w-auto">
                 <div className="relative flex-1 lg:w-80 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
                    <input 
                        type="text" 
                        placeholder="Test adı veya kodu ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-shadow shadow-sm"
                    />
                 </div>
                 
                 <div className="h-8 w-px bg-slate-200 hidden sm:block mx-1"></div>
                 
                 <div className="flex bg-slate-100 p-1 rounded-xl">
                     <button onClick={() => setTypeFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${typeFilter === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Tümü</button>
                     <button onClick={() => setTypeFilter('numeric')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${typeFilter === 'numeric' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}><Hash size={12}/> Sayısal</button>
                     <button onClick={() => setTypeFilter('text')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${typeFilter === 'text' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}><AlignLeft size={12}/> Metin</button>
                 </div>
             </div>

             <div className="flex items-center gap-2 w-full lg:w-auto justify-end flex-wrap">
                  {/* Hızlı Şablon Ekle */}
                  <div className="relative">
                      <button
                          onClick={() => setShowPresetMenu(!showPresetMenu)}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-100 transition-all"
                          title="Hazır test paneli ekle"
                      >
                          <Zap size={14} />
                          Şablon Ekle
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

                  <button onClick={expandAll} className="text-xs font-bold text-slate-500 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                      + Tümünü Aç
                  </button>
                   <button onClick={collapseAll} className="text-xs font-bold text-slate-500 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors">
                      - Tümünü Kapat
                  </button>

                  <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>

                  <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-emerald-50 rounded-lg transition-all" title="Test havuzunu JSON olarak dışa aktar">
                      <Download size={14} />
                  </button>
                  <button onClick={() => importFileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 rounded-lg transition-all" title="JSON dosyasından test havuzu içe aktar">
                      <Upload size={14} />
                  </button>
                  <input ref={importFileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

                  <button 
                    onClick={handleAddRootTest}
                    className="ml-1 flex items-center gap-2 text-white bg-slate-900 hover:bg-slate-800 font-bold text-sm px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-slate-200 hover:-translate-y-0.5"
                >
                    <Plus size={18} />
                    Yeni Test Ekle
                </button>
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
                <th className="px-6 py-4 w-[33%] pl-10">Test Adı / Kod</th>
                <th className="px-4 py-4 w-[13%]">Veri Tipi</th>
                <th className="px-4 py-4 w-[8%] text-center">Birim</th>
                <th className="px-4 py-4 w-[18%] text-center">Referans Aralığı</th>
                <th className="px-4 py-4 w-[13%] text-center">Liste Fiyatı</th>
                <th className="px-4 py-4 w-[15%] text-right pr-8">İşlemler</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {filteredTests.length > 0 ? (
                    filteredTests.map((test, i, arr) => (
                        <TestRow 
                            key={test.id}
                            test={test}
                            depth={0}
                            index={i}
                            siblingsCount={arr.length}
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
                        <td colSpan={5} className="py-24 text-center text-slate-400 bg-slate-50/30">
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
        
        {/* Footer Info */}
        <div className="p-4 bg-slate-50 text-[11px] text-slate-400 text-center border-t border-slate-100 font-medium">
            Toplam {editingTests.length} ana test ve alt parametreleri listeleniyor. Sıralamayı değiştirmek için okları kullanın.
        </div>
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
    </div>
  );
};