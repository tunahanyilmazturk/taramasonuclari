import React, { useState } from 'react';
import { ConfirmModal } from './ConfirmModal';
import { KeyRound, Eye, EyeOff, Save, RotateCcw, Sparkles, Cpu, FlaskConical, FileSignature, Zap, CheckCircle, XCircle, Loader2, ShieldAlert, Plus, Trash2, Pencil, ArrowUp, ArrowDown, Check, X, Star, ChevronDown, Layers, Globe, HardDrive } from 'lucide-react';
import { aiConfigService, PRESET_MODELS, DEFAULT_MODELS, CATEGORY_LABELS, AiPurpose, CustomModel, ModelCategory, AiProvider } from '../services/aiConfigService';
import { testAiConnection } from '../services/geminiService';

interface AiSettingsProps {
    addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
}

export const AiSettings: React.FC<AiSettingsProps> = ({ addNotification }) => {
    const [provider, setProvider] = useState<AiProvider>(aiConfigService.getProvider());
    const [apiKeyInput, setApiKeyInput] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [hasCustomKey, setHasCustomKey] = useState(aiConfigService.hasCustomApiKey());
    const [models, setModels] = useState<Record<AiPurpose, string>>(aiConfigService.getModels());
    const [customModels, setCustomModels] = useState<CustomModel[]>(aiConfigService.getCustomModels());
    const [category, setCategory] = useState<ModelCategory>(aiConfigService.getCategory());
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

    // Yeni model ekleme formu
    const [newModelName, setNewModelName] = useState('');
    const [newModelLabel, setNewModelLabel] = useState('');

    // Düzenleme durumu
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editLabel, setEditLabel] = useState('');
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; action: () => void } | null>(null);

    const hasAnyKey = hasCustomKey || !!process.env.API_KEY?.trim();

    // Seçili kategoriye göre filtrelenmiş modeller (dropdown için)
    const categoryModels = aiConfigService.getModelsByCategory(category);
    // Dropdown'da hem kategori modelleri hem de halihazırda seçili olan model görünür
    const dropdownModels = category === 'custom'
        ? categoryModels
        : categoryModels.filter(m => m.name === models.extraction || m.name === models.comment || true);

    const handleSaveKey = () => {
        if (!apiKeyInput.trim()) {
            addNotification('error', 'Lütfen bir API anahtarı girin.');
            return;
        }
        aiConfigService.setApiKey(apiKeyInput);
        setApiKeyInput('');
        setHasCustomKey(true);
        setTestResult(null);
        addNotification('success', 'API anahtarı kaydedildi.');
    };

    const handleClearKey = () => {
        setConfirmAction({
            title: 'API Anahtarını Temizle',
            message: 'Özel API anahtarı silinsin mi? Varsayılan (.env) anahtarına dönülecek.',
            action: () => {
                aiConfigService.clearApiKey();
                setHasCustomKey(false);
                setTestResult(null);
                addNotification('info', 'Özel anahtar kaldırıldı. Ortam değişkeni kullanılacak.');
            }
        });
    };

    const handleModelChange = (purpose: AiPurpose, value: string) => {
        setModels(prev => ({ ...prev, [purpose]: value }));
        aiConfigService.setModel(purpose, value);
    };

    const handleResetModels = () => {
        aiConfigService.resetModels();
        setModels(aiConfigService.getModels());
        addNotification('info', 'Model seçimleri varsayılana döndürüldü.');
    };

    const refreshCustomModels = () => setCustomModels(aiConfigService.getCustomModels());

    const handleAddModel = () => {
        if (!newModelName.trim()) {
            addNotification('error', 'Model adı girin.');
            return;
        }
        const added = aiConfigService.addCustomModel(newModelName, newModelLabel);
        if (!added) {
            addNotification('error', 'Bu model zaten listede var.');
            return;
        }
        setNewModelName('');
        setNewModelLabel('');
        refreshCustomModels();
        addNotification('success', `"${added.name}" modele eklendi.`);
    };

    const handleStartEdit = (m: CustomModel) => {
        setEditingId(m.id);
        setEditName(m.name);
        setEditLabel(m.label || '');
    };

    const handleSaveEdit = () => {
        if (!editingId || !editName.trim()) return;
        aiConfigService.updateCustomModel(editingId, { name: editName, label: editLabel });
        setEditingId(null);
        refreshCustomModels();
        addNotification('success', 'Model güncellendi.');
    };

    const handleDeleteModel = (m: CustomModel) => {
        setConfirmAction({
            title: 'Modeli Sil',
            message: `"${m.name}" modelini silmek istediğinize emin misiniz?`,
            action: () => {
                aiConfigService.deleteCustomModel(m.id);
                refreshCustomModels();
                setModels(aiConfigService.getModels());
                addNotification('info', `"${m.name}" silindi.`);
            }
        });
    };

    const handleMoveModel = (id: string, direction: 'up' | 'down') => {
        aiConfigService.moveCustomModel(id, direction);
        refreshCustomModels();
    };

    const handleCategoryChange = (cat: ModelCategory) => {
        setCategory(cat);
        aiConfigService.setCategory(cat);
    };

    const handleProviderChange = (p: AiProvider) => {
        setProvider(p);
        aiConfigService.setProvider(p);
        setTestResult(null);
        addNotification('info', p === 'local'
            ? 'Yerel kural tabanlı sistem aktif — API key gerekmez, rate limit yok.'
            : 'Gemini AI aktif — API key gerekli.'
        );
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const reply = await testAiConnection();
            setTestResult({ ok: true, message: `Bağlantı başarılı. Yanıt: "${reply}"` });
            addNotification('success', 'Gemini bağlantısı doğrulandı.');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
            setTestResult({ ok: false, message: `Bağlantı başarısız: ${msg}` });
            addNotification('error', 'API bağlantısı kurulamadı.');
        } finally {
            setIsTesting(false);
        }
    };

    const keyStatus = hasCustomKey
        ? { text: 'Özel anahtar aktif', cls: 'bg-blue-100 text-blue-700' }
        : hasAnyKey
            ? { text: 'Ortam değişkeni (.env) kullanılıyor', cls: 'bg-slate-100 text-slate-600' }
            : { text: 'Anahtar tanımsız', cls: 'bg-red-100 text-red-700' };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <Sparkles className="text-blue-600" /> AI & API Ayarları
                </h2>
                <p className="text-sm text-slate-500 mt-1">Gemini API anahtarını ve AI özelliklerinde kullanılan modelleri yönetin.</p>
            </div>

            {/* PROVIDER SELECTOR */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Layers size={18} className="text-blue-500" /> AI Sağlayıcısı
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Sonuç çıkarma ve kanaat üretimi için kullanılacak AI altyapısını seçin.</p>
                </div>
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Gemini */}
                    <button
                        onClick={() => handleProviderChange('gemini')}
                        className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all text-center group ${
                            provider === 'gemini'
                            ? 'border-blue-500 bg-blue-50/50 shadow-md shadow-blue-100'
                            : 'border-slate-200 bg-slate-50/30 hover:border-slate-300'
                        }`}
                    >
                        <div className={`p-3 rounded-xl ${provider === 'gemini' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                            <Globe size={28} />
                        </div>
                        <div>
                            <p className={`font-bold text-sm ${provider === 'gemini' ? 'text-blue-700' : 'text-slate-700'}`}>Gemini AI</p>
                            <p className="text-[11px] text-slate-400 mt-1">Google'ın güçlü LLM'i. Esnek, akıllı, API key gerekli.</p>
                        </div>
                        {provider === 'gemini' && (
                            <div className="absolute top-3 right-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white">
                                <Check size={14} />
                            </div>
                        )}
                    </button>

                    {/* Yerel Sistem */}
                    <button
                        onClick={() => handleProviderChange('local')}
                        className={`relative flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all text-center group ${
                            provider === 'local'
                            ? 'border-emerald-500 bg-emerald-50/50 shadow-md shadow-emerald-100'
                            : 'border-slate-200 bg-slate-50/30 hover:border-slate-300'
                        }`}
                    >
                        <div className={`p-3 rounded-xl ${provider === 'local' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                            <HardDrive size={28} />
                        </div>
                        <div>
                            <p className={`font-bold text-sm ${provider === 'local' ? 'text-emerald-700' : 'text-slate-700'}`}>Yerel Sistem</p>
                            <p className="text-[11px] text-slate-400 mt-1">Kural tabanlı çıkarma. API key yok, rate limit yok, anında.</p>
                        </div>
                        {provider === 'local' && (
                            <div className="absolute top-3 right-3 w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-white">
                                <Check size={14} />
                            </div>
                        )}
                    </button>
                </div>
            </div>

            {/* API KEY CARD — sadece Gemini seçiliyse */}
            {provider === 'gemini' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <KeyRound size={18} className="text-amber-500" /> API Anahtarı
                    </h3>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${keyStatus.cls}`}>
                        {keyStatus.text}
                    </span>
                </div>
                <div className="p-5 space-y-4">
                    <div className="flex gap-3">
                        <div className="relative flex-1">
                            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type={showKey ? 'text' : 'password'}
                                value={apiKeyInput}
                                onChange={(e) => setApiKeyInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                                placeholder={hasCustomKey ? '••••••••••••  (yeni anahtar girerek değiştirin)' : 'AIza... ile başlayan Gemini API anahtarı'}
                                className="w-full pl-10 pr-11 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all font-mono"
                                autoComplete="off"
                            />
                            <button
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                title={showKey ? 'Gizle' : 'Göster'}
                            >
                                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>
                        <button
                            onClick={handleSaveKey}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-md shadow-blue-200 active:scale-95"
                        >
                            <Save size={16} /> Kaydet
                        </button>
                        {hasCustomKey && (
                            <button
                                onClick={handleClearKey}
                                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                            >
                                <RotateCcw size={16} /> Varsayılana Dön
                            </button>
                        )}
                    </div>

                    <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800">
                        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                        <p className="text-xs leading-relaxed">
                            Anahtar yalnızca bu tarayıcının <b>localStorage</b>'ında saklanır ve hiçbir sunucuya gönderilmez.
                            Ancak istemci tarafı uygulamada anahtar cihazdaki diğer kullanıcılar tarafından görülebilir — paylaşılan cihazlarda dikkatli olun.
                        </p>
                    </div>
                </div>
            </div>
            )}

            {/* MODELS CARD — sadece Gemini seçiliyse */}
            {provider === 'gemini' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Cpu size={18} className="text-indigo-500" /> Model Yönetimi
                    </h3>
                    <button
                        onClick={handleResetModels}
                        className="text-xs font-bold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 transition-colors"
                    >
                        <RotateCcw size={13} /> Seçimleri Sıfırla
                    </button>
                </div>

                {/* Kategori Seçici */}
                <div className="px-5 pt-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Layers size={12} /> Model Kategorisi
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {(Object.entries(CATEGORY_LABELS) as [ModelCategory, string][]).map(([cat, label]) => {
                            const count = cat === 'custom' ? customModels.length : aiConfigService.getModelsByCategory(cat).length;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => handleCategoryChange(cat)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                        category === cat
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {label}
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] tabular-nums ${
                                        category === cat ? 'bg-white/20' : 'bg-white text-slate-500'
                                    }`}>{count}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Amaç → Model atama */}
                <div className="p-5 space-y-5 border-b border-slate-100 mt-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Amaç Bazında Model Atama</p>
                    {([
                        { purpose: 'extraction' as AiPurpose, icon: FlaskConical, title: 'PDF Sonuç Çıkarma', desc: 'PDF raporlardan tahlil sonuçlarını okuyan model. Doğruluk kritik.' },
                        { purpose: 'comment' as AiPurpose, icon: FileSignature, title: 'Otomatik Kanaat / Yorum', desc: 'Hasta raporlarına otomatik tıbbi özet yazan model.' }
                    ]).map(({ purpose, icon: Icon, title, desc }) => (
                        <div key={purpose} className="flex flex-col md:flex-row md:items-center gap-3">
                            <div className="flex items-center gap-3 md:w-72 shrink-0">
                                <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Icon size={18} /></div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700">{title}</p>
                                    <p className="text-[11px] text-slate-400 leading-snug">{desc}</p>
                                </div>
                            </div>
                            <div className="flex-1 relative">
                                <select
                                    value={models[purpose]}
                                    onChange={(e) => handleModelChange(purpose, e.target.value)}
                                    className="w-full appearance-none px-4 py-2.5 pr-10 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-mono cursor-pointer"
                                >
                                    {/* Seçili kategoriden modeller */}
                                    {dropdownModels.map(m => (
                                        <option key={m.id} value={m.name}>
                                            {m.label ? `${m.name} — ${m.label}` : m.name}
                                        </option>
                                    ))}
                                    {/* Seçili model kategori dışındaysa, ayrı bir grupta göster */}
                                    {!dropdownModels.some(m => m.name === models[purpose]) && (
                                        <option value={models[purpose]}>{models[purpose]} (diğer kategori)</option>
                                    )}
                                </select>
                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    ))}
                    <p className="text-[11px] text-slate-400">Kategori seçtikçe yukarıdaki dropdown listesi otomatik güncellenir. Farklı kategoriden bir model seçiliyse "diğer kategori" olarak görünür.</p>
                </div>

                {/* Model Listesi — seçili kategoriye göre */}
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                            {CATEGORY_LABELS[category]} ({categoryModels.length})
                        </p>
                        <span className="text-[10px] text-slate-400">{customModels.length} özel · {PRESET_MODELS.length} hazır toplam</span>
                    </div>

                    {/* Özel modeller (sadece custom kategorisinde yönetilebilir) */}
                    {category === 'custom' ? (
                        customModels.length > 0 ? (
                            <div className="space-y-2">
                                {customModels.map((m, idx) => (
                                    <div key={m.id} className="group flex items-center gap-3 p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl hover:border-indigo-200 transition-colors">
                                        <div className="flex flex-col gap-0.5">
                                            <button
                                                onClick={() => handleMoveModel(m.id, 'up')}
                                                disabled={idx === 0}
                                                className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ArrowUp size={12} />
                                            </button>
                                            <button
                                                onClick={() => handleMoveModel(m.id, 'down')}
                                                disabled={idx === customModels.length - 1}
                                                className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <ArrowDown size={12} />
                                            </button>
                                        </div>

                                        {editingId === m.id ? (
                                            <div className="flex-1 flex flex-col sm:flex-row gap-2">
                                                <input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    placeholder="Model ID"
                                                    className="flex-1 px-3 py-1.5 text-sm border border-indigo-200 rounded-lg font-mono focus:ring-2 focus:ring-indigo-100"
                                                    autoFocus
                                                />
                                                <input
                                                    value={editLabel}
                                                    onChange={(e) => setEditLabel(e.target.value)}
                                                    placeholder="Etiket (opsiyonel)"
                                                    className="flex-1 px-3 py-1.5 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-100"
                                                />
                                                <div className="flex gap-1">
                                                    <button onClick={handleSaveEdit} className="p-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"><Check size={15} /></button>
                                                    <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300 transition-colors"><X size={15} /></button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-700 font-mono truncate">{m.name}</p>
                                                    {m.label && <p className="text-[11px] text-slate-400 truncate">{m.label}</p>}
                                                </div>
                                                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0">Özel</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleStartEdit(m)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Düzenle"><Pencil size={14} /></button>
                                                    <button onClick={() => handleDeleteModel(m)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sil"><Trash2 size={14} /></button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                                <Cpu size={28} className="mx-auto mb-2 opacity-40" />
                                <p className="text-sm font-medium">Henüz özel model eklenmedi.</p>
                                <p className="text-xs mt-1">Aşağıdaki formdan yeni model ekleyin.</p>
                            </div>
                        )
                    ) : (
                        /* Hazır modeller (salt okunur, kategoriye göre filtreli) */
                        <div className="space-y-2">
                            {categoryModels.map(m => {
                                const isDefault = m.name === DEFAULT_MODELS.extraction;
                                const isSelected = m.name === models.extraction || m.name === models.comment;
                                return (
                                    <div key={m.id} className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                                        isSelected ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50/60 border-slate-100'
                                    }`}>
                                        <Star size={14} className={`shrink-0 ${isDefault ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-slate-600 font-mono truncate">{m.name}</p>
                                            {m.label && <p className="text-[11px] text-slate-400 truncate">{m.label}</p>}
                                        </div>
                                        {isSelected && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0">Seçili</span>}
                                        <span className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded-full text-[9px] font-bold uppercase tracking-wide shrink-0">Hazır</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Yeni model ekleme formu (sadece custom kategorisinde) */}
                    {category === 'custom' && (
                        <div className="pt-3 border-t border-slate-100">
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    value={newModelName}
                                    onChange={(e) => setNewModelName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                                    placeholder="Model ID (örn: gemini-2.0-flash)"
                                    className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all font-mono"
                                />
                                <input
                                    value={newModelLabel}
                                    onChange={(e) => setNewModelLabel(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddModel()}
                                    placeholder="Etiket (opsiyonel)"
                                    className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                                />
                                <button
                                    onClick={handleAddModel}
                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 shadow-md shadow-indigo-200 active:scale-95 shrink-0"
                                >
                                    <Plus size={16} /> Ekle
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2">Model ID'sini Gemini API dokümanından kopyalayın. Aynı ID tekrar eklenemez.</p>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* CONNECTION TEST CARD — sadece Gemini seçiliyse */}
            {provider === 'gemini' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Zap size={18} className="text-emerald-500" /> Bağlantı Testi</h3>
                        <p className="text-xs text-slate-400 mt-1">Mevcut anahtar ve model ile Gemini'ye küçük bir istek gönderir.</p>
                    </div>
                    <button
                        onClick={handleTest}
                        disabled={isTesting || !hasAnyKey}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-md"
                    >
                        {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                        {isTesting ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
                    </button>
                </div>
                {testResult && (
                    <div className={`mx-5 mb-5 p-3.5 rounded-xl border flex items-start gap-2.5 text-sm animate-in fade-in slide-in-from-top-1 ${
                        testResult.ok ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                    }`}>
                        {testResult.ok ? <CheckCircle size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
                        <span className="font-medium">{testResult.message}</span>
                    </div>
                )}
            </div>
            )}

            {/* Confirm Modal */}
            <ConfirmModal
                open={confirmAction !== null}
                title={confirmAction?.title || ''}
                message={confirmAction?.message || ''}
                confirmLabel="Evet"
                onConfirm={() => { confirmAction?.action(); setConfirmAction(null); }}
                onCancel={() => setConfirmAction(null)}
            />
        </div>
    );
};
