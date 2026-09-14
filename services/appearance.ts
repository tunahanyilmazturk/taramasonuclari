import { AppearanceSettings } from '../types';
import { storageService } from './storageService';

/**
 * Görünüm uygulama katmanı.
 * Uygulama genelinde tema sınıfları kullanıldığı için dark: varyantları yerine,
 * <html> üzerindeki sınıflarla tetiklenen global override CSS'i enjekte edilir.
 * Tüm remap kuralları @media screen altında — yazdırma etkilenmez.
 * Vurgu rengi sabit mavidir (Tailwind blue/indigo ailesi).
 */

const STYLE_ID = 'appearance-overrides';

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
  html.dark .bg-slate-50\\/95 { background-color:rgba(30,41,59,.95); }  html.dark .bg-slate-100 { background-color:#263448; }
  html.dark .bg-slate-100\\/60 { background-color:rgba(38,52,72,.6); }
  html.dark .bg-slate-100\\/80 { background-color:rgba(38,52,72,.8); }
  html.dark .bg-slate-200 { background-color:#334155; }
  html.dark .bg-slate-200\\/60 { background-color:rgba(51,65,85,.6); }
  html.dark .bg-slate-200\\/70 { background-color:rgba(51,65,85,.7); }
  html.dark .bg-slate-300 { background-color:#3f4d63; }
  html.dark .bg-slate-400 { background-color:#475569; }
  html.dark .hover\\:bg-slate-50:hover { background-color:#1e293b; }
  html.dark .hover\\:bg-slate-100:hover { background-color:#263448; }
  html.dark .hover\\:bg-slate-200:hover { background-color:#334155; }
  html.dark .hover\\:bg-slate-200\\/60:hover { background-color:rgba(51,65,85,.6); }
  html.dark .hover\\:bg-slate-300:hover { background-color:#3f4d63; }
  html.dark .group:hover .group-hover\\:bg-slate-200 { background-color:#334155; }
  html.dark .group:hover .group-hover\\:bg-slate-100 { background-color:#263448; }
  html.dark .text-slate-900 { color:#f1f5f9; }
  html.dark .text-slate-800 { color:#f1f5f9; }
  html.dark .text-slate-700 { color:#e2e8f0; }
  html.dark .text-slate-600 { color:#cbd5e1; }
  html.dark .text-slate-500 { color:#94a3b8; }
  html.dark .text-slate-400 { color:#7d8aa0; }
  html.dark .hover\\:text-slate-900:hover { color:#f1f5f9; }
  html.dark .hover\\:text-slate-800:hover { color:#f1f5f9; }
  html.dark .hover\\:text-slate-700:hover { color:#e2e8f0; }
  html.dark .hover\\:text-slate-600:hover { color:#cbd5e1; }
  html.dark .group:hover .group-hover\\:text-slate-900 { color:#f1f5f9; }
  html.dark .group:hover .group-hover\\:text-slate-700 { color:#e2e8f0; }
  html.dark .group:hover .group-hover\\:text-slate-600 { color:#cbd5e1; }
  html.dark .placeholder-slate-400 { color:#64748b; }
  html.dark .placeholder-slate-300 { color:#64748b; }
  html.dark .border-slate-100 { border-color:#26334a; }
  html.dark .border-slate-200 { border-color:#334155; }
  html.dark .border-slate-200\\/60 { border-color:rgba(51,65,85,.6); }
  html.dark .border-slate-200\\/70 { border-color:rgba(51,65,85,.7); }
  html.dark .border-slate-300 { border-color:#475569; }
  html.dark .border-slate-400 { border-color:#64748b; }
  html.dark .border-slate-50 { border-color:#1e293b; }
  html.dark .hover\\:border-slate-300:hover { border-color:#475569; }
  html.dark .hover\\:border-slate-400:hover { border-color:#64748b; }
  html.dark .divide-slate-50 > :not([hidden]) ~ :not([hidden]) { border-color:#1e293b; }
  html.dark .divide-slate-100 > :not([hidden]) ~ :not([hidden]) { border-color:#26334a; }
  html.dark .divide-slate-200 > :not([hidden]) ~ :not([hidden]) { border-color:#334155; }
  html.dark .ring-slate-200 { --tw-ring-color:#334155; }
  html.dark .ring-slate-300 { --tw-ring-color:#475569; }
  html.dark .ring-white { --tw-ring-color:#0f172a; }
  html.dark .ring-slate-100 { --tw-ring-color:#26334a; }
  /* Gradient'ler — koyu modda beyaz/açık kalan arka planları düzelt */
  html.dark .from-slate-50 { --tw-gradient-from:#1e293b var(--tw-gradient-from-position); --tw-gradient-to:#1e293b00 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .from-slate-100 { --tw-gradient-from:#263448 var(--tw-gradient-from-position); --tw-gradient-to:#26344800 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .from-slate-200 { --tw-gradient-from:#334155 var(--tw-gradient-from-position); --tw-gradient-to:#33415500 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .from-white { --tw-gradient-from:#0f172a var(--tw-gradient-from-position); --tw-gradient-to:#0f172a00 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .to-slate-50 { --tw-gradient-to:#1e293b var(--tw-gradient-to-position); }
  html.dark .to-slate-100 { --tw-gradient-to:#263448 var(--tw-gradient-to-position); }
  html.dark .to-slate-200 { --tw-gradient-to:#334155 var(--tw-gradient-to-position); }
  html.dark .to-white { --tw-gradient-to:#0f172a var(--tw-gradient-to-position); }
  html.dark .via-white { --tw-gradient-via:#0f172a var(--tw-gradient-via-position); }
  /* Gölge renkleri — koyu modda daha derin */
  html.dark .shadow-sm, html.dark .shadow, html.dark .shadow-md, html.dark .shadow-lg, html.dark .shadow-xl { --tw-shadow-color:rgba(0,0,0,.4); }
  html.dark .shadow-slate-200\\/60 { --tw-shadow-color:rgba(0,0,0,.4); }
  html.dark .shadow-slate-200\\/50 { --tw-shadow-color:rgba(0,0,0,.4); }
  html.dark .shadow-slate-300\\/50 { --tw-shadow-color:rgba(0,0,0,.5); }
  html.dark .shadow-slate-300\\/30 { --tw-shadow-color:rgba(0,0,0,.4); }
  html.dark .shadow-slate-900\\/5 { --tw-shadow-color:rgba(0,0,0,.5); }
  html.dark .shadow-slate-900\\/10 { --tw-shadow-color:rgba(0,0,0,.5); }
  html.dark .shadow-black\\/5 { --tw-shadow-color:rgba(0,0,0,.5); }
  html.dark .shadow-black\\/10 { --tw-shadow-color:rgba(0,0,0,.5); }
  /* Sabit koyu zeminler — koyu modda biraz daha derin */
  html.dark .bg-slate-900 { background-color:#0a1020; }
  html.dark .bg-slate-900\\/40 { background-color:rgba(10,16,32,.6); }
  html.dark .bg-slate-900\\/50 { background-color:rgba(10,16,32,.65); }
  html.dark .bg-slate-800 { background-color:#162032; }
  html.dark .bg-slate-800\\/50 { background-color:rgba(22,32,50,.6); }
  html.dark .bg-slate-950 { background-color:#020617; }
  /* Ring/slate-900 hover */
  html.dark .hover\\:ring-slate-300:hover { --tw-ring-color:#475569; }
  /* Backdrop blur'lu yüzeyler */
  html.dark .backdrop-blur-xl { background-color:rgba(15,23,42,.8); }
  html.dark .backdrop-blur-md { background-color:rgba(15,23,42,.75); }
  html.dark .backdrop-blur-sm { background-color:rgba(15,23,42,.7); }
  /* Input/textarea/select arka planları */
  html.dark input, html.dark textarea, html.dark select { color-scheme:dark; }
  html.dark input::placeholder, html.dark textarea::placeholder { color:#64748b; }
  /* Tablo zebrası */
  html.dark .odd\\:bg-slate-50 { background-color:rgba(30,41,59,.4); }
  html.dark .even\\:bg-slate-50 { background-color:rgba(30,41,59,.4); }
  html.dark .bg-slate-50\\/40 { background-color:rgba(30,41,59,.4); }
  /* Renkli arka planlar — koyu modda yarı saydam derin ton */
  html.dark .bg-blue-50 { background-color:rgba(37,99,235,.15); }
  html.dark .bg-blue-50\\/30 { background-color:rgba(37,99,235,.1); }
  html.dark .bg-blue-50\\/40 { background-color:rgba(37,99,235,.12); }
  html.dark .bg-blue-50\\/50 { background-color:rgba(37,99,235,.15); }
  html.dark .bg-blue-50\\/60 { background-color:rgba(37,99,235,.18); }
  html.dark .bg-blue-50\\/70 { background-color:rgba(37,99,235,.2); }
  html.dark .bg-blue-100 { background-color:rgba(37,99,235,.25); }
  html.dark .bg-indigo-50 { background-color:rgba(67,56,202,.15); }
  html.dark .bg-indigo-50\\/30 { background-color:rgba(67,56,202,.1); }
  html.dark .bg-indigo-50\\/40 { background-color:rgba(67,56,202,.12); }
  html.dark .bg-indigo-50\\/50 { background-color:rgba(67,56,202,.15); }
  html.dark .bg-indigo-50\\/60 { background-color:rgba(67,56,202,.18); }
  html.dark .bg-indigo-100 { background-color:rgba(67,56,202,.25); }
  html.dark .bg-emerald-50 { background-color:rgba(5,150,105,.15); }
  html.dark .bg-emerald-50\\/20 { background-color:rgba(5,150,105,.08); }
  html.dark .bg-emerald-50\\/50 { background-color:rgba(5,150,105,.15); }
  html.dark .bg-emerald-100 { background-color:rgba(5,150,105,.25); }
  html.dark .bg-amber-50 { background-color:rgba(217,119,6,.15); }
  html.dark .bg-amber-100 { background-color:rgba(217,119,6,.25); }
  html.dark .bg-red-50 { background-color:rgba(220,38,38,.15); }
  html.dark .bg-red-50\\/40 { background-color:rgba(220,38,38,.12); }
  html.dark .bg-red-50\\/50 { background-color:rgba(220,38,38,.15); }
  html.dark .bg-red-100 { background-color:rgba(220,38,38,.25); }
  html.dark .bg-orange-50 { background-color:rgba(234,88,12,.15); }
  html.dark .bg-orange-50\\/40 { background-color:rgba(234,88,12,.12); }
  html.dark .bg-orange-100 { background-color:rgba(234,88,12,.25); }
  html.dark .bg-purple-50 { background-color:rgba(126,34,206,.15); }
  html.dark .bg-purple-100 { background-color:rgba(126,34,206,.25); }
  html.dark .bg-green-50 { background-color:rgba(5,150,105,.15); }
  html.dark .bg-green-100 { background-color:rgba(5,150,105,.25); }
  html.dark .bg-teal-50 { background-color:rgba(13,148,136,.15); }
  html.dark .bg-teal-100 { background-color:rgba(13,148,136,.25); }
  html.dark .bg-rose-50 { background-color:rgba(225,29,72,.15); }
  html.dark .bg-rose-100 { background-color:rgba(225,29,72,.25); }
  html.dark .bg-violet-50 { background-color:rgba(124,58,237,.15); }
  html.dark .bg-violet-100 { background-color:rgba(124,58,237,.25); }
  html.dark .bg-cyan-50 { background-color:rgba(8,145,178,.15); }
  html.dark .bg-cyan-100 { background-color:rgba(8,145,178,.25); }
  html.dark .bg-sky-50 { background-color:rgba(2,132,199,.15); }
  html.dark .bg-sky-100 { background-color:rgba(2,132,199,.25); }
  html.dark .hover\\:bg-blue-50:hover { background-color:rgba(37,99,235,.25); }
  html.dark .hover\\:bg-blue-50\\/30:hover { background-color:rgba(37,99,235,.15); }
  html.dark .hover\\:bg-blue-50\\/40:hover { background-color:rgba(37,99,235,.18); }
  html.dark .hover\\:bg-blue-50\\/50:hover { background-color:rgba(37,99,235,.2); }
  html.dark .hover\\:bg-blue-50\\/60:hover { background-color:rgba(37,99,235,.22); }
  html.dark .hover\\:bg-blue-100:hover { background-color:rgba(37,99,235,.3); }
  html.dark .hover\\:bg-emerald-50:hover { background-color:rgba(5,150,105,.25); }
  html.dark .hover\\:bg-emerald-100:hover { background-color:rgba(5,150,105,.3); }
  html.dark .hover\\:bg-amber-50:hover { background-color:rgba(217,119,6,.25); }
  html.dark .hover\\:bg-amber-100:hover { background-color:rgba(217,119,6,.3); }
  html.dark .hover\\:bg-red-50:hover { background-color:rgba(220,38,38,.25); }
  html.dark .hover\\:bg-red-100:hover { background-color:rgba(220,38,38,.3); }
  html.dark .hover\\:bg-orange-50:hover { background-color:rgba(234,88,12,.25); }
  html.dark .hover\\:bg-orange-100:hover { background-color:rgba(234,88,12,.3); }
  html.dark .hover\\:bg-purple-50:hover { background-color:rgba(126,34,206,.25); }
  html.dark .hover\\:bg-purple-100:hover { background-color:rgba(126,34,206,.3); }
  html.dark .group:hover .group-hover\\:bg-blue-50 { background-color:rgba(37,99,235,.25); }
  html.dark .group:hover .group-hover\\:bg-blue-100 { background-color:rgba(37,99,235,.3); }
  /* Renkli kenarlıklar — koyu modda daha yumuşak */
  html.dark .border-blue-100 { border-color:rgba(37,99,235,.3); }
  html.dark .border-blue-200 { border-color:rgba(37,99,235,.4); }
  html.dark .border-indigo-100 { border-color:rgba(67,56,202,.3); }
  html.dark .border-indigo-200 { border-color:rgba(67,56,202,.4); }
  html.dark .border-emerald-100 { border-color:rgba(5,150,105,.3); }
  html.dark .border-emerald-200 { border-color:rgba(5,150,105,.4); }
  html.dark .border-amber-100 { border-color:rgba(217,119,6,.3); }
  html.dark .border-amber-200 { border-color:rgba(217,119,6,.4); }
  html.dark .border-red-100 { border-color:rgba(220,38,38,.3); }
  html.dark .border-red-200 { border-color:rgba(220,38,38,.4); }
  html.dark .border-orange-100 { border-color:rgba(234,88,12,.3); }
  html.dark .border-orange-200 { border-color:rgba(234,88,12,.4); }
  html.dark .border-purple-100 { border-color:rgba(126,34,206,.3); }
  html.dark .border-purple-200 { border-color:rgba(126,34,206,.4); }
  html.dark .border-green-100 { border-color:rgba(5,150,105,.3); }
  html.dark .border-green-200 { border-color:rgba(5,150,105,.4); }
  html.dark .border-teal-100 { border-color:rgba(13,148,136,.3); }
  html.dark .border-teal-200 { border-color:rgba(13,148,136,.4); }
  html.dark .border-rose-100 { border-color:rgba(225,29,72,.3); }
  html.dark .border-rose-200 { border-color:rgba(225,29,72,.4); }
  html.dark .border-violet-100 { border-color:rgba(124,58,237,.3); }
  html.dark .border-violet-200 { border-color:rgba(124,58,237,.4); }
  html.dark .border-cyan-100 { border-color:rgba(8,145,178,.3); }
  html.dark .border-cyan-200 { border-color:rgba(8,145,178,.4); }
  html.dark .border-sky-100 { border-color:rgba(2,132,199,.3); }
  html.dark .border-sky-200 { border-color:rgba(2,132,199,.4); }
  /* Renkli metinler — koyu modda daha parlak */
  html.dark .text-blue-400 { color:#60a5fa; }
  html.dark .text-blue-500 { color:#60a5fa; }
  html.dark .text-blue-600 { color:#93c5fd; }
  html.dark .text-blue-700 { color:#93c5fd; }
  html.dark .text-blue-800 { color:#bfdbfe; }
  html.dark .text-indigo-500 { color:#a5b4fc; }
  html.dark .text-indigo-600 { color:#a5b4fc; }
  html.dark .text-indigo-700 { color:#c7d2fe; }
  html.dark .text-emerald-400 { color:#34d399; }
  html.dark .text-emerald-500 { color:#34d399; }
  html.dark .text-emerald-600 { color:#6ee7b7; }
  html.dark .text-emerald-700 { color:#6ee7b7; }
  html.dark .text-amber-400 { color:#fbbf24; }
  html.dark .text-amber-500 { color:#fbbf24; }
  html.dark .text-amber-600 { color:#fcd34d; }
  html.dark .text-amber-700 { color:#fcd34d; }
  html.dark .text-red-400 { color:#f87171; }
  html.dark .text-red-500 { color:#f87171; }
  html.dark .text-red-600 { color:#fca5a5; }
  html.dark .text-red-700 { color:#fca5a5; }
  html.dark .text-orange-400 { color:#fb923c; }
  html.dark .text-orange-500 { color:#fb923c; }
  html.dark .text-orange-600 { color:#fdba74; }
  html.dark .text-purple-400 { color:#c4b5fd; }
  html.dark .text-purple-500 { color:#c4b5fd; }
  html.dark .text-purple-600 { color:#d8b4fe; }
  html.dark .text-purple-700 { color:#d8b4fe; }
  /* Renkli ring'ler */
  html.dark .ring-blue-100 { --tw-ring-color:rgba(37,99,235,.3); }
  html.dark .ring-blue-200 { --tw-ring-color:rgba(37,99,235,.4); }
  html.dark .ring-amber-100 { --tw-ring-color:rgba(217,119,6,.3); }
  html.dark .ring-red-100 { --tw-ring-color:rgba(220,38,38,.3); }
  html.dark .ring-emerald-100 { --tw-ring-color:rgba(5,150,105,.3); }
  /* Renkli gölge tonları */
  html.dark .shadow-blue-100\\/50 { --tw-shadow-color:rgba(37,99,235,.3); }
  html.dark .shadow-blue-100 { --tw-shadow-color:rgba(37,99,235,.3); }
  html.dark .shadow-blue-200\\/50 { --tw-shadow-color:rgba(37,99,235,.3); }
  html.dark .shadow-blue-300\\/50 { --tw-shadow-color:rgba(37,99,235,.4); }
  html.dark .shadow-emerald-100\\/50 { --tw-shadow-color:rgba(5,150,105,.3); }
  html.dark .shadow-emerald-200\\/50 { --tw-shadow-color:rgba(5,150,105,.3); }
  html.dark .shadow-amber-100\\/50 { --tw-shadow-color:rgba(217,119,6,.3); }
  html.dark .shadow-red-100\\/50 { --tw-shadow-color:rgba(220,38,38,.3); }
  /* Scrollbar */
  html.dark ::-webkit-scrollbar-thumb { background:#334155; }
  html.dark ::-webkit-scrollbar-thumb:hover { background:#475569; }
  html.dark ::-webkit-scrollbar-track { background:#0f172a; }
  /* Sidebar — beyaz kenarlıklar/halkalar koyu modda koyu olsun */
  html.dark .border-white { border-color:#1e293b; }
  html.dark .border-white\\/10 { border-color:rgba(30,41,59,.5); }
  html.dark .ring-white { --tw-ring-color:#1e293b; }
  /* Aktif nav link gradient'i — koyu modda derin ton */
  html.dark .from-blue-50 { --tw-gradient-from:rgba(37,99,235,.2) var(--tw-gradient-from-position); --tw-gradient-to:rgba(37,99,235,0) var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .to-indigo-50\\/60 { --tw-gradient-to:rgba(67,56,202,.15) var(--tw-gradient-to-position); }
  html.dark .to-indigo-50 { --tw-gradient-to:rgba(67,56,202,.2) var(--tw-gradient-to-position); }
  /* Non-admin avatar — koyu modda daha derin */
  html.dark .bg-slate-200 { background-color:#334155; }
  /* Sidebar user footer arka planı */
  html.dark .bg-slate-50\\/50 { background-color:rgba(30,41,59,.5); }
  /* Test Havuzu — hover/focus ve sabit beyaz input arka planları */
  html.dark .hover\\:bg-white:hover { background-color:#1e293b; }
  html.dark .focus\\:bg-blue-50\\/50:focus { background-color:rgba(37,99,235,.2); }
  html.dark .bg-slate-50\\/80 { background-color:rgba(30,41,59,.8); }
  html.dark .hover\\:bg-slate-800:hover { background-color:#1a2434; }
  html.dark .hover\\:bg-slate-200:hover { background-color:#334155; }
  /* ── Takvim — koyu tema ekleri ── */
  /* Amber opaklık varyantları (hafta sonu / iptal vurgusu) */
  html.dark .bg-amber-50\\/5 { background-color:rgba(217,119,6,.05); }
  html.dark .bg-amber-50\\/10 { background-color:rgba(217,119,6,.08); }
  html.dark .bg-amber-50\\/20 { background-color:rgba(217,119,6,.12); }
  html.dark .bg-amber-50\\/50 { background-color:rgba(217,119,6,.15); }
  html.dark .hover\\:bg-amber-50\\/20:hover { background-color:rgba(217,119,6,.18); }
  /* Emerald opaklık varyantları */
  html.dark .bg-emerald-50\\/30 { background-color:rgba(5,150,105,.1); }
  html.dark .bg-emerald-50\\/40 { background-color:rgba(5,150,105,.12); }
  html.dark .bg-emerald-50\\/60 { background-color:rgba(5,150,105,.18); }
  /* Indigo opaklık varyantları */
  html.dark .bg-indigo-50\\/20 { background-color:rgba(67,56,202,.08); }
  /* Gradient'ler — koyu modda derin ton */
  html.dark .from-indigo-50\\/60 { --tw-gradient-from:rgba(67,56,202,.18) var(--tw-gradient-from-position); --tw-gradient-to:rgba(67,56,202,0) var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .from-indigo-50 { --tw-gradient-from:rgba(67,56,202,.15) var(--tw-gradient-from-position); --tw-gradient-to:rgba(67,56,202,0) var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .from-indigo-500 { --tw-gradient-from:#6366f1 var(--tw-gradient-from-position); --tw-gradient-to:#6366f100 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .from-indigo-600 { --tw-gradient-from:#4f46e5 var(--tw-gradient-from-position); --tw-gradient-to:#4f46e500 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .from-indigo-700 { --tw-gradient-from:#4338ca var(--tw-gradient-from-position); --tw-gradient-to:#4338ca00 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .to-indigo-50\\/30 { --tw-gradient-to:rgba(67,56,202,.1) var(--tw-gradient-to-position); }
  html.dark .to-indigo-700 { --tw-gradient-to:#4338ca var(--tw-gradient-to-position); }
  html.dark .to-indigo-800 { --tw-gradient-to:#3730a3 var(--tw-gradient-to-position); }
  html.dark .to-blue-50\\/40 { --tw-gradient-to:rgba(37,99,235,.12) var(--tw-gradient-to-position); }
  html.dark .from-emerald-400 { --tw-gradient-from:#34d399 var(--tw-gradient-from-position); --tw-gradient-to:#34d39900 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .to-emerald-500 { --tw-gradient-to:#10b981 var(--tw-gradient-to-position); }
  html.dark .from-indigo-400 { --tw-gradient-from:#818cf8 var(--tw-gradient-from-position); --tw-gradient-to:#818cf800 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .to-indigo-500 { --tw-gradient-to:#6366f1 var(--tw-gradient-to-position); }
  html.dark .hover\\:from-indigo-700:hover { --tw-gradient-from:#4338ca var(--tw-gradient-from-position); --tw-gradient-to:#4338ca00 var(--tw-gradient-to-position); --tw-gradient-stops:var(--tw-gradient-from), var(--tw-gradient-to); }
  html.dark .hover\\:to-indigo-800:hover { --tw-gradient-to:#3730a3 var(--tw-gradient-to-position); }
  /* Ring'ler — indigo */
  html.dark .ring-indigo-100 { --tw-ring-color:rgba(99,102,241,.3); }
  html.dark .ring-indigo-400 { --tw-ring-color:#818cf8; }
  html.dark .focus\\:ring-indigo-100:focus { --tw-ring-color:rgba(99,102,241,.3); }
  /* Border — indigo */
  html.dark .border-indigo-400 { border-color:#818cf8; }
  html.dark .hover\\:border-indigo-200:hover { border-color:rgba(99,102,241,.4); }
  html.dark .focus\\:border-indigo-400:focus { border-color:#818cf8; }
  /* Border-l (sol renk çubuğu) — koyu modda parlak ton */
  html.dark .border-l-blue-500 { border-left-color:#3b82f6; }
  html.dark .border-l-amber-500 { border-left-color:#f59e0b; }
  html.dark .border-l-emerald-500 { border-left-color:#10b981; }
  html.dark .border-l-red-500 { border-left-color:#ef4444; }
  html.dark .border-l-slate-400 { border-left-color:#94a3b8; }
  /* Gölge — indigo */
  html.dark .shadow-indigo-200 { --tw-shadow-color:rgba(99,102,241,.3); }
  /* Slate-50/20 (boş gün hücreleri) */
  html.dark .bg-slate-50\\/20 { background-color:rgba(30,41,59,.2); }
  /* ── Koyu mod tutarlılık katmanı ── */
  /* Opaklık varyantları: kartlar, filtreler ve form yüzeyleri */
  html.dark .bg-slate-50\\/30 { background-color:rgba(30,41,59,.3); }
  html.dark .bg-slate-50\\/60 { background-color:rgba(30,41,59,.6); }
  html.dark .bg-slate-50\\/70 { background-color:rgba(30,41,59,.7); }
  html.dark .bg-slate-50\\/95 { background-color:rgba(15,23,42,.95); }
  html.dark .bg-slate-100\\/50 { background-color:rgba(38,52,72,.5); }
  html.dark .bg-slate-100\\/70 { background-color:rgba(38,52,72,.7); }
  html.dark .bg-slate-100\\/80 { background-color:rgba(38,52,72,.8); }
  html.dark .bg-slate-200\\/50 { background-color:rgba(51,65,85,.5); }
  html.dark .bg-slate-200\\/70 { background-color:rgba(51,65,85,.7); }
  html.dark .bg-slate-800\\/80 { background-color:rgba(22,32,50,.8); }
  html.dark .bg-slate-900\\/90 { background-color:rgba(10,16,32,.9); }
  html.dark .bg-slate-950\\/60 { background-color:rgba(2,6,23,.6); }
  /* Açık moddan kalan beyaz translucent yüzeyler */
  html.dark .bg-white\\/5 { background-color:rgba(255,255,255,.05); }
  html.dark .bg-white\\/10 { background-color:rgba(255,255,255,.08); }
  html.dark .bg-white\\/15 { background-color:rgba(255,255,255,.1); }
  html.dark .bg-white\\/20 { background-color:rgba(255,255,255,.12); }
  html.dark .hover\\:bg-white\\/10:hover { background-color:rgba(255,255,255,.12); }
  html.dark .hover\\:bg-white\\/20:hover { background-color:rgba(255,255,255,.16); }
  html.dark .border-white\\/15 { border-color:rgba(148,163,184,.2); }
  html.dark .border-white\\/20 { border-color:rgba(148,163,184,.26); }
  /* Odak durumunda input'un tekrar beyaza dönmesini engelle */
  html.dark .focus\\:bg-white:focus { background-color:#0f172a; }
  html.dark .focus\\:bg-slate-50:focus { background-color:#1e293b; }
  html.dark .focus\\:bg-slate-100:focus { background-color:#263448; }
  /* Eksik slate metin/hover tonları */
  html.dark .text-slate-200 { color:#e2e8f0; }
  html.dark .text-slate-300 { color:#cbd5e1; }
  html.dark .hover\\:text-slate-500:hover { color:#cbd5e1; }
  html.dark .hover\\:text-slate-600:hover { color:#e2e8f0; }
  html.dark .hover\\:text-slate-700:hover { color:#f1f5f9; }
  html.dark .hover\\:text-slate-800:hover,
  html.dark .hover\\:text-slate-900:hover { color:#fff; }
  /* Daha koyu border seviyeleri; ayırıcı ve alan kenarları artık beyaz kalmaz */
  html.dark .border-slate-500 { border-color:#64748b; }
  html.dark .border-slate-600 { border-color:#475569; }
  html.dark .border-slate-700 { border-color:#334155; }
  html.dark .border-slate-800 { border-color:#263448; }
  html.dark .border-slate-200\\/50 { border-color:rgba(51,65,85,.5); }
  html.dark .border-slate-200\\/80 { border-color:rgba(51,65,85,.8); }
  html.dark .focus\\:border-slate-400:focus { border-color:#94a3b8; }
  /* Liste satırı ve filtre hover'ları */
  html.dark .hover\\:bg-slate-50:hover { background-color:#1e293b; }
  html.dark .hover\\:bg-slate-50\\/50:hover { background-color:rgba(30,41,59,.6); }
  html.dark .hover\\:bg-slate-50\\/60:hover { background-color:rgba(30,41,59,.7); }
  html.dark .hover\\:bg-slate-100:hover { background-color:#263448; }
  html.dark .hover\\:bg-slate-100\\/60:hover { background-color:rgba(38,52,72,.7); }
  html.dark .hover\\:bg-slate-200:hover { background-color:#334155; }
  html.dark .hover\\:bg-slate-200\\/60:hover { background-color:rgba(51,65,85,.7); }
  html.dark .hover\\:bg-slate-300:hover { background-color:#475569; }
  html.dark .hover\\:bg-slate-700:hover { background-color:#263448; }
  html.dark .hover\\:bg-slate-900:hover { background-color:#020617; }
`;

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

/** Kayıtlı/verilen görünümü DOM'a uygular */
export const applyAppearance = (s?: AppearanceSettings) => {
  const a = s ?? storageService.getAppearance();
  const root = document.documentElement;
  const dark = a.theme === 'dark';

  root.classList.toggle('dark', dark);
  root.classList.toggle('density-compact', a.compact);
  root.classList.toggle('reduce-motion', a.reduceMotion);
  root.style.fontSize = FONT_SCALES[a.fontScale] ?? '16px';

  let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `@media screen {\n${dark ? DARK_CSS : ''}\n${a.compact ? COMPACT_CSS : ''}\n}\n${a.reduceMotion ? MOTION_CSS : ''}`;
};

/** Kaydet + uygula — Settings'teki her değişiklikte çağrılır */
export const updateAppearance = (patch: Partial<AppearanceSettings>): AppearanceSettings => {
  const next = { ...storageService.getAppearance(), ...patch };
  storageService.saveAppearance(next);
  applyAppearance(next);
  return next;
};
