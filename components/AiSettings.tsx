import React, { useState } from 'react';
import { ConfirmModal } from './ConfirmModal';
import {
    Sparkles, KeyRound, Eye, EyeOff, Save, RotateCcw, Zap, CheckCircle, XCircle,
    Loader2, ShieldAlert, Plus, Trash2, ChevronDown, Globe, HardDrive, Cpu,
    Check, ExternalLink, FlaskConical, FileSignature
} from 'lucide-react';
import {
    aiConfigService, PRESET_MODELS, AiPurpose, CustomModel,
    AiProvider, OPENROUTER_MODELS
} from '../services/aiConfigService';
import { testAiConnection } from '../services/geminiService';

interface AiSettingsProps {
    addNotification: (type: 'success' | 'error' | 'info', message: string) => void;
}

// Sağlayıcı meta verisi
const PROVIDERS: {
    key: AiProvider;
    name: string;
    desc: string;
    icon: React.ElementType;
    color: string;
    accent: string;
    badge?: string;
    link?: string;
}[] = [
    {
        key: 'gemini',
        name: 'Gemini',
        desc: 'Google AI — akıllı, esnek',
        icon: Globe,
        color: 'blue',
        accent: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 focus:ring-blue-100 focus:border-blue-400',
        link: 'https://aistudio.google.com/apikey'
    },
    {
        key: 'openrouter',
        name: 'OpenRouter',
        desc: 'GLM-5.2 & Llama — ücretsiz',
        icon: Sparkles,
        color: 'emerald',
        accent: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 focus:ring-emerald-100 focus:border-emerald-400',
        badge: 'Ücretsiz',
        link: 'https://openrouter.ai/keys'
    },
    {
        key: 'local',
        name: 'Yerel Sistem',
        desc: 'Kural tabanlı — anahtar yok',
        icon: HardDrive,
        color: 'slate',
        accent: 'bg-slate-600 hover:bg-slate-700 shadow-slate-200 focus:ring-slate-100 focus:border-slate-400'
    }
];

export const AiSettings: React.FC<AiSettingsProps> = ({ addNotification }) => {
    const [provider, setProvider] = useState<AiProvider>(aiConfigService.getProvider());
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; action: () => void } | null>(null);

    // Gemini state
    const [geminiKey, setGeminiKey] = useState('');
    const [showGeminiKey, setShowGeminiKey] = useState(false);
    const [hasGeminiKey, setHasGeminiKey] = useState(aiConfigService.hasCustomApiKey());
    const [geminiModels, setGeminiModels] = useState<Record<AiPurpose, string>>(aiConfigService.getModels());
    const [customModels, setCustomModels] = useState<CustomModel[]>(aiConfigService.getCustomModels());
    const [newModelName, setNewModelName] = useState('');

    // OpenRouter state
    const [orKey, setOrKey] = useState('');
    const [showOrKey, setShowOrKey] = useState(false);
    const [hasOrKey, setHasOrKey] = useState(aiConfigService.hasOpenRouterKey());
    const [orModel, setOrModel] = useState(aiConfigService.getOpenRouterModel());

    const activeProvider = PROVIDERS.find(p => p.key === provider)!;

    // ── Sağlayıcı değiştir ──
    const handleProviderChange = (p: AiProvider) => {
        setProvider(p);
        aiConfigService.setProvider(p);
        setTestResult(null);
        const names = { gemini: 'Gemini AI', openrouter: 'OpenRouter (GLM)', local: 'Yerel Sistem' };
        addNotification('info', `${names[p]} aktif.`);
    };

    // ── Gemini: API key ──
    const saveGeminiKey = () => {
        if (!geminiKey.trim()) { addNotification('error', 'API anahtarı girin.'); return; }
        aiConfigService.setApiKey(geminiKey);
        setGeminiKey('');
        setHasGeminiKey(true);
        setTestResult(null);
        addNotification('success', 'Gemini API anahtarı kaydedildi.');
    };
    const clearGeminiKey = () => {
        setConfirmAction({
            title: 'Anahtarı Temizle',
            message: 'Gemini API anahtarı silinsin mi?',
            action: () => {
                aiConfigService.clearApiKey();
                setHasGeminiKey(false);
                setTestResult(null);
                addNotification('info', 'Gemini anahtarı kaldırıldı.');
            }
        });
    };

    // ── Gemini: Model ──
    const handleModelChange = (purpose: AiPurpose, value: string) => {
        setGeminiModels(prev => ({ ...prev, [purpose]: value }));
        aiConfigService.setModel(purpose, value);
    };

    // ── Gemini: Özel model ──
    const addCustomModel = () => {
        if (!newModelName.trim()) { addNotification('error', 'Model adı girin.'); return; }
        const added = aiConfigService.addCustomModel(newModelName);
        if (!added) { addNotification('error', 'Bu model zaten var.'); return; }
        setNewModelName('');
        setCustomModels(aiConfigService.getCustomModels());
        addNotification('success', `"${added.name}" eklendi.`);
    };
    const deleteCustomModel = (m: CustomModel) => {
        setConfirmAction({
            title: 'Modeli Sil',
            message: `"${m.name}" silinsin mi?`,
            action: () => {
                aiConfigService.deleteCustomModel(m.id);
                setCustomModels(aiConfigService.getCustomModels());
                setGeminiModels(aiConfigService.getModels());
                addNotification('info', `"${m.name}" silindi.`);
            }
        });
    };

    // ── OpenRouter: API key ──
    const saveOrKey = () => {
        if (!orKey.trim()) { addNotification('error', 'API anahtarı girin.'); return; }
        aiConfigService.setOpenRouterKey(orKey);
        setOrKey('');
        setHasOrKey(true);
        setTestResult(null);
        addNotification('success', 'OpenRouter API anahtarı kaydedildi.');
    };
    const clearOrKey = () => {
        setConfirmAction({
            title: 'Anahtarı Temizle',
            message: 'OpenRouter API anahtarı silinsin mi?',
            action: () => {
                aiConfigService.clearOpenRouterKey();
                setHasOrKey(false);
                setTestResult(null);
                addNotification('info', 'OpenRouter anahtarı kaldırıldı.');
            }
        });
    };

    // ── Bağlantı testi ──
    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const reply = await testAiConnection();
            setTestResult({ ok: true, message: `Bağlantı başarılı. Yanıt: "${reply}"` });
            addNotification('success', 'AI bağlantısı doğrulandı.');
        } catch (e) {
            setTestResult({ ok: false, message: `Bağlantı başarısız: ${e instanceof Error ? e.message : 'Bilinmeyen hata'}` });
            addNotification('error', 'API bağlantısı kurulamadı.');
        } finally {
            setIsTesting(false);
        }
    };

    const hasAnyKey = provider === 'openrouter'
        ? (hasOrKey || !!process.env.OPENROUTER_API_KEY?.trim())
        : provider === 'gemini'
            ? (hasGeminiKey || !!process.env.API_KEY?.trim())
            : true;

    // Gemini için dropdown'da gösterilecek modeller: hazır + özel (optgroup ile)

    return (
        <div className="space-y-5 animate-in fade-in duration-500 max-w-3xl mx-auto">
            {/* Başlık */}
            <div>
                <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                    <Sparkles className="text-blue-600" /> AI & API Ayarları
                </h2>
                <p className="text-sm text-slate-500 mt-1">Yapay zeka sağlayıcısını seçin, API anahtarınızı girin ve modeli belirleyin.</p>
            </div>

            {/* ══════ 1. SAĞLAYICI SEÇİMİ ══════ */}
            <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">1. Sağlayıcı Seçin</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PROVIDERS.map(p => {
                        const Icon = p.icon;
                        const isActive = provider === p.key;
                        const colorClasses: Record<string, { border: string; bg: string; icon: string; text: string }> = {
                            blue: { border: 'border-blue-500', bg: 'bg-blue-50/50', icon: 'bg-blue-600', text: 'text-blue-700' },
                            emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50/50', icon: 'bg-emerald-600', text: 'text-emerald-700' },
                            slate: { border: 'border-slate-500', bg: 'bg-slate-50/50', icon: 'bg-slate-600', text: 'text-slate-700' }
                        };
                        const c = colorClasses[p.color];
                        return (
                            <button
                                key={p.key}
                                onClick={() => handleProviderChange(p.key)}
                                className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all text-center ${
                                    isActive ? `${c.border} ${c.bg} shadow-md` : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                            >
                                <div className={`p-2.5 rounded-xl ${isActive ? c.icon : 'bg-slate-200'} text-white transition-colors`}>
                                    <Icon size={22} />
                                </div>
                                <div>
                                    <p className={`font-bold text-sm ${isActive ? c.text : 'text-slate-700'}`}>{p.name}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{p.desc}</p>
                                </div>
                                {isActive && (
                                    <div className={`absolute top-2.5 right-2.5 w-5 h-5 ${c.icon} rounded-full flex items-center justify-center text-white`}>
                                        <Check size={11} />
                                    </div>
                                )}
                                {p.badge && (
                                    <span className="absolute top-2.5 left-2.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase">{p.badge}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ══════ 2. API ANAHTARI (Gemini & OpenRouter) ══════ */}
            {provider !== 'local' && (
                <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">2. API Anahtarı</p>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 space-y-3">
                            {/* Key input */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type={(provider === 'gemini' ? showGeminiKey : showOrKey) ? 'text' : 'password'}
                                        value={provider === 'gemini' ? geminiKey : orKey}
                                        onChange={(e) => provider === 'gemini' ? setGeminiKey(e.target.value) : setOrKey(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && (provider === 'gemini' ? saveGeminiKey() : saveOrKey())}
                                        placeholder={provider === 'gemini'
                                            ? (hasGeminiKey ? '••••••••  (yeni anahtar ile değiştir)' : 'AIza...')
                                            : (hasOrKey ? '••••••••  (yeni anahtar ile değiştir)' : 'sk-or-v1...')}
                                        className={`w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:border-slate-400 outline-none transition-all font-mono ${
                                            provider === 'openrouter' ? 'focus:ring-emerald-100 focus:border-emerald-400' : 'focus:ring-blue-100 focus:border-blue-400'
                                        }`}
                                        autoComplete="off"
                                    />
                                    <button
                                        onClick={() => provider === 'gemini' ? setShowGeminiKey(!showGeminiKey) : setShowOrKey(!showOrKey)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {(provider === 'gemini' ? showGeminiKey : showOrKey) ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <button
                                    onClick={provider === 'gemini' ? saveGeminiKey : saveOrKey}
                                    className={`px-4 py-2.5 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 active:scale-95 ${
                                        provider === 'openrouter' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                >
                                    <Save size={15} /> Kaydet
                                </button>
                                {(provider === 'gemini' ? hasGeminiKey : hasOrKey) && (
                                    <button
                                        onClick={provider === 'gemini' ? clearGeminiKey : clearOrKey}
                                        className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5"
                                    >
                                        <RotateCcw size={15} /> Sil
                                    </button>
                                )}
                            </div>

                            {/* Durum + link */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                    (provider === 'gemini' ? hasGeminiKey : hasOrKey)
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-red-100 text-red-700'
                                }`}>
                                    {(provider === 'gemini' ? hasGeminiKey : hasOrKey) ? 'Anahtar aktif' : 'Anahtar gerekli'}
                                </span>
                                {activeProvider.link && (
                                    <a href={activeProvider.link} target="_blank" rel="noopener noreferrer"
                                        className={`text-[11px] font-bold flex items-center gap-1 hover:underline ${
                                            provider === 'openrouter' ? 'text-emerald-600' : 'text-blue-600'
                                        }`}>
                                        <ExternalLink size={11} /> Ücretsiz API key al
                                    </a>
                                )}
                            </div>

                            {/* Güvenlik notu */}
                            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-xl text-amber-800">
                                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                                <p className="text-[11px] leading-relaxed">Anahtar sadece bu tarayıcının <b>localStorage</b>'ında saklanır, hiçbir sunucuya gönderilmez.</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════ 3. MODEL SEÇİMİ ══════ */}
            {provider !== 'local' && (
                <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">3. Model Seçin</p>

                    {/* OpenRouter model seçimi — basit dropdown */}
                    {provider === 'openrouter' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 space-y-3">
                                <div className="relative">
                                    <Cpu className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <select
                                        value={orModel}
                                        onChange={(e) => { setOrModel(e.target.value); aiConfigService.setOpenRouterModel(e.target.value); }}
                                        className="w-full appearance-none pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all font-mono cursor-pointer"
                                    >
                                        {OPENROUTER_MODELS.map(m => (
                                            <option key={m.id} value={m.name}>{m.label ? `${m.name} — ${m.label}` : m.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                </div>
                                <p className="text-[11px] text-slate-400">
                                    Ücretsiz modeller <b>:free</b> etiketi ile işaretlidir. <b>z-ai/glm-5.2:free</b> varsayılan ve önerilen.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Gemini model seçimi — amaç bazlı + özel model */}
                    {provider === 'gemini' && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-5 space-y-4">
                                {/* Amaç bazlı model atama */}
                                {([
                                    { purpose: 'extraction' as AiPurpose, icon: FlaskConical, label: 'PDF Sonuç Çıkarma', desc: 'Tahlil sonuçlarını okur' },
                                    { purpose: 'comment' as AiPurpose, icon: FileSignature, label: 'Otomatik Kanaat', desc: 'Tıbbi özet yazar' }
                                ]).map(({ purpose, icon: Icon, label, desc }) => (
                                    <div key={purpose} className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                                        <div className="flex items-center gap-2.5 sm:w-56 shrink-0">
                                            <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><Icon size={16} /></div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">{label}</p>
                                                <p className="text-[10px] text-slate-400">{desc}</p>
                                            </div>
                                        </div>
                                        <div className="relative flex-1">
                                            <select
                                                value={geminiModels[purpose]}
                                                onChange={(e) => handleModelChange(purpose, e.target.value)}
                                                className="w-full appearance-none px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-mono cursor-pointer"
                                            >
                                                {/* Hazır modeller */}
                                                <optgroup label="Hazır Modeller">
                                                    {PRESET_MODELS.map(m => (
                                                        <option key={m.id} value={m.name}>{m.label ? `${m.name} — ${m.label}` : m.name}</option>
                                                    ))}
                                                </optgroup>
                                                {/* Özel modeller */}
                                                {customModels.length > 0 && (
                                                    <optgroup label="Özel Modeller">
                                                        {customModels.map(m => (
                                                            <option key={m.id} value={m.name}>{m.name}{m.label ? ` — ${m.label}` : ''}</option>
                                                        ))}
                                                    </optgroup>
                                                )}
                                            </select>
                                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                        </div>
                                    </div>
                                ))}

                                {/* Özel model ekleme */}
                                <div className="pt-3 border-t border-slate-100">
                                    <div className="flex gap-2">
                                        <input
                                            value={newModelName}
                                            onChange={(e) => setNewModelName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && addCustomModel()}
                                            placeholder="Özel model ID (örn: gemini-2.0-flash)"
                                            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all font-mono"
                                        />
                                        <button
                                            onClick={addCustomModel}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-1.5 active:scale-95 shrink-0"
                                        >
                                            <Plus size={15} /> Ekle
                                        </button>
                                    </div>

                                    {/* Özel model listesi */}
                                    {customModels.length > 0 && (
                                        <div className="mt-3 space-y-1.5">
                                            {customModels.map(m => (
                                                <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl group">
                                                    <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 rounded text-[8px] font-black uppercase shrink-0">Özel</span>
                                                    <span className="text-xs font-mono text-slate-600 truncate flex-1">{m.name}</span>
                                                    <button
                                                        onClick={() => deleteCustomModel(m)}
                                                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════ 4. BAĞLANTI TESTİ ══════ */}
            {provider !== 'local' && (
                <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wide mb-3">4. Bağlantı Testi</p>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                            <p className="text-xs text-slate-500">Seçili anahtar ve model ile küçük bir istek gönderir.</p>
                            <button
                                onClick={handleTest}
                                disabled={isTesting || !hasAnyKey}
                                className={`px-5 py-2.5 text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 shadow-md shrink-0 ${
                                    provider === 'openrouter' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-900 hover:bg-slate-800'
                                }`}
                            >
                                {isTesting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                                {isTesting ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
                            </button>
                        </div>
                        {testResult && (
                            <div className={`mx-5 mb-5 p-3 rounded-xl border flex items-start gap-2.5 text-sm animate-in fade-in ${
                                testResult.ok ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
                            }`}>
                                {testResult.ok ? <CheckCircle size={18} className="shrink-0" /> : <XCircle size={18} className="shrink-0" />}
                                <span className="font-medium">{testResult.message}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ══════ Yerel Sistem bilgi kartı ══════ */}
            {provider === 'local' && (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 text-center">
                    <HardDrive size={32} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-sm font-bold text-slate-600">Yerel Sistem Aktif</p>
                    <p className="text-xs text-slate-400 mt-1">API anahtarı veya model gerekmez. Kural tabanlı çıkarma anında çalışır, rate limit yoktur.</p>
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
