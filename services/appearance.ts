import { AppearanceSettings, AccentColor } from '../types';
import { storageService } from './storageService';

/**
 * Görünüm uygulama katmanı.
 * Tailwind CDN kullanıldığı için dark:/accent: varyantları yerine,
 * <html> üzerindeki sınıflarla tetiklenen global override CSS'i enjekte edilir.
 * Tüm remap kuralları @media screen altında — yazdırma etkilenmez.
 */

const STYLE_ID = 'appearance-overrides';

/** Vurgu renk paletleri (Tailwind tonları) */
export const ACCENTS: Record<AccentColor, { label: string; p: Record<string, string> }> = {
  blue:    { label: 'Mavi',    p: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',300:'#93c5fd',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8' } },
  emerald: { label: 'Zümrüt',  p: { 50:'#ecfdf5',100:'#d1fae5',200:'#a7f3d0',300:'#6ee7b7',400:'#34d399',500:'#10b981',600:'#059669',700:'#047857' } },
  violet:  { label: 'Mor',     p: { 50:'#f5f3ff',100:'#ede9fe',200:'#ddd6fe',300:'#c4b5fd',400:'#a78bfa',500:'#8b5cf6',600:'#7c3aed',700:'#6d28d9' } },
  rose:    { label: 'Gül',     p: { 50:'#fff1f2',100:'#ffe4e6',200:'#fecdd3',300:'#fda4af',400:'#fb7185',500:'#f43f5e',600:'#e11d48',700:'#be123c' } },
  amber:   { label: 'Kehribar',p: { 50:'#fffbeb',100:'#fef3c7',200:'#fde68a',300:'#fcd34d',400:'#fbbf24',500:'#f59e0b',600:'#d97706',700:'#b45309' } }
};

const FONT_SCALES = { sm: '14px', md: '16px', lg: '17.5px' } as const;

/** Koyu tema — yaygın yüzey/metin/sınır utility'lerinin remap'i */
const DARK_CSS = `
  html.dark body { background-color:#020617; background-image:radial-gradient(#1e293b 1px, transparent 1px); color:#e2e8f0; }
  html.dark .bg-white { background-color:#0f172a; }
  html.dark .bg-white\\/80 { background-color:rgba(15,23,42,.8); }
  html.dark .bg-white\\/85 { background-color:rgba(15,23,42,.85); }
  html.dark .bg-white\\/90 { background-color:rgba(15,23,42,.9); }
  html.dark .bg-white\\/95 { background-color:rgba(15,23,42,.95); }
  html.dark .bg-slate-50 { background-color:#1e293b; }
  html.dark .bg-slate-50\\/30 { background-color:rgba(30,41,59,.3); }
  html.dark .bg-slate-50\\/50 { background-color:rgba(30,41,59,.5); }
  html.dark .bg-slate-50\\/60 { background-color:rgba(30,41,59,.6); }
  html.dark .bg-slate-50\\/70 { background-color:rgba(30,41,59,.7); }
  html.dark .bg-slate-50\\/80 { background-color:rgba(30,41,59,.8); }
  html.dark .bg-slate-50\\/95 { background-color:rgba(30,41,59,.95); }
  html.dark .bg-slate-100 { background-color:#263448; }
  html.dark .bg-slate-100\\/60 { background-color:rgba(38,52,72,.6); }
  html.dark .bg-slate-100\\/80 { background-color:rgba(38,52,72,.8); }
  html.dark .bg-slate-200 { background-color:#334155; }
  html.dark .bg-slate-200\\/60 { background-color:rgba(51,65,85,.6); }
  html.dark .bg-slate-200\\/70 { background-color:rgba(51,65,85,.7); }
  html.dark .hover\\:bg-slate-50:hover { background-color:#1e293b; }
  html.dark .hover\\:bg-slate-100:hover { background-color:#263448; }
  html.dark .hover\\:bg-slate-200:hover { background-color:#334155; }
  html.dark .hover\\:bg-slate-200\\/60:hover { background-color:rgba(51,65,85,.6); }
  html.dark .group:hover .group-hover\\:bg-slate-200 { background-color:#334155; }
  html.dark .text-slate-900 { color:#f1f5f9; }
  html.dark .text-slate-800 { color:#f1f5f9; }
  html.dark .text-slate-700 { color:#e2e8f0; }
  html.dark .text-slate-600 { color:#cbd5e1; }
  html.dark .text-slate-500 { color:#94a3b8; }
  html.dark .border-slate-100 { border-color:#26334a; }
  html.dark .border-slate-200 { border-color:#334155; }
  html.dark .border-slate-200\\/60 { border-color:rgba(51,65,85,.6); }
  html.dark .border-slate-200\\/70 { border-color:rgba(51,65,85,.7); }
  html.dark .border-slate-300 { border-color:#475569; }
  html.dark .divide-slate-100 > :not([hidden]) ~ :not([hidden]) { border-color:#26334a; }
  html.dark .divide-slate-200 > :not([hidden]) ~ :not([hidden]) { border-color:#334155; }
  html.dark .ring-slate-200 { --tw-ring-color:#334155; }
  html.dark .ring-white { --tw-ring-color:#0f172a; }
  html.dark ::-webkit-scrollbar-thumb { background:#334155; }
  html.dark ::-webkit-scrollbar-thumb:hover { background:#475569; }
  html.dark input, html.dark textarea, html.dark select { color-scheme:dark; }
`;

/** Vurgu rengi remap'i — mavi/indigo ailesi seçilen palete çevrilir */
const buildAccentCss = (accent: AccentColor): string => {
  if (accent === 'blue') return '';
  const p = ACCENTS[accent].p;
  const s = `html.accent-${accent}`;
  return `
  ${s} .bg-blue-50 { background-color:${p['50']}; }
  ${s} .bg-blue-100 { background-color:${p['100']}; }
  ${s} .bg-blue-200 { background-color:${p['200']}; }
  ${s} .bg-blue-400 { background-color:${p['400']}; }
  ${s} .bg-blue-500 { background-color:${p['500']}; }
  ${s} .bg-blue-600 { background-color:${p['600']}; }
  ${s} .bg-blue-700 { background-color:${p['700']}; }
  ${s} .bg-indigo-50 { background-color:${p['50']}; }
  ${s} .bg-indigo-100 { background-color:${p['100']}; }
  ${s} .bg-indigo-600 { background-color:${p['600']}; }
  ${s} .text-blue-400 { color:${p['400']}; }
  ${s} .text-blue-500 { color:${p['500']}; }
  ${s} .text-blue-600 { color:${p['600']}; }
  ${s} .text-blue-700 { color:${p['700']}; }
  ${s} .text-indigo-600 { color:${p['600']}; }
  ${s} .border-blue-100 { border-color:${p['100']}; }
  ${s} .border-blue-200 { border-color:${p['200']}; }
  ${s} .border-blue-300 { border-color:${p['300']}; }
  ${s} .border-blue-400 { border-color:${p['400']}; }
  ${s} .ring-blue-100 { --tw-ring-color:${p['100']}; }
  ${s} .ring-blue-300 { --tw-ring-color:${p['300']}; }
  ${s} .ring-blue-400 { --tw-ring-color:${p['400']}; }
  ${s} .focus\\:ring-blue-500:focus { --tw-ring-color:${p['500']}; }
  ${s} .from-blue-50 { --tw-gradient-from:${p['50']} var(--tw-gradient-from-position); --tw-gradient-to:${p['50']}00 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  ${s} .from-blue-500 { --tw-gradient-from:${p['500']} var(--tw-gradient-from-position); --tw-gradient-to:${p['500']}00 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  ${s} .from-blue-600 { --tw-gradient-from:${p['600']} var(--tw-gradient-from-position); --tw-gradient-to:${p['600']}00 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  ${s} .to-indigo-50 { --tw-gradient-to:${p['50']} var(--tw-gradient-to-position); }
  ${s} .to-indigo-50\\/60 { --tw-gradient-to:${p['50']}99 var(--tw-gradient-to-position); }
  ${s} .to-indigo-600 { --tw-gradient-to:${p['600']} var(--tw-gradient-to-position); }
  ${s} .to-indigo-700 { --tw-gradient-to:${p['700']} var(--tw-gradient-to-position); }
  ${s} .shadow-blue-100\\/50 { --tw-shadow-color:${p['100']}80; }
  ${s} .shadow-blue-200\\/50 { --tw-shadow-color:${p['200']}80; }
  ${s} .shadow-blue-300\\/50 { --tw-shadow-color:${p['300']}80; }
`;
};

/** Kompakt yoğunluk — yaygın boşluk ölçülerini küçültür */
const COMPACT_CSS = `
  html.density-compact .p-6 { padding:16px; }
  html.density-compact .p-8 { padding:20px; }
  html.density-compact .py-3 { padding-top:8px; padding-bottom:8px; }
  html.density-compact .py-2\\.5 { padding-top:7px; padding-bottom:7px; }
  html.density-compact .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top:14px; }
  html.density-compact .gap-6 { gap:14px; }
  html.density-compact .px-6 { padding-left:18px; padding-right:18px; }
`;

const MOTION_CSS = `
  html.reduce-motion *, html.reduce-motion *::before, html.reduce-motion *::after {
    animation-duration:.01ms !important; animation-iteration-count:1 !important;
    transition-duration:.01ms !important; scroll-behavior:auto !important;
  }
`;

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;

/** Kayıtlı/verilen görünümü DOM'a uygular */
export const applyAppearance = (s?: AppearanceSettings) => {
  const a = s ?? storageService.getAppearance();
  const root = document.documentElement;
  const dark = a.theme === 'dark' || (a.theme === 'system' && systemDark());

  root.classList.toggle('dark', dark);
  root.classList.toggle('density-compact', a.compact);
  root.classList.toggle('reduce-motion', a.reduceMotion);
  ACCENT_KEYS.forEach(k => root.classList.remove(`accent-${k}`));
  if (a.accent !== 'blue') root.classList.add(`accent-${a.accent}`);
  root.style.fontSize = FONT_SCALES[a.fontScale] ?? '16px';

  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@media screen {\n${dark ? DARK_CSS : ''}\n${buildAccentCss(a.accent)}\n${a.compact ? COMPACT_CSS : ''}\n}\n${a.reduceMotion ? MOTION_CSS : ''}`;
};

const ACCENT_KEYS = Object.keys(ACCENTS) as AccentColor[];

/** Sistem teması seçiliyken OS tercihini canlı takip et */
let mediaBound = false;
export const bindSystemThemeListener = () => {
  if (mediaBound || !window.matchMedia) return;
  mediaBound = true;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (storageService.getAppearance().theme === 'system') applyAppearance();
  });
};

/** Kaydet + uygula — Settings'teki her değişiklikte çağrılır */
export const updateAppearance = (patch: Partial<AppearanceSettings>): AppearanceSettings => {
  const next = { ...storageService.getAppearance(), ...patch };
  storageService.saveAppearance(next);
  applyAppearance(next);
  return next;
};
