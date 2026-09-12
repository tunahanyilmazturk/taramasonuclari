// AI yapılandırması: API anahtarı ve model seçimi localStorage'da tutulur.
// Anahtar girilmezse build-time env değişkeni (GEMINI_API_KEY) kullanılır.

export type AiPurpose = 'extraction' | 'comment';
export type AiProvider = 'gemini' | 'local';

export interface CustomModel {
    id: string;
    name: string;   // Gemini model ID (örn: gemini-3-flash-preview)
    label?: string; // Kullanıcıya gösterilen etiket
}

export type ModelCategory = 'latest' | 'gemini3' | 'custom';

const KEYS = {
    API_KEY: 'mediscan_ai_api_key',
    MODELS: 'mediscan_ai_models',
    CUSTOM_MODELS: 'mediscan_ai_custom_models',
    CATEGORY: 'mediscan_ai_model_category',
    PROVIDER: 'mediscan_ai_provider'
};

// Gemini'nin güncel metin üretim modelleri (API ile test edilmiş, çalışan modeller)
export const PRESET_MODELS: CustomModel[] = [
    // --- En güncel (latest alias'lar — her zaman en yeni sürüme işaret eder) ---
    { id: 'latest_flash', name: 'gemini-flash-latest', label: 'Gemini Flash (Latest) — Her zaman en güncel Flash sürümü' },
    { id: 'latest_pro', name: 'gemini-pro-latest', label: 'Gemini Pro (Latest) — Her zaman en güncel Pro sürümü' },
    { id: 'latest_flash_lite', name: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite (Latest) — En ekonomik' },

    // --- Gemini 3.x serisi (test edilmiş, çalışan modeller) ---
    { id: 'g38_flash', name: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash — En yeni Flash' },
    { id: 'g37_flash', name: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    { id: 'g36_flash', name: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
    { id: 'g35_flash', name: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash — Sustained frontier performance' },
    { id: 'g35_flash_lite', name: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite — Yüksek hacim için ekonomik' },
    { id: 'g31_pro', name: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro — SOTA reasoning, en yetkin' },
    { id: 'g31_flash_lite', name: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite — Yüksek hacim, düşük maliyet' },
    { id: 'g3_flash', name: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' }
];

export const CATEGORY_LABELS: Record<ModelCategory, string> = {
    latest: 'En Güncel (Latest)',
    gemini3: 'Gemini 3.x Serisi',
    custom: 'Özel Modeller'
};

// Kategori → model ID eşleştirme
const CATEGORY_MAP: Record<ModelCategory, string[]> = {
    latest: ['latest_flash', 'latest_pro', 'latest_flash_lite'],
    gemini3: ['g38_flash', 'g37_flash', 'g36_flash', 'g35_flash', 'g35_flash_lite', 'g31_pro', 'g31_flash_lite', 'g3_flash'],
    custom: [] // Dinamik olarak özel modellerden doldurulur
};

export const DEFAULT_MODELS: Record<AiPurpose, string> = {
    extraction: 'gemini-3.1-flash-lite',
    comment: 'gemini-3.1-flash-lite'
};

export const aiConfigService = {
    /** Önce kullanıcının kaydettiği anahtar, yoksa env değişkeni. */
    getApiKey: (): string | undefined => {
        const custom = localStorage.getItem(KEYS.API_KEY)?.trim();
        if (custom) return custom;
        const envKey = process.env.API_KEY?.trim();
        return envKey || undefined;
    },

    /** Kullanıcı özel anahtar kaydetmiş mi? */
    hasCustomApiKey: (): boolean => !!localStorage.getItem(KEYS.API_KEY)?.trim(),

    setApiKey: (key: string) => {
        const trimmed = key.trim();
        if (trimmed) localStorage.setItem(KEYS.API_KEY, trimmed);
    },

    /** Özel anahtarı sil — env anahtarına geri dön. */
    clearApiKey: () => {
        localStorage.removeItem(KEYS.API_KEY);
    },

    getModel: (purpose: AiPurpose): string => {
        return aiConfigService.getModels()[purpose] || DEFAULT_MODELS[purpose];
    },

    getModels: (): Record<AiPurpose, string> => {
        const raw = localStorage.getItem(KEYS.MODELS);
        if (!raw) return { ...DEFAULT_MODELS };
        try {
            const parsed = JSON.parse(raw) as Partial<Record<AiPurpose, string>>;
            return { ...DEFAULT_MODELS, ...parsed };
        } catch {
            return { ...DEFAULT_MODELS };
        }
    },

    setModel: (purpose: AiPurpose, model: string) => {
        const trimmed = model.trim();
        if (!trimmed) return;
        const models = aiConfigService.getModels();
        models[purpose] = trimmed;
        localStorage.setItem(KEYS.MODELS, JSON.stringify(models));
    },

    resetModels: () => {
        localStorage.removeItem(KEYS.MODELS);
    },

    // --- ÖZEL MODEL LİSTESİ ---
    getCustomModels: (): CustomModel[] => {
        const raw = localStorage.getItem(KEYS.CUSTOM_MODELS);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    },

    /** Hazır + özel modellerin birleşik listesi (öncelik özel). */
    getAllModels: (): CustomModel[] => {
        return [...aiConfigService.getCustomModels(), ...PRESET_MODELS];
    },

    addCustomModel: (name: string, label?: string): CustomModel | null => {
        const trimmedName = name.trim();
        if (!trimmedName) return null;
        const existing = aiConfigService.getAllModels();
        // Aynı model adı zaten varsa ekleme
        if (existing.some(m => m.name.toLowerCase() === trimmedName.toLowerCase())) return null;
        const model: CustomModel = {
            id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: trimmedName,
            label: label?.trim() || undefined
        };
        const custom = aiConfigService.getCustomModels();
        localStorage.setItem(KEYS.CUSTOM_MODELS, JSON.stringify([...custom, model]));
        return model;
    },

    updateCustomModel: (id: string, updates: Partial<Pick<CustomModel, 'name' | 'label'>>) => {
        const custom = aiConfigService.getCustomModels();
        const idx = custom.findIndex(m => m.id === id);
        if (idx === -1) return;
        const name = updates.name?.trim();
        if (name !== undefined) custom[idx].name = name;
        custom[idx].label = updates.label?.trim() || undefined;
        localStorage.setItem(KEYS.CUSTOM_MODELS, JSON.stringify(custom));
    },

    deleteCustomModel: (id: string) => {
        const custom = aiConfigService.getCustomModels();
        const target = custom.find(m => m.id === id);
        if (!target) return;
        // Silinen model seçiliyse o amaçları varsayılana döndür
        const models = aiConfigService.getModels();
        let changed = false;
        (['extraction', 'comment'] as AiPurpose[]).forEach(p => {
            if (models[p] === target.name) {
                models[p] = DEFAULT_MODELS[p];
                changed = true;
            }
        });
        if (changed) localStorage.setItem(KEYS.MODELS, JSON.stringify(models));
        localStorage.setItem(KEYS.CUSTOM_MODELS, JSON.stringify(custom.filter(m => m.id !== id)));
    },

    moveCustomModel: (id: string, direction: 'up' | 'down') => {
        const custom = aiConfigService.getCustomModels();
        const idx = custom.findIndex(m => m.id === id);
        if (idx === -1) return;
        const swapWith = direction === 'up' ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= custom.length) return;
        [custom[idx], custom[swapWith]] = [custom[swapWith], custom[idx]];
        localStorage.setItem(KEYS.CUSTOM_MODELS, JSON.stringify(custom));
    },

    // --- MODEL KATEGORİSİ ---
    getCategory: (): ModelCategory => {
        const raw = localStorage.getItem(KEYS.CATEGORY) as ModelCategory | null;
        return raw || 'latest';
    },

    setCategory: (category: ModelCategory) => {
        localStorage.setItem(KEYS.CATEGORY, category);
    },

    /** Seçili kategoriye göre filtrelenmiş model listesi. */
    getModelsByCategory: (category: ModelCategory): CustomModel[] => {
        if (category === 'custom') return aiConfigService.getCustomModels();
        const ids = CATEGORY_MAP[category];
        return PRESET_MODELS.filter(m => ids.includes(m.id));
    },

    // --- AI SAĞLAYICI ---
    getProvider: (): AiProvider => {
        const raw = localStorage.getItem(KEYS.PROVIDER) as AiProvider | null;
        return raw || 'gemini';
    },

    setProvider: (provider: AiProvider) => {
        localStorage.setItem(KEYS.PROVIDER, provider);
    }
};
