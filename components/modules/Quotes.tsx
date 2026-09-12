import React, { useEffect, useMemo, useState } from 'react';
import { Company, Quote, QuoteItem, QuoteStatus, QuoteType, TestDefinition } from '../../types';
import { storageService } from '../../services/storageService';
import { testPrice, testCategory, TEST_CATEGORIES } from '../../constants';
import { Modal, modalPanel } from '../Modal';
import { ConfirmModal } from '../ConfirmModal';
import {
  FileText, Plus, Search, Copy, Trash2, Edit2, Printer, Send, CheckCircle2,
  XCircle, X, Calculator, Building2, CalendarDays, ArrowLeft, ArrowRight,
  RotateCcw, Stethoscope, Check, Users as UsersIcon, FlaskConical, Factory, ClipboardList,
  ChevronUp, ChevronDown, ScrollText, ListChecks, AlertTriangle, Eye, Download, Sparkles
} from 'lucide-react';

interface QuotesProps {
  companies: Company[];
  allTests: TestDefinition[];
  onGoToDashboard?: () => void;
  detailQuoteId?: string;   // #/quotes/<id> alt rotasından gelen teklif kimliği
  onNavigate?: (route: string) => void;
  onBack?: (fallback: string) => void; // uygulama içi geri — önceki sayfaya döner
}

const STATUS_META: Record<QuoteStatus, { label: string; badge: string; dot: string }> = {
  taslak:     { label: 'Taslak',     badge: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400' },
  gonderildi: { label: 'Gönderildi', badge: 'bg-blue-50 text-blue-700 border-blue-200',       dot: 'bg-blue-500' },
  onaylandi:  { label: 'Onaylandı',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  reddedildi: { label: 'Reddedildi', badge: 'bg-red-50 text-red-600 border-red-200',          dot: 'bg-red-500' }
};

const WIZARD_STEPS = [
  { key: 1, label: 'Firma', desc: 'Firma, tür & tarih', icon: Building2 },
  { key: 2, label: 'Kalemler', desc: 'Tetkik & hizmet seçimi', icon: FlaskConical },
  { key: 3, label: 'Fiyatlandırma', desc: 'Fiyat, KDV, koşullar', icon: Calculator },
  { key: 4, label: 'Ön Yazı', desc: 'Teklif giriş metni', icon: FileText },
  { key: 5, label: 'Şartlar', desc: 'Koşul maddeleri', icon: ScrollText },
  { key: 6, label: 'Önizleme', desc: 'Kontrol & kaydet', icon: Printer }
];

/** Detay sayfası durum stepper'ı — düğüm renkleri */
const PIPE_NODE: Record<string, string> = {
  taslak: 'bg-slate-400 border-slate-400',
  gonderildi: 'bg-blue-500 border-blue-500',
  onaylandi: 'bg-emerald-500 border-emerald-500',
  reddedildi: 'bg-red-500 border-red-500'
};

const fmtTL = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const calcTotals = (items: QuoteItem[], discountRate: number, vatRate: number, discountType: 'percent' | 'amount' = 'percent') => {
  const sub = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discount = discountType === 'amount' ? Math.min(discountRate, sub) : sub * (discountRate / 100);
  const vat = (sub - discount) * (vatRate / 100);
  return { sub, discount, vat, total: sub - discount + vat };
};

const newItemId = () => `item_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

/** Gönderilmiş ama geçerlilik süresi dolmuş teklif mi? */
const isExpired = (q: Quote) => q.status === 'gonderildi' && q.validUntil < new Date().toISOString().split('T')[0];

const totalOf = (q: Quote) => calcTotals(q.items, q.discountRate, q.vatRate, q.discountType ?? 'percent').total;

/** Bugünden itibaren N gün sonrasının ISO tarihi — geçerlilik hızlı çipleri için */
const datePlusDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

const newQuoteId = () => `quo_${Date.now()}`;
const todayIso = () => new Date().toISOString().split('T')[0];

/** Tarihe kalan gün sayısı (negatifse 0) */
const daysUntil = (dateStr: string) => Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000));

/** Geçerlilik aralığında geçen sürenin yüzdesi (0-100) — detay sayfası çubuğu */
const validityUsedPct = (createdAt: string, validUntil: string) => {
  const createdMs = new Date(createdAt).getTime();
  const untilMs = new Date(validUntil).getTime();
  return Math.min(Math.max(((Date.now() - createdMs) / Math.max(untilMs - createdMs, 86400000)) * 100, 0), 100);
};

const VALIDITY_PRESETS = [7, 15, 30, 45, 60, 90];

// ── ŞARTLAR VE KOŞULLAR KÜTÜPHANESİ ──
interface TermEntry { text: string | ((c: CoverCtx) => string); rec?: boolean }

const TERM_LIBRARY: { category: string; items: TermEntry[] }[] = [
  {
    category: 'Fiyat & Ödeme',
    items: [
      { text: 'Fiyatlara KDV dahil değildir.', rec: true },
      { text: 'Ödeme: %50 avans, bakiye tarama tamamlandıktan sonra.', rec: true },
      { text: 'Fatura, tarama sonrası düzenlenir ve 30 gün vadeli ödenir.' },
      { text: 'Teklif edilen fiyatlar asgari katılımcı sayısı için geçerlidir.' },
      { text: 'Ek tetkik talepleri ayrıca fiyatlandırılır.' },
      { text: 'Taramaya katılmayan personel ücreti %50 oranında yansıtılır.' }
    ]
  },
  {
    category: 'Geçerlilik & Süreç',
    items: [
      { text: c => `Teklif, ${c.validUntil || 'belirtilen'} tarihine kadar geçerlidir.`, rec: true },
      { text: 'Teklifin kabulü yazılı onay ile yapılır.' },
      { text: 'Raporlar, tarama sonrası 5 iş günü içinde teslim edilir.', rec: true },
      { text: 'Tarama tarihi, onay sonrası karşılıklı olarak planlanır.' }
    ]
  },
  {
    category: 'Operasyon',
    items: [
      { text: 'Mobil ekip ulaşım ücreti fiyatlara dahildir.', rec: true },
      { text: 'Muayene için uygun ortam (sessiz oda, priz erişimi) firma tarafından sağlanır.', rec: true },
      { text: 'Taramaya katılacak çalışan listesi, tarama tarihinden en az 2 gün önce firma tarafından iletilir.' },
      { text: 'Tarama günü değişiklikleri en az 48 saat önceden bildirilmelidir.' },
      { text: 'Operasyon, tarama günü sabah saatlerinde başlar ve aynı gün tamamlanır.' }
    ]
  },
  {
    category: 'Hukuki & KVKK',
    items: [
      { text: 'Tüm sağlık verileri 6698 sayılı KVKK kapsamında korunur ve üçüncü kişilerle paylaşılmaz.', rec: true },
      { text: 'Sonuçların tıbbi yorumlanması işyeri hekimi sorumluluğundadır.' },
      { text: 'Taraflar arasındaki uyuşmazlıklarda tarafların merkez mahkemeleri yetkilidir.' }
    ]
  }
];

const termText = (t: TermEntry, c: CoverCtx): string =>
  typeof t.text === 'function' ? t.text(c) : t.text;

// ── ÖN YAZI ŞABLONLARI ──
interface CoverCtx {
  companyName?: string;
  contactPerson?: string;
  typeLabel: string;
  itemCount: number;
  employeeCount?: number;
  total: number;
  validUntil: string;
  orgName: string;
}

const COVER_TEMPLATES: { key: string; label: string; desc: string; build: (c: CoverCtx) => string }[] = [
  {
    key: 'kurumsal',
    label: 'Kurumsal',
    desc: 'Resmi, detaylı iş mektubu üslubu',
    build: c => `Sayın ${c.contactPerson || 'Yetkili'},

${c.companyName || 'Firmanız'} kuruluşunuzun çalışanlarına yönelik ${c.typeLabel.toLowerCase()} hizmetimiz için hazırlamış olduğumuz fiyat teklifimizi bilgilerinize sunarız.

Teklifimiz ${c.itemCount} tetkik/hizmet kalemini kapsamakta olup${c.employeeCount ? ` firmanızın ${c.employeeCount} çalışanı baz alınarak` : ''} hazırlanmıştır. Mobil sağlık tarama aracımız ve deneyimli sağlık ekibimizle hizmet, işyerinizde, iş akışınızı aksatmadan gerçekleştirilecektir.

Teklifimiz ${c.validUntil} tarihine kadar geçerlidir. Uygun bulmanız halinde operasyon planlaması için ekibimizle iletişime geçmeniz yeterlidir.

Saygılarımızla,
${c.orgName}`
  },
  {
    key: 'oz',
    label: 'Kısa & Öz',
    desc: 'Hızlı karar vericiler için net özet',
    build: c => `Sayın ${c.contactPerson || 'Yetkili'},

${c.typeLabel} hizmetimiz için hazırladığımız fiyat teklifimiz aşağıdadır.

Toplam ${c.itemCount} kalem — genel toplam ₺${c.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} (KDV dahil). Teklifimiz ${c.validUntil} tarihine kadar geçerlidir.

Sorularınız için bizimle iletişime geçebilirsiniz.

Saygılarımızla,
${c.orgName}`
  },
  {
    key: 'samimi',
    label: 'Sıcak & Butik',
    desc: 'Yakın iş ortağı tonunda, kişisel vurgu',
    build: c => `Sayın ${c.contactPerson || 'Yetkili'},

${c.companyName || 'Firmanız'} ekibinin sağlığı bizim için öncelikli — ${c.typeLabel.toLowerCase()} hizmetimiz için hazırladığımız teklifi memnuniyetle paylaşıyoruz.

${c.itemCount} tetkik/hizmet kalemini${c.employeeCount ? `, ${c.employeeCount} çalışanınız için` : ''} kapsayan bu teklifte amacımız net: ekibinizin sağlık taramasını en hızlı ve en konforlu şekilde tamamlamak. Mobil ünitemizle kapınıza geliyoruz, siz işinize devam ediyorsunuz.

Teklifimiz ${c.validUntil} tarihine kadar geçerli. Bir kahve içimlik görüşmede tüm detayları konuşabiliriz.

Sağlıklı günler dileğiyle,
${c.orgName}`
  },
  {
    key: 'operasyonel',
    label: 'Operasyonel',
    desc: 'Mobil tarama lojistiğini öne çıkarır',
    build: c => `Sayın ${c.contactPerson || 'Yetkili'},

${c.companyName || 'Firmanız'} için planladığımız ${c.typeLabel.toLowerCase()} operasyonuna ilişkin fiyat teklifimizi sunarız.

Mobil tarama aracımızla işyerinize geliyor, ${c.itemCount} tetkik/hizmet kalemini sahada tamamlıyor ve sonuçları dijital olarak raporluyoruz — çalışanlarınız işten ayrılmak zorunda kalmaz, operasyon tek günde tamamlanır.

Teklifimiz ${c.validUntil} tarihine kadar geçerlidir. Onayınız sonrasında tarama tarihini birlikte planlayabiliriz.

Saygılarımızla,
${c.orgName}`
  }
];

/** Teklif türü etiketleri — başlık üretimi ve rozetler için */
const QUOTE_TYPES: { key: QuoteType; label: string; desc: string }[] = [
  { key: 'ise_giris', label: 'İşe Giriş Muayenesi', desc: 'Yeni işe alınacak personelin sağlık taraması' },
  { key: 'periyodik', label: 'Periyodik Muayene', desc: 'Mevcut çalışanların dönemsel sağlık kontrolü' }
];

const quoteTypeLabel = (t?: QuoteType) => QUOTE_TYPES.find(x => x.key === t)?.label;

/** Sihirbaz adım başlığı — tüm adımlarda aynı kompakt görünüm */
const StepHeader: React.FC<{ icon: React.ElementType; title: string; desc: React.ReactNode }> = ({ icon: Icon, title, desc }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-sm">
      <Icon size={17} />
    </div>
    <div className="min-w-0">
      <h2 className="text-base font-black text-slate-800 leading-tight">{title}</h2>
      <p className="text-[11px] text-slate-500 mt-0.5">{desc}</p>
    </div>
  </div>
);

/** Tutarlı panel — beyaz kart + başlık şeridi. overflowVisible: dropdown gibi taşan içerikler için */
const Panel: React.FC<{ icon?: React.ElementType; title: string; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; overflowVisible?: boolean }> = ({ icon: Icon, title, right, children, className = '', bodyClassName = 'p-4', overflowVisible = false }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl ${overflowVisible ? 'overflow-visible' : 'overflow-hidden'} ${className}`}>
    <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-3 rounded-t-2xl">
      <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
        {Icon && <Icon size={14} className="text-emerald-600" />}
        {title}
      </h3>
      {right}
    </div>
    <div className={bodyClassName}>{children}</div>
  </div>
);

/** Firma + tür + geçerlilik tarihinden otomatik teklif başlığı üretir */
const buildQuoteTitle = (companyName: string | undefined, type: QuoteType, validUntil: string): string => {
  const parts = [companyName || 'Firma', `${quoteTypeLabel(type)} Fiyat Teklifi`];
  const date = validUntil ? new Date(validUntil).toLocaleDateString('tr-TR') : '';
  return date ? `${parts.join(' — ')} (${date})` : parts.join(' — ');
};

interface QuoteForm {
  companyId: string;
  quoteNumber: string;
  quoteType: QuoteType;
  title: string;
  titleEdited: boolean; // kullanıcı başlığı elle değiştirdiyse otomatik doldurmayı durdur
  validUntil: string;
  items: QuoteItem[];
  discountRate: number;
  discountType: 'percent' | 'amount';
  vatRate: number;
  notes: string;
  coverLetter: string;
  coverLetterEdited: boolean; // kullanıcı metni elle değiştirdiyse şablon geçişinde sorulsuz yeniden üretme
  coverTemplate: string;      // seçili ön yazı şablonu
  terms: string[];            // seçili şartlar ve koşullar maddeleri
  includeCover: boolean;      // dokümanda ön yazı gösterilsin mi
  includeTerms: boolean;      // dokümanda şartlar gösterilsin mi
}

const emptyForm = (quoteNumber: string): QuoteForm => ({
  companyId: '',
  quoteNumber,
  quoteType: 'ise_giris',
  title: '',
  titleEdited: false,
  validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  items: [],
  discountRate: 0,
  discountType: 'percent',
  vatRate: 20,
  notes: '',
  coverLetter: '',
  coverLetterEdited: false,
  coverTemplate: 'kurumsal',
  terms: [],
  includeCover: true,
  includeTerms: true
});

// ─── Yazdırılabilir teklif dokümanı (önizleme + print ortak) ───
const QuoteDocument: React.FC<{ quote: Pick<Quote, 'quoteNumber' | 'title' | 'coverLetter' | 'terms' | 'createdAt' | 'validUntil' | 'items' | 'discountRate' | 'discountType' | 'vatRate' | 'notes'>; company?: Company }> = ({ quote, company }) => {
  const t = calcTotals(quote.items, quote.discountRate, quote.vatRate, quote.discountType ?? 'percent');
  const org = storageService.getOrgInfo();
  return (
    <div id="printable-content" className="p-8 sm:p-10 bg-white">
      {/* Antet */}
      <div className="flex justify-between items-start border-b-2 border-slate-800 pb-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center text-white"><Stethoscope size={26}/></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">{org.name}</h1>
            <p className="text-sm text-slate-500 font-semibold tracking-wide">FİYAT TEKLİFİ</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono font-bold text-slate-900">{quote.quoteNumber}</p>
          <p className="text-xs text-slate-500 mt-0.5">Tarih: {new Date(quote.createdAt).toLocaleDateString('tr-TR')}</p>
          <p className="text-xs text-slate-500">Geçerlilik: {new Date(quote.validUntil).toLocaleDateString('tr-TR')}</p>
        </div>
      </div>

      {/* Firma */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Sayın</p>
        <p className="text-lg font-black text-slate-900">{company?.name || '—'}</p>
        <div className="text-xs text-slate-600 mt-1 space-y-0.5">
          {company?.contactPerson && <p>İlgili: {company.contactPerson}</p>}
          {company?.address && <p>{company.address}</p>}
        </div>
      </div>

      {/* Konu / teklif başlığı */}
      {quote.title && (
        <div className="mb-6 flex items-baseline gap-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase shrink-0">Konu:</span>
          <span className="text-sm font-bold text-slate-800">{quote.title}</span>
        </div>
      )}

      {/* Ön yazı */}
      {quote.coverLetter && (
        <div className="mb-6 text-xs leading-relaxed text-slate-700 whitespace-pre-wrap border-l-2 border-slate-200 pl-4">
          {quote.coverLetter}
        </div>
      )}

      {/* Kalemler */}
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-b-2 border-slate-800 text-left text-[10px] font-bold text-slate-500 uppercase">
            <th className="py-2 pr-2 w-8">#</th>
            <th className="py-2">Hizmet / Tetkik</th>
            <th className="py-2 text-center w-20">Miktar</th>
            <th className="py-2 text-right w-28">Birim Fiyat</th>
            <th className="py-2 text-right w-28">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item, idx) => (
            <tr key={item.id} className="border-b border-slate-200">
              <td className="py-2.5 pr-2 text-slate-400 text-xs">{idx + 1}</td>
              <td className="py-2.5 font-medium text-slate-800 text-xs">{item.name}</td>
              <td className="py-2.5 text-center text-slate-600 text-xs tabular-nums">{item.quantity}</td>
              <td className="py-2.5 text-right text-slate-600 text-xs tabular-nums">₺{fmtTL(item.unitPrice)}</td>
              <td className="py-2.5 text-right font-bold text-slate-900 text-xs tabular-nums">₺{fmtTL(item.quantity * item.unitPrice)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Toplamlar */}
      <div className="flex justify-end mb-6">
        <div className="w-64 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600"><span>Ara Toplam</span><span className="tabular-nums">₺{fmtTL(t.sub)}</span></div>
          {quote.discountRate > 0 && (
            <div className="flex justify-between text-slate-600"><span>İndirim {(quote.discountType ?? 'percent') === 'percent' ? `(%${quote.discountRate})` : ''}</span><span className="tabular-nums">-₺{fmtTL(t.discount)}</span></div>
          )}
          <div className="flex justify-between text-slate-600"><span>KDV (%{quote.vatRate})</span><span className="tabular-nums">+₺{fmtTL(t.vat)}</span></div>
          <div className="flex justify-between pt-2 border-t-2 border-slate-800 font-black text-sm"><span>GENEL TOPLAM</span><span className="tabular-nums">₺{fmtTL(t.total)}</span></div>
        </div>
      </div>

      {/* Şartlar ve Koşullar */}
      {quote.terms && quote.terms.length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2 border-b border-slate-200 pb-1">Şartlar ve Koşullar</p>
          <ol className="list-decimal list-outside pl-4 space-y-1">
            {quote.terms.map((term, i) => (
              <li key={i} className="text-[11px] leading-relaxed text-slate-600">{term}</li>
            ))}
          </ol>
        </div>
      )}

      {/* Notlar */}
      {quote.notes && (
        <div className="border border-slate-300 rounded-lg p-3 mb-8 bg-slate-50">
          <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Notlar</p>
          <p className="text-xs text-slate-700 whitespace-pre-wrap">{quote.notes}</p>
        </div>
      )}

      {/* İmza */}
      <div className="flex justify-between items-end mt-10 pt-6 border-t border-slate-300">
        <div className="text-[10px] text-slate-400 space-y-0.5">
          <p>* Bu teklif {new Date(quote.validUntil).toLocaleDateString('tr-TR')} tarihine kadar geçerlidir.</p>
          {(org.phone || org.email) && <p>{[org.phone, org.email].filter(Boolean).join(' · ')}</p>}
          {org.address && <p>{org.address}</p>}
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-slate-900">{org.signerName || org.name}</p>
          <p className="text-[10px] text-slate-500 mb-8">{org.signerTitle || 'Yetkili'}{org.signerName ? ` · ${org.name}` : ''}</p>
          <div className="h-px w-40 bg-slate-400"></div>
          <p className="text-[10px] text-slate-500 mt-1">İmza / Kaşe</p>
        </div>
      </div>
    </div>
  );
};

export const Quotes: React.FC<QuotesProps> = ({ companies, allTests, onGoToDashboard, detailQuoteId, onNavigate, onBack }) => {
  const [quotes, setQuotes] = useState<Quote[]>(() => storageService.getQuotes());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuoteStatus | 'expired'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | QuoteType>('all');
  const [sortBy, setSortBy] = useState<'new' | 'amount_desc' | 'amount_asc' | 'validity'>('new');

  // Liste ↔ Sihirbaz ↔ Detay görünümü
  const [view, setView] = useState<'list' | 'wizard'>('list');
  const [wizardStep, setWizardStep] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteForm | null>(null);
  const [formError, setFormError] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [companyMenuOpen, setCompanyMenuOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState('');
  const [letterCopied, setLetterCopied] = useState(false);
  const [termSearch, setTermSearch] = useState('');

  // Detay görünümü URL'den türetilir — #/quotes/<id> refresh'te de korunur.
  // onNavigate bağlı değilse yerel state'e düşer (yedek mod).
  const [localDetailId, setLocalDetailId] = useState<string | null>(null);
  const activeDetailId = detailQuoteId ?? localDetailId;
  const detailQuote = activeDetailId ? (quotes.find(q => q.id === activeDetailId) ?? null) : null;
  const showDetail = activeDetailId != null;
  const [detailTab, setDetailTab] = useState<'doc' | 'items'>('doc');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClone, setConfirmClone] = useState<Quote | null>(null);
  const [draftRestored, setDraftRestored] = useState(false); // sihirbaz taslağı geri yüklendi bilgisi

  // Sihirbaz taslağını localStorage'a sürekli yaz — sayfa yenilense bile form korunur
  useEffect(() => {
    if (view === 'wizard' && form) {
      storageService.saveQuoteDraft({ form, wizardStep, editingId });
    }
  }, [view, form, wizardStep, editingId]);

  const persist = (next: Quote[]) => {
    setQuotes(next);
    storageService.saveQuotes(next);
  };

  const companyOf = (id: string) => companies.find(c => c.id === id);
  const formCompany = form?.companyId ? companyOf(form.companyId) : undefined;

  /** Form alanı güncelle + başlık elle değiştirilmediyse otomatik yeniden üret */
  const patchForm = (patch: Partial<QuoteForm>) => {
    setForm(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (!next.titleEdited) {
        next.title = buildQuoteTitle(companyOf(next.companyId)?.name, next.quoteType, next.validUntil);
      }
      return next;
    });
    setFormError('');
  };

  const nextQuoteNumber = () => {
    const year = new Date().getFullYear();
    const max = quotes.reduce((acc, q) => {
      const m = q.quoteNumber.match(/(\d+)$/);
      return m ? Math.max(acc, parseInt(m[1])) : acc;
    }, 0);
    return `TKL-${year}-${String(max + 1).padStart(3, '0')}`;
  };

  // ── Filtreleme ──
  const filteredQuotes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = quotes
      .filter(quote => statusFilter === 'all' || (statusFilter === 'expired' ? isExpired(quote) : quote.status === statusFilter))
      .filter(quote => typeFilter === 'all' || (quote.quoteType ?? 'ise_giris') === typeFilter)
      .filter(quote => {
        if (!q) return true;
        const comp = companies.find(c => c.id === quote.companyId);
        return (
          quote.quoteNumber.toLowerCase().includes(q) ||
          comp?.name.toLowerCase().includes(q) ||
          quote.title?.toLowerCase().includes(q) ||
          quote.notes?.toLowerCase().includes(q)
        );
      });
    switch (sortBy) {
      case 'amount_desc': return list.sort((a, b) => totalOf(b) - totalOf(a));
      case 'amount_asc': return list.sort((a, b) => totalOf(a) - totalOf(b));
      case 'validity': return list.sort((a, b) => a.validUntil.localeCompare(b.validUntil));
      default: return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  }, [quotes, searchTerm, statusFilter, typeFilter, sortBy, companies]);

  const stats = useMemo(() => ({
    total: quotes.length,
    taslak: quotes.filter(q => q.status === 'taslak').length,
    gonderildi: quotes.filter(q => q.status === 'gonderildi').length,
    expired: quotes.filter(q => isExpired(q)).length,
    bekleyenTutar: quotes.filter(q => q.status === 'gonderildi')
      .reduce((s, q) => s + totalOf(q), 0),
    onayliTutar: quotes.filter(q => q.status === 'onaylandi')
      .reduce((s, q) => s + totalOf(q), 0)
  }), [quotes]);

  // ── Sihirbaz ──
  const openCreate = () => {
    const draft = storageService.getQuoteDraft<{ form: QuoteForm; wizardStep: number; editingId: string | null }>();
    if (draft?.form) {
      // Yarım kalan taslak varsa kaldığı yerden devam et
      setForm(draft.form);
      setEditingId(draft.editingId ?? null);
      setWizardStep(draft.wizardStep || 1);
      setDraftRestored(true);
    } else {
      setEditingId(null);
      setForm(emptyForm(nextQuoteNumber()));
      setWizardStep(1);
      setDraftRestored(false);
    }
    setFormError('');
    setItemSearch('');
    setCategoryFilter('all');
    setView('wizard');
    setLocalDetailId(null);
    onNavigate?.('quotes');
  };

  /** Taslağı sıfırla — geri yüklenen taslağı atıp temiz form aç */
  const resetDraft = () => {
    storageService.clearQuoteDraft();
    setEditingId(null);
    setForm(emptyForm(nextQuoteNumber()));
    setWizardStep(1);
    setFormError('');
    setDraftRestored(false);
  };

  /** Sihirbazdan çık — taslak da temizlenir */
  const closeWizard = () => {
    storageService.clearQuoteDraft();
    setDraftRestored(false);
    setView('list');
  };

  const openEdit = (quote: Quote) => {
    setEditingId(quote.id);
    setForm({
      companyId: quote.companyId,
      quoteNumber: quote.quoteNumber,
      quoteType: quote.quoteType ?? 'ise_giris',
      title: quote.title ?? '',
      titleEdited: !!quote.title,
      validUntil: quote.validUntil,
      items: quote.items.map(i => ({ ...i })),
      discountRate: quote.discountRate,
      discountType: quote.discountType ?? 'percent',
      vatRate: quote.vatRate,
      notes: quote.notes ?? '',
      coverLetter: quote.coverLetter ?? '',
      coverLetterEdited: !!quote.coverLetter,
      coverTemplate: 'kurumsal',
      terms: [...(quote.terms ?? [])],
      includeCover: quote.includeCover !== false,
      includeTerms: quote.includeTerms !== false
    });
    setFormError('');
    setItemSearch('');
    setCategoryFilter('all');
    setWizardStep(3); // düzenlemede direkt fiyatlandırmaya git
    setView('wizard');
    setLocalDetailId(null);
    onNavigate?.('quotes');
  };

  const canProceed = (): boolean => {
    if (!form) return false;
    if (wizardStep === 1) return !!form.companyId;
    if (wizardStep === 2) return form.items.length > 0;
    if (wizardStep === 3) return form.items.every(i => i.name.trim());
    return true;
  };

  // Sidebar adım durumu — serbest geçiş için her adımın doluluk kontrolü
  const stepDone = (key: number): boolean => {
    if (!form) return false;
    if (key === 1) return !!form.companyId;
    if (key === 2) return form.items.length > 0;
    if (key === 3) return form.items.length > 0 && form.items.every(i => i.name.trim());
    if (key === 4) return form.coverLetter.trim().length > 0;
    if (key === 5) return form.terms.length > 0;
    return false;
  };

  const goNext = () => {
    if (!canProceed()) {
      if (wizardStep === 1) setFormError('Devam etmek için bir firma seçin.');
      else if (wizardStep === 2) setFormError('En az bir teklif kalemi ekleyin.');
      else if (wizardStep === 3) setFormError('Kalem adı boş bırakılamaz.');
      return;
    }
    setFormError('');
    goToStep(Math.min(6, wizardStep + 1));
  };

  const goBack = () => {
    setFormError('');
    setWizardStep(s => Math.max(1, s - 1));
  };

  /** Verilen form + firma verisiyle şablondan ön yazı metni üretir */
  const buildCoverLetter = (f: QuoteForm, tplKey: string): string => {
    const comp = f.companyId ? companyOf(f.companyId) : undefined;
    const totals = calcTotals(f.items, f.discountRate, f.vatRate, f.discountType);
    const tpl = COVER_TEMPLATES.find(t => t.key === tplKey) ?? COVER_TEMPLATES[0];
    return tpl.build({
      companyName: comp?.name,
      contactPerson: comp?.contactPerson,
      typeLabel: quoteTypeLabel(f.quoteType) ?? 'Sağlık Taraması',
      itemCount: f.items.length,
      employeeCount: comp?.employeeCount,
      total: totals.total,
      validUntil: f.validUntil ? new Date(f.validUntil).toLocaleDateString('tr-TR') : '',
      orgName: storageService.getOrgInfo().name
    });
  };

  /** Şablon değiştir — metni yeni şablonla yeniden üret */
  const selectCoverTemplate = (tplKey: string) => {
    setForm(prev => prev && ({
      ...prev,
      coverTemplate: tplKey,
      coverLetterEdited: false,
      coverLetter: buildCoverLetter(prev, tplKey)
    }));
  };

  /** Adım geçişi — ön yazı adımına girilirken metin boşsa otomatik üret */
  const goToStep = (step: number) => {
    setFormError('');
    if (step === 4) {
      setForm(prev => prev && !prev.coverLetter
        ? { ...prev, coverLetter: buildCoverLetter(prev, prev.coverTemplate) }
        : prev);
    }
    setWizardStep(step);
  };

  /** Yeni kalemler için varsayılan adet — firma çalışan sayısı baz alınır */
  const defaultQty = () => formCompany?.employeeCount ?? 1;

  const toggleTestItem = (test: TestDefinition) => {
    setForm(prev => {
      if (!prev) return prev;
      const exists = prev.items.some(i => i.testId === test.id);
      if (exists) return { ...prev, items: prev.items.filter(i => i.testId !== test.id) };
      return { ...prev, items: [...prev.items, { id: newItemId(), testId: test.id, name: test.name, quantity: defaultQty(), unitPrice: testPrice(test) }] };
    });
  };

  const addCustomItem = () => {
    setForm(prev => prev && ({ ...prev, items: [...prev.items, { id: newItemId(), name: '', quantity: defaultQty(), unitPrice: 0 }] }));
  };

  /** Test listesini kalemlere birleştirerek ekle (mevcutları atlar) */
  const mergeAddTests = (tests: TestDefinition[]) => {
    setForm(prev => {
      if (!prev) return prev;
      const existing = new Set(prev.items.map(i => i.testId));
      const additions = tests
        .filter(t => !existing.has(t.id))
        .map(t => ({ id: newItemId(), testId: t.id, name: t.name, quantity: defaultQty(), unitPrice: testPrice(t) }));
      return { ...prev, items: [...prev.items, ...additions] };
    });
  };

  const applyCompanyTemplate = () => {
    if (formCompany) mergeAddTests(formCompany.tests);
  };

  /** Tüm kalemlere aynı adedi uygula */
  const [bulkQty, setBulkQty] = useState<number | ''>('');
  const applyBulkQty = (qty: number) => {
    if (qty < 1) return;
    setForm(prev => prev && ({ ...prev, items: prev.items.map(i => ({ ...i, quantity: qty })) }));
  };

  const updateItem = (itemId: string, patch: Partial<QuoteItem>) => {
    setForm(prev => prev && ({ ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }));
  };

  const removeItem = (itemId: string) => {
    setForm(prev => prev && ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
  };

  /** Kalem sıralama — yukarı/aşağı taşı */
  const moveItem = (itemId: string, dir: 'up' | 'down') => {
    setForm(prev => {
      if (!prev) return prev;
      const items = [...prev.items];
      const i = items.findIndex(x => x.id === itemId);
      const j = dir === 'up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= items.length) return prev;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...prev, items };
    });
  };

  /** Seçilen kalemlerin canlı ara toplamı (KDV/indirim hariç) */
  const itemsSubtotal = form?.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0) ?? 0;

  // ── Şartlar & Koşullar maddeleri ──
  const termCtx: CoverCtx = {
    companyName: formCompany?.name,
    contactPerson: formCompany?.contactPerson,
    typeLabel: quoteTypeLabel(form?.quoteType ?? 'ise_giris') ?? 'Sağlık Taraması',
    itemCount: form?.items.length ?? 0,
    employeeCount: formCompany?.employeeCount,
    total: form ? calcTotals(form.items, form.discountRate, form.vatRate, form.discountType).total : 0,
    validUntil: form?.validUntil ? new Date(form.validUntil).toLocaleDateString('tr-TR') : '',
    orgName: storageService.getOrgInfo().name
  };

  const addTerm = (text: string) => setForm(prev => prev && ({ ...prev, terms: [...prev.terms, text] }));
  /** Birden çok maddeyi tek seferde ekle — ekli olanları atlar */
  const addTerms = (texts: string[]) => setForm(prev => {
    if (!prev) return prev;
    const existing = new Set(prev.terms);
    return { ...prev, terms: [...prev.terms, ...texts.filter(t => !existing.has(t))] };
  });
  /** Önerilen standart madde setini tek tıkla ekler */
  const addRecommendedTerms = () => {
    const texts = TERM_LIBRARY.flatMap(g => g.items.filter(t => t.rec).map(t => termText(t, termCtx)));
    addTerms(texts);
  };
  const updateTerm = (idx: number, text: string) => setForm(prev => prev && ({ ...prev, terms: prev.terms.map((t, i) => i === idx ? text : t) }));
  const removeTerm = (idx: number) => setForm(prev => prev && ({ ...prev, terms: prev.terms.filter((_, i) => i !== idx) }));
  const moveTerm = (idx: number, dir: 'up' | 'down') => setForm(prev => {
    if (!prev) return prev;
    const terms = [...prev.terms];
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= terms.length) return prev;
    [terms[idx], terms[j]] = [terms[j], terms[idx]];
    return { ...prev, terms };
  });

  const saveForm = () => {
    if (!form || !form.companyId || form.items.length === 0 || form.items.some(i => !i.name.trim())) {
      setFormError('Teklif eksik — firma ve kalemleri kontrol edin.');
      return;
    }

    const base: Omit<Quote, 'id'> = {
      companyId: form.companyId,
      quoteNumber: form.quoteNumber.trim() || nextQuoteNumber(),
      quoteType: form.quoteType,
      title: form.title.trim() || undefined,
      createdAt: editingId
        ? (quotes.find(q => q.id === editingId)?.createdAt ?? todayIso())
        : todayIso(),
      validUntil: form.validUntil,
      status: editingId ? (quotes.find(q => q.id === editingId)?.status ?? 'taslak') : 'taslak',
      items: form.items.map(i => ({ ...i, name: i.name.trim() })),
      discountRate: form.discountRate,
      discountType: form.discountType,
      vatRate: form.vatRate,
      notes: form.notes.trim() || undefined,
      coverLetter: form.coverLetter.trim() || undefined,
      terms: form.terms.map(t => t.trim()).filter(Boolean).length ? form.terms.map(t => t.trim()).filter(Boolean) : undefined,
      includeCover: form.includeCover,
      includeTerms: form.includeTerms
    };

    let saved: Quote;
    if (editingId) {
      saved = { ...base, id: editingId };
      persist(quotes.map(q => q.id === editingId ? saved : q));
    } else {
      saved = { ...base, id: newQuoteId() };
      persist([...quotes, saved]);
    }
    storageService.clearQuoteDraft(); // taslak artık kaydedildi — temizle
    setDraftRestored(false);
    setView('list'); // arka planda sihirbaz kalmasın — geri dönüldüğünde liste görünür
    openDetail(saved); // kaydedilen teklifin detay sayfasını aç (URL: #/quotes/<id>)
  };

  /** Detay sayfasını aç + URL'yi güncelle */
  const openDetail = (quote: Quote) => {
    setDetailTab('doc');
    if (onNavigate) onNavigate(`quotes/${quote.id}`);
    else setLocalDetailId(quote.id);
  };

  /** Detaydan geri dön — önceki sayfaya (genelde liste) gider, yoksa listeye düşer */
  const closeDetail = () => {
    setLocalDetailId(null);
    if (onBack) onBack('quotes');
    else onNavigate?.('quotes');
  };

  const setStatus = (id: string, status: QuoteStatus) => {
    persist(quotes.map(q => q.id === id ? { ...q, status } : q));
  };

  const doDelete = () => {
    if (!confirmDelete) return;
    persist(quotes.filter(q => q.id !== confirmDelete));
    if (activeDetailId === confirmDelete) closeDetail();
    setConfirmDelete(null);
  };

  const doClone = () => {
    if (!confirmClone) return;
    const cloned: Quote = {
      ...confirmClone,
      id: newQuoteId(),
      quoteNumber: nextQuoteNumber(),
      createdAt: todayIso(),
      status: 'taslak',
      items: confirmClone.items.map(i => ({ ...i, id: newItemId() }))
    };
    persist([...quotes, cloned]);
    setConfirmClone(null);
    openDetail(cloned); // kopyanın detayını aç
  };

  const formTotals = form ? calcTotals(form.items, form.discountRate, form.vatRate, form.discountType) : null;
  /** Birim fiyatı girilmemiş kalemler — uyarı için */
  const unpricedCount = form?.items.filter(i => i.unitPrice <= 0).length ?? 0;

  /** Havuzda gösterilecek testler — kategoride + aramada + henüz kaleme eklenmemiş olanlar */
  const filteredPoolTests = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const selected = new Set(form?.items.map(i => i.testId) ?? []);
    return allTests.filter(t =>
      !selected.has(t.id) &&
      (categoryFilter === 'all' || testCategory(t) === categoryFilter) &&
      (!q || t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q))
    );
  }, [allTests, itemSearch, categoryFilter, form?.items]);

  /** Firma arama — ad, yetkili, sektör alanlarında filtreler */
  const filteredCompanies = useMemo(() => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.contactPerson?.toLowerCase().includes(q) ||
      c.sector?.toLowerCase().includes(q)
    );
  }, [companies, companySearch]);

  /** Havuzda fiilen bulunan kategoriler — filtre çipleri için */
  const presentCategories = useMemo(() => {
    const cats = new Set(allTests.map(t => testCategory(t)));
    const ordered = TEST_CATEGORIES.filter(c => cats.has(c));
    const extra = [...cats].filter(c => !TEST_CATEGORIES.includes(c)).sort((a, b) => a.localeCompare(b, 'tr'));
    return [...ordered, ...extra];
  }, [allTests]);

  /** Havuz testlerini kategoriye göre grupla — kategori sırası TEST_CATEGORIES'e göre */
  const groupedPoolTests = useMemo(() => {
    const map = new Map<string, TestDefinition[]>();
    filteredPoolTests.forEach(t => {
      const cat = testCategory(t);
      map.set(cat, [...(map.get(cat) ?? []), t]);
    });
    const order = (cat: string) => {
      const i = TEST_CATEGORIES.indexOf(cat);
      return i === -1 ? TEST_CATEGORIES.length : i;
    };
    return [...map.entries()].sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b, 'tr'));
  }, [filteredPoolTests]);

  const inputCls = "w-full text-sm border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none p-2.5 transition-all placeholder-slate-400";
  const labelCls = "block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide";

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">

      {/* ══════════════ LİSTE GÖRÜNÜMÜ ══════════════ */}
      {!showDetail && view === 'list' && (
        <>
          {/* Başlık */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
                <FileText size={24} className="text-emerald-600" /> Teklifler
              </h1>
              <p className="text-xs text-slate-500 mt-1">Firmalara test paketi bazlı fiyat teklifi hazırlayın ve onay sürecini takip edin</p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-emerald-200 active:scale-95 shrink-0"
            >
              <Plus size={16} /> Yeni Teklif
            </button>
          </div>

          {/* Özet Kartlar — tıklanabilir filtre */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button onClick={() => setStatusFilter('all')} className={`bg-white rounded-2xl border p-4 flex items-center gap-3 text-left transition-all ${statusFilter === 'all' ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-200'}`}>
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><FileText size={18}/></div>
              <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.total}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Toplam Teklif</p></div>
            </button>
            <button onClick={() => setStatusFilter(f => f === 'taslak' ? 'all' : 'taslak')} className={`bg-white rounded-2xl border p-4 flex items-center gap-3 text-left transition-all ${statusFilter === 'taslak' ? 'border-slate-400 ring-2 ring-slate-200' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="w-10 h-10 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center shrink-0"><Edit2 size={18}/></div>
              <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.taslak}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Taslak</p></div>
            </button>
            <button onClick={() => setStatusFilter(f => f === 'gonderildi' ? 'all' : 'gonderildi')} className={`bg-white rounded-2xl border p-4 flex items-center gap-3 text-left transition-all ${statusFilter === 'gonderildi' ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'}`}>
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0"><Send size={18}/></div>
              <div><p className="text-xl font-black text-slate-800 tabular-nums">{stats.gonderildi}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Bekleyen Yanıt</p><p className="text-[9px] font-bold text-blue-500 tabular-nums">₺{fmtTL(stats.bekleyenTutar)}</p></div>
            </button>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0"><Calculator size={18}/></div>
              <div><p className="text-xl font-black text-emerald-600 tabular-nums">₺{fmtTL(stats.onayliTutar)}</p><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Onaylı Tutar</p></div>
            </div>
          </div>

          {/* Süresi dolan teklifler uyarısı */}
          {stats.expired > 0 && statusFilter !== 'expired' && (
            <button
              onClick={() => setStatusFilter('expired')}
              className="w-full flex items-center gap-3 p-3 bg-red-50 hover:bg-red-100/70 border border-red-200 rounded-2xl text-left transition-colors"
            >
              <AlertTriangle size={16} className="text-red-500 shrink-0" />
              <p className="text-xs font-bold text-red-700 flex-1">{stats.expired} teklifin geçerlilik süresi doldu — takip veya revizyon gerekiyor</p>
              <span className="text-[10px] font-bold text-red-500 shrink-0">Görüntüle →</span>
            </button>
          )}

          {/* Arama & Filtreler */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Teklif no, firma, başlık veya not ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all shadow-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as 'all' | QuoteType)}
                className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 text-slate-600 shadow-sm cursor-pointer"
              >
                <option value="all">Tüm Türler</option>
                <option value="ise_giris">İşe Giriş</option>
                <option value="periyodik">Periyodik Muayene</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 text-slate-600 shadow-sm cursor-pointer"
              >
                <option value="new">En Yeni</option>
                <option value="amount_desc">Tutar (Yüksek)</option>
                <option value="amount_asc">Tutar (Düşük)</option>
                <option value="validity">Geçerlilik (Yakın)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto scrollbar-none shadow-sm w-fit">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${statusFilter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >Tümü</button>
            {(Object.keys(STATUS_META) as QuoteStatus[]).map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${statusFilter === st ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[st].dot}`} />
                {STATUS_META[st].label}
              </button>
            ))}
            {stats.expired > 0 && (
              <button
                onClick={() => setStatusFilter('expired')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${statusFilter === 'expired' ? 'bg-red-600 text-white' : 'text-red-500 hover:bg-red-50'}`}
              >
                <AlertTriangle size={11} /> Süresi Dolmuş ({stats.expired})
              </button>
            )}
          </div>

          {/* Teklif Listesi */}
          {filteredQuotes.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 py-16 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-5">
                <FileText size={36} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-700">{quotes.length === 0 ? 'Henüz teklif yok' : 'Sonuç bulunamadı'}</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-xs">
                {quotes.length === 0
                  ? 'İlk fiyat teklifinizi oluşturarak satış sürecine başlayın.'
                  : 'Arama veya filtre kriterlerini değiştirmeyi deneyin.'}
              </p>
              {quotes.length === 0 && (
                <button onClick={openCreate} className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-emerald-200">
                  <Plus size={16} /> Teklif Oluştur
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="bg-slate-50/70 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-5 py-3">Teklif No</th>
                      <th className="px-4 py-3">Firma</th>
                      <th className="px-4 py-3">Tarih / Geçerlilik</th>
                      <th className="px-4 py-3">Kalem</th>
                      <th className="px-4 py-3 text-right">Genel Toplam</th>
                      <th className="px-4 py-3">Durum</th>
                      <th className="px-4 py-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredQuotes.map(quote => {
                      const comp = companyOf(quote.companyId);
                      const t = calcTotals(quote.items, quote.discountRate, quote.vatRate, quote.discountType ?? 'percent');
                      const expired = isExpired(quote);
                      return (
                        <tr key={quote.id} onClick={() => openDetail(quote)} className="hover:bg-emerald-50/30 cursor-pointer transition-colors">
                          <td className="px-5 py-3.5"><p className="font-bold text-slate-800 text-xs font-mono">{quote.quoteNumber}</p></td>
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-slate-700 text-xs">{comp?.name || '—'}</p>
                            {quote.title && <p className="text-[10px] text-slate-500 truncate max-w-[220px]" title={quote.title}>{quote.title}</p>}
                            {quote.quoteType && (
                              <span className="inline-block mt-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded">
                                {quoteTypeLabel(quote.quoteType)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-500">
                            {new Date(quote.createdAt).toLocaleDateString('tr-TR')}
                            <span className={`block text-[10px] ${expired ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                              Geçerlilik: {new Date(quote.validUntil).toLocaleDateString('tr-TR')}{expired ? ' (süresi doldu)' : ''}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-slate-500">{quote.items.length} kalem</td>
                          <td className="px-4 py-3.5 text-right"><span className="font-black text-slate-800 text-sm tabular-nums">₺{fmtTL(t.total)}</span></td>
                          <td className="px-4 py-3.5">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border inline-flex items-center gap-1.5 ${STATUS_META[quote.status].badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[quote.status].dot}`} />
                              {STATUS_META[quote.status].label}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {/* Hızlı durum geçişleri */}
                              {quote.status === 'taslak' && (
                                <button onClick={() => setStatus(quote.id, 'gonderildi')} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Gönderildi olarak işaretle"><Send size={14}/></button>
                              )}
                              {quote.status === 'gonderildi' && (
                                <>
                                  <button onClick={() => setStatus(quote.id, 'onaylandi')} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Onayla"><CheckCircle2 size={14}/></button>
                                  <button onClick={() => setStatus(quote.id, 'reddedildi')} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Reddet"><XCircle size={14}/></button>
                                </>
                              )}
                              {(quote.status === 'onaylandi' || quote.status === 'reddedildi') && (
                                <button onClick={() => setStatus(quote.id, 'taslak')} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Taslağa döndür"><RotateCcw size={14}/></button>
                              )}
                              <button onClick={() => openDetail(quote)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Detay / Yazdır"><Eye size={14}/></button>
                              <button onClick={() => openEdit(quote)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Düzenle"><Edit2 size={14}/></button>
                              <button onClick={() => setConfirmClone(quote)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Kopyala"><Copy size={14}/></button>
                              <button onClick={() => setConfirmDelete(quote.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Sil"><Trash2 size={14}/></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════ TEKLİF SİHİRBAZI ══════════════ */}
      {!showDetail && view === 'wizard' && form && (
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── SOL SIDEBAR: ADIMLAR ── */}
          <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-24 space-y-4">
            <button onClick={closeWizard} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors">
              <ArrowLeft size={14} /> Tekliflere Dön
            </button>

            {draftRestored && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800">
                <span className="flex items-center gap-1.5"><Sparkles size={12} /> Taslak geri yüklendi</span>
                <button onClick={resetDraft} className="underline underline-offset-2 hover:text-amber-950 transition-colors">Sıfırla</button>
              </div>
            )}

            {/* Adım listesi — mobilde yatay, masaüstünde dikey */}
            <div className="bg-white rounded-2xl border border-slate-200 p-2 lg:p-3 flex lg:flex-col gap-1.5 overflow-x-auto scrollbar-none">
              {WIZARD_STEPS.map(step => {
                const isActive = wizardStep === step.key;
                const done = stepDone(step.key);
                return (
                  <button
                    key={step.key}
                    onClick={() => goToStep(step.key)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all min-w-[140px] lg:min-w-0 lg:w-full ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-200 shadow-sm'
                        : done
                          ? 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/30'
                          : 'border-transparent bg-slate-50/50 hover:bg-slate-100'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isActive ? 'bg-emerald-600 text-white' : done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'
                    }`}>
                      {done && !isActive ? <Check size={15}/> : <step.icon size={15}/>}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold truncate ${isActive ? 'text-emerald-800' : done ? 'text-slate-700' : 'text-slate-500'}`}>
                        {step.key}. {step.label}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate hidden sm:block">{step.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Canlı özet kartı */}
            <div className="hidden lg:block bg-slate-800 text-white rounded-2xl p-4 space-y-2.5">
              <p className="font-mono text-[11px] font-bold text-emerald-400">{form.quoteNumber}</p>
              <div className="text-xs space-y-1.5">
                <div className="flex justify-between text-slate-300"><span>Firma</span><span className="font-bold text-white truncate max-w-[140px]">{formCompany?.name || '—'}</span></div>
                <div className="flex justify-between text-slate-300"><span>Kalem</span><span className="font-bold text-white">{form.items.length}</span></div>
                <div className="flex justify-between text-slate-300 pt-1.5 border-t border-slate-600"><span>Toplam</span><span className="font-black text-emerald-400 tabular-nums">₺{fmtTL(formTotals?.total ?? 0)}</span></div>
              </div>
            </div>
          </aside>

          {/* ── İÇERİK ── */}
          <div className="flex-1 min-w-0 space-y-5">
          {formError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200 text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-top-1">
              <XCircle size={15} className="shrink-0"/> {formError}
            </div>
          )}

          {/* ── ADIM 1: FİRMA SEÇİMİ ── */}
          {wizardStep === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <StepHeader icon={Building2} title="Firma & Teklif Bilgileri" desc="Teklif hazırlanacak firmayı seçin, tür ve geçerlilik bilgilerini belirleyin" />

              <div className="max-w-3xl mx-auto space-y-5">
              {/* Aramalı firma seçici — çok firma için ölçeklenir */}
              <Panel icon={Building2} title="Firma">
                <div>
                  <button
                    onClick={() => setCompanyMenuOpen(true)}
                    className={`w-full flex items-center gap-3 border-2 rounded-2xl px-4 py-3.5 text-left transition-all shadow-sm ${
                      formCompany ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-200' : 'border-slate-200 bg-white hover:border-emerald-400'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${formCompany ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {formCompany ? formCompany.name.substring(0, 2).toUpperCase() : <Building2 size={18}/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      {formCompany ? (
                        <>
                          <p className="text-sm font-bold text-slate-800 truncate">{formCompany.name}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1"><Factory size={9}/> {formCompany.sector || 'Sektör yok'}{formCompany.employeeCount !== undefined && ` · ${formCompany.employeeCount} çalışan`}</p>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-slate-400">Firma ara ve seç...</p>
                      )}
                    </div>
                    <ChevronDown size={16} className="text-slate-400"/>
                  </button>
                </div>

                {/* Seçili firma profil kartı */}
                {formCompany && (
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-sm font-black shrink-0">
                      {formCompany.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Sektör</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{formCompany.sector || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Çalışan</p>
                        <p className="text-xs font-bold text-slate-700">{formCompany.employeeCount ?? '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Yetkili</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{formCompany.contactPerson || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Şablon</p>
                        <p className="text-xs font-bold text-slate-700">{formCompany.tests.length} test</p>
                      </div>
                    </div>
                  </div>
                )}
              </Panel>

              {/* Teklif bilgileri — tür, geçerlilik, otomatik başlık */}
              <Panel icon={FileText} title="Teklif Bilgileri" bodyClassName="p-5 space-y-5" right={
                <span className="font-mono text-[11px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg px-2 py-0.5">{form.quoteNumber}</span>
              }>
                {/* Tür kartları */}
                <div>
                  <label className={labelCls}>Teklif Türü</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
                    {QUOTE_TYPES.map(t => {
                      const isSelected = form.quoteType === t.key;
                      return (
                        <button
                          key={t.key}
                          onClick={() => patchForm({ quoteType: t.key })}
                          className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                            isSelected ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-200' : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-emerald-600' : 'border-slate-300'}`}>
                              {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                            </div>
                            <span className={`text-sm font-bold ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>{t.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 ml-6">{t.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Geçerlilik — tarih + hızlı süre şablonları */}
                <div>
                  <label className={labelCls}><CalendarDays size={10} className="inline mr-1"/>Geçerlilik Tarihi</label>
                  <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 mt-1.5 items-start">
                    <input
                      type="date"
                      value={form.validUntil}
                      onChange={(e) => patchForm({ validUntil: e.target.value })}
                      className={inputCls}
                    />
                    <div>
                      <div className="flex flex-wrap gap-1.5">
                        {VALIDITY_PRESETS.map(days => {
                          const d = datePlusDays(days);
                          const active = form.validUntil === d;
                          return (
                            <button
                              key={days}
                              onClick={() => patchForm({ validUntil: d })}
                              className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg border transition-colors ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-700'}`}
                            >
                              {days} Gün
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {form.validUntil
                          ? <>Teklif <span className="font-bold text-slate-600">{new Date(form.validUntil).toLocaleDateString('tr-TR')}</span> tarihine kadar geçerli — {daysUntil(form.validUntil)} gün kaldı</>
                          : 'Geçerlilik tarihi seçin veya hazır sürelerden birine basın'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Başlık — tam genişlik */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Teklif Başlığı</label>
                    {form.titleEdited && (
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Elle düzenlendi</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => setForm(prev => prev && ({ ...prev, title: e.target.value, titleEdited: true }))}
                      className={inputCls + ' font-medium'}
                      placeholder="Örn. Anadolu Metal — İşe Giriş Muayenesi Fiyat Teklifi"
                    />
                    <button
                      onClick={() => setForm(prev => prev && ({ ...prev, titleEdited: false, title: buildQuoteTitle(formCompany?.name, prev.quoteType, prev.validUntil) }))}
                      className="p-2.5 shrink-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl transition-colors"
                      title="Başlığı firma + tür + tarihe göre otomatik yeniden üret"
                    >
                      <RotateCcw size={14}/>
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {form.titleEdited ? 'Sıfırlamak için yenile butonuna basın' : 'Firma, tür ve tarihe göre otomatik dolduruluyor'}
                  </p>
                </div>
              </Panel>
              </div>
            </div>
          )}

          {/* ── ADIM 2: KALEM SEÇİMİ ── */}
          {wizardStep === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <StepHeader icon={FlaskConical} title="Teklif Kalemleri" desc={<><span className="font-bold text-emerald-600">{formCompany?.name}</span> için test havuzundan tetkik seçin</>} />
              <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* ── SOL: TEST HAVUZU ── */}
                <Panel icon={FlaskConical} title="Test Havuzu" bodyClassName="p-0 flex flex-col" right={
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <div className="relative flex-1 max-w-[200px]">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <input
                        type="text"
                        placeholder="Tetkik ara..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="w-full pl-7 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">{allTests.length} test</span>
                  </div>
                }>
                  {/* Filtre şeridi — firma şablonu + kategoriler */}
                  <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                    {formCompany && formCompany.tests.length > 0 && (
                      <>
                        <button
                          onClick={applyCompanyTemplate}
                          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                          title="Firmanın kayıtlı test şablonunu toplu ekler"
                        >
                          <Building2 size={11}/> Firma Şablonunu Uygula ({formCompany.tests.length})
                        </button>
                        <span className="w-px h-4 bg-slate-200 shrink-0 mx-0.5" />
                      </>
                    )}
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${categoryFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                    >
                      Tümü
                    </button>
                    {presentCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}
                        className={`shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${categoryFilter === cat ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="max-h-[460px] overflow-y-auto">
                    {groupedPoolTests.map(([cat, tests]) => (
                        <div key={cat}>
                          {/* Kategori başlığı — scroll'da üstte sabit kalır */}
                          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-slate-50/95 backdrop-blur border-b border-slate-100">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{cat}</span>
                            <div className="flex items-center gap-2.5">
                              <span className="text-[9px] font-bold text-slate-400">{tests.length} test</span>
                              <button
                                onClick={() => mergeAddTests(tests)}
                                className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                              >
                                + Tümünü Ekle
                              </button>
                            </div>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {tests.map(test => {
                              const isPanel = !!(test.subTests && test.subTests.length > 0);
                              return (
                                <button
                                  key={test.id}
                                  onClick={() => toggleTestItem(test)}
                                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left transition-colors text-sm text-slate-600 hover:bg-emerald-50/60 hover:text-emerald-800"
                                >
                                  <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-slate-200 text-slate-400">
                                    <Plus size={12} />
                                  </div>
                                  <span className="font-medium truncate flex-1">{test.name}</span>
                                  {testPrice(test) > 0 && (
                                    <span className="text-[10px] font-bold text-slate-400 tabular-nums shrink-0">₺{fmtTL(testPrice(test))}</span>
                                  )}
                                  {isPanel && <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-bold">PANEL</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    {filteredPoolTests.length === 0 && (
                      <div className="p-8 text-center">
                        <CheckCircle2 size={24} className="mx-auto text-emerald-300 mb-2" />
                        <p className="text-sm text-slate-400 font-medium">
                          {allTests.every(t => form.items.some(i => i.testId === t.id)) ? 'Tüm testler eklendi' : 'Aramayla eşleşen tetkik yok'}
                        </p>
                      </div>
                    )}
                  </div>
                </Panel>

                {/* ── SAĞ: SEÇİLEN KALEMLER ── */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-fit lg:sticky lg:top-20">
                  <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide">Seçilen Kalemler</h3>
                    <div className="flex items-center gap-2">
                      {form.items.length > 0 && (
                        <button
                          onClick={() => setForm(prev => prev && ({ ...prev, items: [] }))}
                          className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
                          title="Tüm kalemleri kaldır"
                        >
                          Temizle
                        </button>
                      )}
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">{form.items.length} kalem</span>
                    </div>
                  </div>

                  {/* Toplu miktar */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">Toplu Miktar:</span>
                    <input
                      type="number" min={1}
                      value={bulkQty}
                      onChange={(e) => setBulkQty(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none px-2 py-1.5 text-center transition-all"
                      placeholder="Kişi"
                    />
                    <button
                      onClick={() => typeof bulkQty === 'number' && applyBulkQty(bulkQty)}
                      disabled={bulkQty === '' || form.items.length === 0}
                      className="px-3 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Uygula
                    </button>
                    {formCompany?.employeeCount !== undefined && (
                      <button
                        onClick={() => { setBulkQty(formCompany.employeeCount!); applyBulkQty(formCompany.employeeCount!); }}
                        className="px-3 py-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                        title="Firmanın kayıtlı çalışan sayısı"
                      >
                        <UsersIcon size={11} className="inline mr-1"/>{formCompany.employeeCount} çalışan
                      </button>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                    {form.items.length === 0 ? (
                      <div className="p-10 text-center">
                        <ClipboardList size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400 font-medium">Henüz kalem seçilmedi</p>
                        <p className="text-[11px] text-slate-400 mt-1">Soldan tetkik seçin veya özel kalem ekleyin</p>
                        <button onClick={addCustomItem} className="mt-3 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors">
                          Özel Kalem Ekle
                        </button>
                      </div>
                    ) : (
                      <>
                        {form.items.map((item, idx) => (
                          <div key={item.id} className="flex items-center gap-2 px-3 py-2">
                            {/* Sıralama okları */}
                            <div className="flex flex-col shrink-0">
                              <button
                                onClick={() => moveItem(item.id, 'up')}
                                disabled={idx === 0}
                                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"
                                title="Yukarı taşı"
                              >
                                <ChevronUp size={12}/>
                              </button>
                              <button
                                onClick={() => moveItem(item.id, 'down')}
                                disabled={idx === form.items.length - 1}
                                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"
                                title="Aşağı taşı"
                              >
                                <ChevronDown size={12}/>
                              </button>
                            </div>
                            <div className="flex-1 min-w-0">
                              {item.testId ? (
                                <span className="block text-xs font-medium text-slate-700 truncate">{item.name}</span>
                              ) : (
                                <input
                                  type="text"
                                  value={item.name}
                                  onChange={(e) => updateItem(item.id, { name: e.target.value })}
                                  className="w-full text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none px-2 py-1.5 transition-all font-medium"
                                  placeholder="Hizmet / test adı"
                                />
                              )}
                              {item.unitPrice > 0 && (
                                <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                                  ₺{fmtTL(item.unitPrice)} × {item.quantity} = <span className="font-bold text-slate-600">₺{fmtTL(item.quantity * item.unitPrice)}</span>
                                </p>
                              )}
                            </div>
                            <input
                              type="number" min={1}
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-16 shrink-0 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none px-2 py-1.5 text-center transition-all"
                              title="Kişi / Adet"
                            />
                            <button onClick={() => removeItem(item.id)} className="p-1.5 shrink-0 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={14}/></button>
                          </div>
                        ))}
                        <div className="px-4 py-2.5 bg-slate-50/40">
                          <button onClick={addCustomItem} className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors">
                            <Plus size={12}/> Özel Kalem Ekle
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {form.items.length > 0 && (
                    <div className="border-t border-slate-200">
                      <div className="px-4 py-2.5 flex justify-between items-center text-[11px]">
                        <span className="font-bold text-slate-500">Ara Toplam <span className="font-medium text-slate-400">(indirim/KDV hariç)</span></span>
                        <span className="font-black text-slate-800 tabular-nums">₺{fmtTL(itemsSubtotal)}</span>
                      </div>
                      <div className="px-4 py-2 bg-slate-50/60 text-[10px] text-slate-400 font-medium">
                        Adetler firma çalışan sayısı ({formCompany?.employeeCount ?? '—'}) baz alınarak doldu
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ADIM 3: FİYATLANDIRMA & KOŞULLAR ── */}
          {wizardStep === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <StepHeader icon={Calculator} title="Fiyatlandırma & Koşullar" desc="Kalem fiyatlarını, indirim ve KDV oranlarını belirleyin" />

              <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                {/* Kalem fiyat tablosu */}
                <Panel icon={ClipboardList} title="Kalemler & Birim Fiyatlar" className="lg:col-span-2" bodyClassName="p-3 space-y-2" right={
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">{form.items.length} kalem</span>
                }>
                  {/* Sıfır fiyat uyarısı + havuz fiyatına dön */}
                  {unpricedCount > 0 && (
                    <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
                      <p className="text-[11px] font-bold text-amber-700">{unpricedCount} kalemin birim fiyatı girilmedi</p>
                      <button
                        onClick={() => setForm(prev => prev && ({
                          ...prev,
                          items: prev.items.map(i => {
                            if (i.unitPrice > 0 || !i.testId) return i;
                            const t = allTests.find(x => x.id === i.testId);
                            return t ? { ...i, unitPrice: testPrice(t) } : i;
                          })
                        }))}
                        className="text-[10px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Liste Fiyatlarını Uygula
                      </button>
                    </div>
                  )}
                  {/* Kolon başlıkları — satır grid'iyle aynı hizalama */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-2.5">
                    <div className="col-span-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Kalem / Hizmet</div>
                    <div className="col-span-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Miktar</div>
                    <div className="col-span-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Birim Fiyat</div>
                    <div className="col-span-2 text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tutar</div>
                    <div className="col-span-1" />
                  </div>
                  {form.items.map(item => (
                    <div key={item.id} className={`grid grid-cols-12 gap-2 items-center bg-white border rounded-xl p-2.5 transition-colors ${item.unitPrice <= 0 ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'}`}>
                      <div className="col-span-12 sm:col-span-5">
                        <span className="sm:hidden block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kalem / Hizmet</span>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateItem(item.id, { name: e.target.value })}
                          className="w-full text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none px-2.5 py-2 transition-all font-medium"
                          placeholder="Hizmet / test adı"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <span className="sm:hidden block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-center">Miktar</span>
                        <input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="w-full text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none px-2.5 py-2 text-center transition-all" title="Kişi / Adet" />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <span className="sm:hidden block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 text-right">Birim Fiyat</span>
                        <input type="number" min={0} step={0.01} value={item.unitPrice || ''} onChange={(e) => updateItem(item.id, { unitPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className={`w-full text-xs border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 outline-none px-2.5 py-2 text-right transition-all ${item.unitPrice <= 0 ? 'border-amber-300 focus:ring-amber-100 focus:border-amber-400' : 'border-slate-200 focus:ring-emerald-100 focus:border-emerald-400'}`} placeholder="Birim ₺" />
                      </div>
                      <div className="col-span-3 sm:col-span-2 text-right">
                        <span className="sm:hidden block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tutar</span>
                        <span className="text-xs font-black text-slate-700 tabular-nums">₺{fmtTL(item.quantity * item.unitPrice)}</span>
                      </div>
                      <div className="col-span-1 text-right">
                        <button onClick={() => removeItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addCustomItem} className="w-full py-2.5 text-xs font-bold text-emerald-700 bg-emerald-50/60 hover:bg-emerald-100 border border-dashed border-emerald-300 rounded-xl transition-colors">
                    + Özel Kalem Ekle
                  </button>
                </Panel>

                {/* Sağ: indirim/KDV + toplam */}
                <div className="space-y-4">
                  <Panel icon={Calculator} title="İndirim & KDV" bodyClassName="p-4 space-y-3">
                    {/* İndirim — % veya sabit tutar */}
                    {/* İndirim — serbest oran/tutar girişi */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">İndirim</label>
                        <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                          {(['percent', 'amount'] as const).map(dt => (
                            <button
                              key={dt}
                              onClick={() => setForm(prev => prev && ({ ...prev, discountType: dt }))}
                              className={`px-2.5 py-1 text-[10px] font-black rounded-md transition-colors ${form.discountType === dt ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              {dt === 'percent' ? '%' : '₺'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative">
                        <input
                          type="number" min={0}
                          max={form.discountType === 'percent' ? 100 : undefined}
                          value={form.discountRate || ''}
                          onChange={(e) => setForm(prev => prev && ({ ...prev, discountRate: Math.max(0, parseFloat(e.target.value) || 0) }))}
                          className={inputCls + ' pr-9 font-bold'}
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                          {form.discountType === 'percent' ? '%' : '₺'}
                        </span>
                      </div>
                      {(formTotals?.discount ?? 0) > 0 && (
                        <p className="text-[10px] font-bold text-red-500 mt-1 tabular-nums">→ -₺{fmtTL(formTotals!.discount)}</p>
                      )}
                      <div className="flex gap-1 mt-1.5">
                        {[0, 5, 10, 15, 20].map(v => (
                          <button
                            key={v}
                            onClick={() => setForm(prev => prev && ({ ...prev, discountRate: v, discountType: 'percent' }))}
                            className={`flex-1 py-1 text-[10px] font-bold rounded-md border transition-colors ${form.discountType === 'percent' && form.discountRate === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'}`}
                          >
                            %{v}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* KDV — serbest oran girişi */}
                    <div>
                      <label className={labelCls}>KDV Oranı</label>
                      <div className="relative">
                        <input
                          type="number" min={0} max={100}
                          value={form.vatRate || ''}
                          onChange={(e) => setForm(prev => prev && ({ ...prev, vatRate: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) }))}
                          className={inputCls + ' pr-9 font-bold'}
                          placeholder="0"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">%</span>
                      </div>
                      {(formTotals?.vat ?? 0) > 0 && (
                        <p className="text-[10px] font-bold text-slate-500 mt-1 tabular-nums">→ +₺{fmtTL(formTotals!.vat)}</p>
                      )}
                      <div className="flex gap-1 mt-1.5">
                        {[0, 1, 8, 10, 20].map(v => (
                          <button
                            key={v}
                            onClick={() => setForm(prev => prev && ({ ...prev, vatRate: v }))}
                            className={`flex-1 py-1 text-[10px] font-bold rounded-md border transition-colors ${form.vatRate === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'}`}
                          >
                            %{v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Panel>

                  <div className="bg-slate-800 text-white rounded-2xl p-4 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300"><span>Ara Toplam</span><span className="tabular-nums">₺{fmtTL(formTotals?.sub ?? 0)}</span></div>
                    <div className="flex justify-between text-slate-300"><span>İndirim</span><span className="tabular-nums text-red-300">-₺{fmtTL(formTotals?.discount ?? 0)}</span></div>
                    <div className="flex justify-between text-slate-300"><span>KDV</span><span className="tabular-nums">+₺{fmtTL(formTotals?.vat ?? 0)}</span></div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-600 font-black text-sm"><span>Genel Toplam</span><span className="tabular-nums text-emerald-400">₺{fmtTL(formTotals?.total ?? 0)}</span></div>
                    {formCompany?.employeeCount !== undefined && formCompany.employeeCount > 0 && (formTotals?.total ?? 0) > 0 && (
                      <div className="flex justify-between pt-1 border-t border-slate-700 text-slate-300">
                        <span>Kişi Başı <span className="text-[9px] text-slate-500">({formCompany.employeeCount} çalışan)</span></span>
                        <span className="tabular-nums font-bold text-cyan-300">₺{fmtTL(Math.round((formTotals!.total / formCompany.employeeCount) * 100) / 100)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ADIM 4: ÖN YAZI ── */}
          {wizardStep === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <StepHeader icon={FileText} title="Teklif Ön Yazısı" desc="Şablon seçin — metin seçimlerinize göre otomatik üretilir, dilediğiniz gibi düzenleyin" />

              <div className="max-w-5xl mx-auto space-y-4">
                {/* Şablon kartları */}
                <Panel icon={ScrollText} title="Şablon Seçimi" bodyClassName="p-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
                  {COVER_TEMPLATES.map(tpl => {
                    const isSelected = form.coverTemplate === tpl.key;
                    return (
                      <button
                        key={tpl.key}
                        onClick={() => selectCoverTemplate(tpl.key)}
                        className={`p-3.5 rounded-xl border-2 text-left transition-all ${
                          isSelected ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-200' : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-emerald-600' : 'border-slate-300'}`}>
                            {isSelected && <div className="w-2 h-2 rounded-full bg-emerald-600" />}
                          </div>
                          <span className={`text-xs font-bold ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>{tpl.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 ml-6">{tpl.desc}</p>
                      </button>
                    );
                  })}
                </Panel>

                {/* Beslenen veri çipleri — metnin hangi bilgilerle üretildiğini gösterir */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mr-1">Otomatik veri:</span>
                  {formCompany?.name && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{formCompany.name}</span>}
                  {formCompany?.contactPerson && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{formCompany.contactPerson}</span>}
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{quoteTypeLabel(form.quoteType)}</span>
                  <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{form.items.length} kalem</span>
                  {(formTotals?.total ?? 0) > 0 && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">₺{fmtTL(formTotals!.total)}</span>}
                  {form.validUntil && <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-2 py-0.5">{new Date(form.validUntil).toLocaleDateString('tr-TR')}</span>}
                </div>

                {/* Editör + canlı doküman önizlemesi */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Sol: editör */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
                    <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Ön Yazı Metni</span>
                      <div className="flex items-center gap-2">
                        {form.coverLetterEdited && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">Elle düzenlendi</span>
                        )}
                        <button
                          onClick={() => { navigator.clipboard.writeText(form.coverLetter); setLetterCopied(true); setTimeout(() => setLetterCopied(false), 1500); }}
                          disabled={!form.coverLetter}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors disabled:opacity-40"
                          title="Metni panoya kopyala"
                        >
                          {letterCopied ? <><Check size={10} className="text-emerald-600"/> Kopyalandı</> : <><Copy size={10}/> Kopyala</>}
                        </button>
                        <button
                          onClick={() => setForm(prev => prev && ({ ...prev, coverLetterEdited: false, coverLetter: buildCoverLetter(prev, prev.coverTemplate) }))}
                          className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors"
                          title="Seçili şablonla yeniden üret"
                        >
                          <RotateCcw size={10}/> Yeniden Üret
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={form.coverLetter}
                      onChange={(e) => setForm(prev => prev && ({ ...prev, coverLetter: e.target.value, coverLetterEdited: true }))}
                      rows={16}
                      className="flex-1 w-full text-xs leading-relaxed text-slate-700 p-4 outline-none resize-y bg-white placeholder-slate-400 min-h-[320px]"
                      placeholder="Sayın Yetkili, ..."
                    />
                    <div className="px-4 py-2 bg-slate-50/60 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between">
                      <span>{form.coverLetter.length} karakter · {form.coverLetter.trim() ? form.coverLetter.trim().split(/\s+/).length : 0} kelime</span>
                      <span>{form.coverLetter.split('\n').filter(l => l.trim()).length} paragraf</span>
                    </div>
                  </div>

                  {/* Sağ: doküman görünümü — yazının teklifte nasıl görüneceği */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
                    <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Doküman Görünümü</span>
                      <span className="text-[9px] font-bold text-slate-400">Canlı</span>
                    </div>
                    <div className="flex-1 p-5 overflow-y-auto max-h-[480px]">
                      {/* Dokümandaki gibi: Sayın bloğu + mektup metni */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                        <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Sayın</p>
                        <p className="text-sm font-black text-slate-900">{formCompany?.name || '—'}</p>
                        {formCompany?.contactPerson && <p className="text-[10px] text-slate-500 mt-0.5">İlgili: {formCompany.contactPerson}</p>}
                      </div>
                      {form.title && (
                        <div className="mb-4 flex items-baseline gap-2">
                          <span className="text-[9px] font-bold text-slate-500 uppercase shrink-0">Konu:</span>
                          <span className="text-xs font-bold text-slate-800">{form.title}</span>
                        </div>
                      )}
                      {form.coverLetter ? (
                        <div className="text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap border-l-2 border-slate-200 pl-3">
                          {form.coverLetter}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-300 italic">Ön yazı metni burada görünecek</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ADIM 5: ŞARTLAR VE KOŞULLAR ── */}
          {wizardStep === 5 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <StepHeader icon={ScrollText} title="Şartlar ve Koşullar" desc="Kütüphaneden madde seçin — seçilenleri düzenleyebilir, silebilir, sıralayabilirsiniz" />

              <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
                {/* SOL: MADDE KÜTÜPHANESİ */}
                <div className="bg-white border border-slate-200 rounded-2xl max-h-[560px] overflow-y-auto">
                  <div className="sticky top-0 z-10 px-4 py-3 bg-slate-50/95 backdrop-blur border-b border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                        <ListChecks size={14}/> Madde Kütüphanesi
                      </h3>
                      <button
                        onClick={addRecommendedTerms}
                        className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg px-2.5 py-1 transition-colors whitespace-nowrap"
                        title="Standart teklifler için önerilen maddeleri toplu ekler"
                      >
                        Önerilen Set (7)
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                      <input
                        type="text"
                        placeholder="Madde ara..."
                        value={termSearch}
                        onChange={(e) => setTermSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                      />
                    </div>
                  </div>
                  {TERM_LIBRARY.map(group => {
                    const q = termSearch.trim().toLowerCase();
                    const visibleItems = group.items.filter(t => !q || termText(t, termCtx).toLowerCase().includes(q));
                    if (visibleItems.length === 0) return null;
                    const pendingTexts = visibleItems.map(t => termText(t, termCtx)).filter(t => !form.terms.includes(t));
                    return (
                      <div key={group.category}>
                        <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{group.category}</span>
                          <button
                            onClick={() => addTerms(pendingTexts)}
                            disabled={pendingTexts.length === 0}
                            className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 disabled:text-slate-300 transition-colors"
                          >
                            {pendingTexts.length === 0 ? 'Tümü eklendi' : '+ Tümünü Ekle'}
                          </button>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {visibleItems.map((term, ti) => {
                            const text = termText(term, termCtx);
                            const alreadyAdded = form.terms.includes(text);
                            return (
                              <div key={ti} className="flex items-start gap-2.5 px-4 py-3">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs leading-relaxed ${alreadyAdded ? 'text-slate-300 line-through' : 'text-slate-600'}`}>{text}</p>
                                  {term.rec && !alreadyAdded && <span className="inline-block mt-1 text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">ÖNERİLEN</span>}
                                </div>
                                <button
                                  onClick={() => !alreadyAdded && addTerm(text)}
                                  disabled={alreadyAdded}
                                  className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                                    alreadyAdded ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700'
                                  }`}
                                  title={alreadyAdded ? 'Zaten eklendi' : 'Maddeyi ekle'}
                                >
                                  {alreadyAdded ? <Check size={12}/> : <Plus size={12}/>}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {termSearch && TERM_LIBRARY.every(g => !g.items.some(t => termText(t, termCtx).toLowerCase().includes(termSearch.trim().toLowerCase()))) && (
                    <div className="p-8 text-center text-sm text-slate-400">Aramayla eşleşen madde yok</div>
                  )}
                </div>

                {/* SAĞ: SEÇİLEN MADDELER */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col h-fit lg:sticky lg:top-20">
                  <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between gap-3">
                    <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide">Teklif Şartları</h3>
                    <div className="flex items-center gap-2">
                      {form.terms.length > 0 && (
                        <button
                          onClick={() => setForm(prev => prev && ({ ...prev, terms: [] }))}
                          className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
                        >
                          Temizle
                        </button>
                      )}
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-0.5">{form.terms.length} madde</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
                    {form.terms.length === 0 ? (
                      <div className="p-10 text-center">
                        <ScrollText size={28} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400 font-medium">Henüz madde eklenmedi</p>
                        <p className="text-[11px] text-slate-400 mt-1">Soldan madde seçin veya özel madde ekleyin</p>
                        <button onClick={() => addTerm('')} className="mt-3 px-4 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors">
                          Özel Madde Ekle
                        </button>
                      </div>
                    ) : (
                      <>
                        {form.terms.map((term, idx) => (
                          <div key={idx} className="flex items-start gap-2 px-3 py-2">
                            <div className="flex flex-col shrink-0 pt-1">
                              <button onClick={() => moveTerm(idx, 'up')} disabled={idx === 0} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"><ChevronUp size={12}/></button>
                              <button onClick={() => moveTerm(idx, 'down')} disabled={idx === form.terms.length - 1} className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-20 transition-colors"><ChevronDown size={12}/></button>
                            </div>
                            <span className="text-[10px] font-black text-slate-300 w-4 pt-1.5 text-center shrink-0">{idx + 1}</span>
                            <textarea
                              value={term}
                              onChange={(e) => updateTerm(idx, e.target.value)}
                              rows={2}
                              className="flex-1 min-w-0 text-xs leading-relaxed border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none px-2.5 py-1.5 transition-all resize-y"
                              placeholder="Madde metni"
                            />
                            <button onClick={() => removeTerm(idx)} className="p-1.5 shrink-0 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-0.5"><X size={14}/></button>
                          </div>
                        ))}
                        <div className="px-4 py-2.5 bg-slate-50/40">
                          <button onClick={() => addTerm('')} className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors">
                            <Plus size={12}/> Özel Madde Ekle
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {form.terms.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/60 text-[10px] text-slate-400 font-medium">
                      Maddeler dokümanda "Şartlar ve Koşullar" başlığı altında numaralı liste olarak basılır
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ADIM 6: ÖNİZLEME ── */}
          {wizardStep === 6 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <StepHeader icon={Eye} title="Teklif Önizlemesi" desc="Dokümanı son kez kontrol edin — yazdırabilir veya kaydedebilirsiniz" />
              <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">

                {/* SOL: kontrol + seçenekler paneli */}
                <div className="space-y-4 lg:sticky lg:top-6">

                  {/* Kontrol listesi */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200">
                      <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                        <ListChecks size={14}/> Kontrol Listesi
                      </h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {([
                        { ok: !!form.companyId, label: 'Firma seçildi', warn: false },
                        { ok: !!form.title.trim(), label: 'Teklif başlığı girildi', warn: false },
                        { ok: !!form.validUntil, label: 'Geçerlilik tarihi belirlendi', warn: false },
                        { ok: form.items.length > 0, label: `${form.items.length} kalem eklendi`, warn: false },
                        { ok: !form.items.some(i => i.unitPrice <= 0), label: 'Tüm fiyatlar girildi', warn: true },
                        { ok: !!form.coverLetter.trim(), label: 'Ön yazı hazır', warn: true },
                        { ok: form.terms.some(t => t.trim()), label: 'Şart maddeleri eklendi', warn: true }
                      ] as const).map((c, i) => (
                        <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${c.ok ? 'bg-emerald-100 text-emerald-600' : c.warn ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-500'}`}>
                            {c.ok ? <Check size={11}/> : c.warn ? <AlertTriangle size={11}/> : <X size={11}/>}
                          </span>
                          <span className={`text-xs font-medium ${c.ok ? 'text-slate-600' : c.warn ? 'text-amber-600' : 'text-red-600'}`}>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mali özet */}
                  <div className="bg-slate-800 rounded-2xl p-4 text-white">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Mali Özet</div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><span className="text-slate-400">Ara Toplam</span><span className="font-semibold tabular-nums">₺{fmtTL(formTotals?.sub ?? 0)}</span></div>
                      {(formTotals?.discount ?? 0) > 0 && <div className="flex justify-between"><span className="text-slate-400">İndirim {form.discountType === 'percent' ? `(%${form.discountRate})` : ''}</span><span className="font-semibold text-red-300 tabular-nums">-₺{fmtTL(formTotals!.discount)}</span></div>}
                      <div className="flex justify-between"><span className="text-slate-400">KDV (%{form.vatRate})</span><span className="font-semibold tabular-nums">₺{fmtTL(formTotals?.vat ?? 0)}</span></div>
                      <div className="flex justify-between pt-2 mt-1 border-t border-slate-700"><span className="font-bold">Genel Toplam</span><span className="font-black text-emerald-400 text-sm tabular-nums">₺{fmtTL(formTotals?.total ?? 0)}</span></div>
                    </div>
                  </div>

                  {/* Doküman seçenekleri */}
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200">
                      <h3 className="text-xs font-black text-slate-600 uppercase tracking-wide flex items-center gap-2">
                        <Eye size={14}/> Doküman İçeriği
                      </h3>
                    </div>
                    <div className="p-3 space-y-2">
                      {([
                        { key: 'includeCover' as const, label: 'Ön Yazı', desc: 'Mektup metni basılır', has: !!form.coverLetter.trim() },
                        { key: 'includeTerms' as const, label: 'Şartlar & Koşullar', desc: 'Numaralı madde listesi', has: form.terms.some(t => t.trim()) }
                      ]).map(opt => (
                        <label key={opt.key} className={`flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-colors ${opt.has ? 'border-slate-200 cursor-pointer hover:border-slate-300' : 'border-slate-100 opacity-50'}`}>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-700">{opt.label}</div>
                            <div className="text-[10px] text-slate-400">{opt.has ? opt.desc : 'İçerik girilmedi'}</div>
                          </div>
                          <button
                            type="button"
                            disabled={!opt.has}
                            onClick={() => setForm(prev => prev && ({ ...prev, [opt.key]: !prev[opt.key] }))}
                            className={`w-9 h-5 rounded-full relative transition-colors shrink-0 ${form[opt.key] ? 'bg-emerald-500' : 'bg-slate-200'}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form[opt.key] ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                        </label>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-slate-100 text-[10px] text-slate-400">
                      Tercihler teklifle birlikte kaydedilir
                    </div>
                  </div>

                  {/* Yazdır */}
                  <button
                    onClick={() => window.print()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-2xl transition-all shadow-sm active:scale-[0.98]"
                  >
                    <Printer size={15}/> Yazdır / PDF
                  </button>
                </div>

                {/* SAĞ: doküman önizlemesi */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Baskı Önizlemesi — A4</span>
                    <span className="font-mono text-[11px] font-bold text-slate-500">{form.quoteNumber}</span>
                  </div>
                  <QuoteDocument
                    quote={{
                      quoteNumber: form.quoteNumber,
                      title: form.title || undefined,
                      coverLetter: form.includeCover ? form.coverLetter || undefined : undefined,
                      terms: form.includeTerms && form.terms.filter(t => t.trim()).length ? form.terms.filter(t => t.trim()) : undefined,
                      createdAt: new Date().toISOString().split('T')[0],
                      validUntil: form.validUntil,
                      items: form.items,
                      discountRate: form.discountRate,
                      discountType: form.discountType,
                      vatRate: form.vatRate,
                      notes: form.notes || undefined
                    }}
                    company={formCompany}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Alt navigasyon — viewport dibine yapışık yüzen bar */}
          <div className="sticky bottom-3 z-30 pt-2">
            <div className="flex items-center justify-between gap-3 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl px-2.5 py-2 shadow-xl shadow-slate-200/70">
              <button
                onClick={wizardStep === 1 ? closeWizard : goBack}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ArrowLeft size={14} /> {wizardStep === 1 ? 'Vazgeç' : 'Geri'}
              </button>

              {/* Adım göstergesi */}
              <div className="hidden sm:flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Adım {wizardStep}/6</span>
                <div className="flex gap-1">
                  {WIZARD_STEPS.map(s => (
                    <button
                      key={s.key}
                      onClick={() => goToStep(s.key)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${wizardStep === s.key ? 'bg-emerald-600 scale-110' : stepDone(s.key) ? 'bg-emerald-300 hover:bg-emerald-400' : 'bg-slate-200 hover:bg-slate-300'}`}
                      title={s.label}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-slate-500 truncate">{WIZARD_STEPS.find(s => s.key === wizardStep)?.label}</span>
              </div>

              {wizardStep < 6 ? (
                <button
                  onClick={goNext}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-200 active:scale-95"
                >
                  Devam Et <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  onClick={saveForm}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-emerald-200 active:scale-95"
                >
                  <CheckCircle2 size={15} /> {editingId ? 'Değişiklikleri Kaydet' : 'Teklifi Kaydet'}
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ═══ TEKLİF DETAY SAYFASI — #/quotes/<id> ═══ */}
      {showDetail && !detailQuote && (
        <div className="max-w-md mx-auto mt-16 bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm animate-in fade-in duration-300">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center"><AlertTriangle size={22}/></div>
          <h2 className="text-base font-black text-slate-800">Teklif Bulunamadı</h2>
          <p className="text-xs text-slate-500 mt-1.5 mb-5">Bu teklif silinmiş veya bağlantı hatalı olabilir.</p>
          <button onClick={closeDetail} className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors"><ArrowLeft size={14}/> Teklif Listesine Dön</button>
        </div>
      )}
      {showDetail && detailQuote && (() => {
        const vq = detailQuote;
        const vqCompany = companyOf(vq.companyId);
        const vqTotals = calcTotals(vq.items, vq.discountRate, vq.vatRate, vq.discountType ?? 'percent');
        const vqExpired = isExpired(vq);
        const remainDays = daysUntil(vq.validUntil);

        // Durum akışı stepper'ı — reddedildiyse son düğüm kırmızı "Reddedildi" olur
        const pipeSteps: { key: QuoteStatus; label: string; reached: boolean }[] = [
          { key: 'taslak', label: 'Taslak', reached: true },
          { key: 'gonderildi', label: 'Gönderildi', reached: vq.status !== 'taslak' },
          {
            key: vq.status === 'reddedildi' ? 'reddedildi' : 'onaylandi',
            label: vq.status === 'reddedildi' ? 'Reddedildi' : 'Onaylandı',
            reached: vq.status === 'onaylandi' || vq.status === 'reddedildi'
          }
        ];
        const statusHint =
          vq.status === 'taslak' ? 'Henüz gönderilmedi — hazır olunca gönderildi olarak işaretleyin' :
          vq.status === 'gonderildi' ? (vqExpired ? 'Geçerlilik süresi doldu — revizyon veya takip önerilir' : `Firmadan yanıt bekleniyor · ${remainDays} gün kaldı`) :
          vq.status === 'onaylandi' ? 'Teklif onaylandı — tarama planlamaya geçebilirsiniz' :
          'Teklif reddedildi — gerekirse kopyalayıp revize edin';

        // Geçerlilik çubuğu — oluşturma→bitiş arası geçen süre
        const usedPct = validityUsedPct(vq.createdAt, vq.validUntil);

        // Aynı firmanın diğer teklifleri
        const related = quotes
          .filter(q => q.companyId === vq.companyId && q.id !== vq.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 4);

        const tabCls = (t: 'doc' | 'items') =>
          `px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors ${detailTab === t ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'}`;

        return (
          <div className="space-y-5 animate-in fade-in duration-300">

            {/* Üst bar — geri + kimlik + aksiyonlar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button onClick={closeDetail} className="p-2 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors shrink-0 shadow-sm"><ArrowLeft size={16}/></button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-black text-slate-800 font-mono">{vq.quoteNumber}</h1>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1.5 ${STATUS_META[vq.status].badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[vq.status].dot}`} />
                      {STATUS_META[vq.status].label}
                    </span>
                    {vqExpired && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-red-50 text-red-600 border-red-200">SÜRESİ DOLDU</span>}
                  </div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{vq.title || vqCompany?.name || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {vq.status !== 'taslak' && (
                  <button onClick={() => setStatus(vq.id, 'taslak')} className="flex items-center gap-1 px-3 py-2 text-[11px] font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"><RotateCcw size={12}/> Taslağa Al</button>
                )}
                {vq.status === 'taslak' && (
                  <button onClick={() => setStatus(vq.id, 'gonderildi')} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors"><Send size={12}/> Gönderildi İşaretle</button>
                )}
                {vq.status === 'gonderildi' && (
                  <>
                    <button onClick={() => setStatus(vq.id, 'onaylandi')} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"><CheckCircle2 size={12}/> Onayla</button>
                    <button onClick={() => setStatus(vq.id, 'reddedildi')} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"><XCircle size={12}/> Reddet</button>
                  </>
                )}
                <span className="w-px h-5 bg-slate-200 mx-1 hidden sm:block" />
                <button onClick={() => openEdit(vq)} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-700 rounded-xl transition-colors"><Edit2 size={12}/> Düzenle</button>
                <button onClick={() => setConfirmClone(vq)} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-colors"><Copy size={12}/> Kopyala</button>
                <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-colors"><Printer size={12}/> Yazdır</button>
                <button onClick={() => import('../../services/quotePdfService').then(m => m.previewQuotePdf(vq, vqCompany))} className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-xl transition-colors"><Eye size={12}/> Önizle</button>
                <button onClick={() => import('../../services/quotePdfService').then(m => m.downloadQuotePdf(vq, vqCompany))} className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-md shadow-emerald-200"><Download size={12}/> PDF İndir</button>
                <button onClick={() => setConfirmDelete(vq.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-200 bg-white rounded-xl transition-colors" title="Sil"><Trash2 size={13}/></button>
              </div>
            </div>

            {/* Durum akışı stepper'ı */}
            <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center flex-1 min-w-0">
                {pipeSteps.map((s, i) => (
                  <React.Fragment key={s.key}>
                    {i > 0 && <div className={`flex-1 h-0.5 mx-2 rounded-full min-w-4 ${s.reached ? 'bg-slate-300' : 'bg-slate-100'}`} />}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${s.reached ? `${PIPE_NODE[s.key]} text-white` : 'bg-white border-slate-300 text-slate-300'}`}>
                        {s.reached ? <Check size={12} strokeWidth={3}/> : <span className="text-[9px] font-black">{i + 1}</span>}
                      </div>
                      <span className={`text-[11px] font-bold ${s.reached ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <span className={`text-[11px] font-bold shrink-0 ${vq.status === 'reddedildi' || vqExpired ? 'text-red-500' : 'text-slate-500'}`}>{statusHint}</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">

              {/* Sol: sekmeli kart — Doküman / Kalemler */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm order-2 xl:order-1">
                <div className="px-3 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl p-1">
                    <button onClick={() => setDetailTab('doc')} className={tabCls('doc')}><span className="flex items-center gap-1.5"><FileText size={12}/> Doküman</span></button>
                    <button onClick={() => setDetailTab('items')} className={tabCls('items')}><span className="flex items-center gap-1.5"><ListChecks size={12}/> Kalemler ({vq.items.length})</span></button>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 shrink-0">{detailTab === 'doc' ? 'A4 Önizleme' : 'Hızlı Liste'} · {new Date(vq.createdAt).toLocaleDateString('tr-TR')}</span>
                </div>
                {detailTab === 'doc' ? (
                  <QuoteDocument
                    quote={{
                      ...vq,
                      coverLetter: vq.includeCover === false ? undefined : vq.coverLetter,
                      terms: vq.includeTerms === false ? undefined : vq.terms
                    }}
                    company={vqCompany}
                  />
                ) : (
                  <div className="p-4 sm:p-5 overflow-x-auto">
                    <table className="w-full min-w-[440px]">
                      <thead>
                        <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                          <th className="text-left py-2 pr-2">Kalem / Hizmet</th>
                          <th className="text-center py-2 px-2 w-16">Miktar</th>
                          <th className="text-right py-2 px-2 w-28">Birim Fiyat</th>
                          <th className="text-right py-2 pl-2 w-28">Tutar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vq.items.map(item => (
                          <tr key={item.id}>
                            <td className="py-2.5 pr-2 text-xs font-medium text-slate-700">{item.name}</td>
                            <td className="py-2.5 px-2 text-center text-xs text-slate-600 tabular-nums">{item.quantity}</td>
                            <td className="py-2.5 px-2 text-right text-xs text-slate-600 tabular-nums">₺{fmtTL(item.unitPrice)}</td>
                            <td className="py-2.5 pl-2 text-right text-xs font-bold text-slate-800 tabular-nums">₺{fmtTL(item.quantity * item.unitPrice)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-200">
                          <td colSpan={3} className="pt-3 text-right text-[11px] font-bold text-slate-500">Ara Toplam</td>
                          <td className="pt-3 pl-2 text-right text-xs font-bold text-slate-700 tabular-nums">₺{fmtTL(vqTotals.sub)}</td>
                        </tr>
                        {vqTotals.discount > 0 && (
                          <tr>
                            <td colSpan={3} className="py-1 text-right text-[11px] font-bold text-slate-500">İndirim {vq.discountType === 'percent' ? `(%${vq.discountRate})` : '(sabit)'}</td>
                            <td className="py-1 pl-2 text-right text-xs font-bold text-red-500 tabular-nums">-₺{fmtTL(vqTotals.discount)}</td>
                          </tr>
                        )}
                        <tr>
                          <td colSpan={3} className="py-1 text-right text-[11px] font-bold text-slate-500">KDV (%{vq.vatRate})</td>
                          <td className="py-1 pl-2 text-right text-xs font-bold text-slate-700 tabular-nums">₺{fmtTL(vqTotals.vat)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="pt-2 pb-1 text-right text-[11px] font-black text-slate-700">GENEL TOPLAM</td>
                          <td className="pt-2 pb-1 pl-2 text-right text-sm font-black text-emerald-600 tabular-nums">₺{fmtTL(vqTotals.total)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Sağ: özet paneli */}
              <div className="space-y-4 order-1 xl:order-2 xl:sticky xl:top-6">

                {/* Firma kartı */}
                <Panel icon={Building2} title="Firma">
                  {vqCompany ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-xs font-black shrink-0">{vqCompany.name.substring(0, 2).toUpperCase()}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{vqCompany.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{vqCompany.sector || '—'}{vqCompany.employeeCount !== undefined && ` · ${vqCompany.employeeCount} çalışan`}</p>
                        {vqCompany.contactPerson && <p className="text-[10px] text-slate-400 truncate">{vqCompany.contactPerson}{vqCompany.phone ? ` · ${vqCompany.phone}` : ''}</p>}
                        {vqCompany.email && <p className="text-[10px] text-slate-400 truncate">{vqCompany.email}</p>}
                      </div>
                    </div>
                  ) : <p className="text-xs text-slate-400 italic">Firma kaydı silinmiş</p>}
                </Panel>

                {/* Mali özet */}
                <div className="bg-slate-800 rounded-2xl p-4 text-white">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Mali Özet</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Ara Toplam</span><span className="font-semibold tabular-nums">₺{fmtTL(vqTotals.sub)}</span></div>
                    {vqTotals.discount > 0 && <div className="flex justify-between"><span className="text-slate-400">İndirim {vq.discountType === 'percent' ? `(%${vq.discountRate})` : ''}</span><span className="font-semibold text-red-300 tabular-nums">-₺{fmtTL(vqTotals.discount)}</span></div>}
                    <div className="flex justify-between"><span className="text-slate-400">KDV (%{vq.vatRate})</span><span className="font-semibold tabular-nums">₺{fmtTL(vqTotals.vat)}</span></div>
                    <div className="flex justify-between pt-2 mt-1 border-t border-slate-700"><span className="font-bold">Genel Toplam</span><span className="font-black text-emerald-400 text-sm tabular-nums">₺{fmtTL(vqTotals.total)}</span></div>
                    {vqCompany?.employeeCount ? (
                      <div className="flex justify-between pt-1 border-t border-slate-700"><span className="text-slate-400">Kişi Başı</span><span className="font-bold text-cyan-300 tabular-nums">₺{fmtTL(Math.round((vqTotals.total / vqCompany.employeeCount) * 100) / 100)}</span></div>
                    ) : null}
                  </div>
                </div>

                {/* Geçerlilik çubuğu */}
                <Panel icon={CalendarDays} title="Geçerlilik">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                    <span>{new Date(vq.createdAt).toLocaleDateString('tr-TR')}</span>
                    <ArrowRight size={11} className="text-slate-300 self-center" />
                    <span className={vqExpired ? 'text-red-600 font-bold' : ''}>{new Date(vq.validUntil).toLocaleDateString('tr-TR')}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${vqExpired ? 'bg-red-500' : remainDays <= 7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                  <p className={`text-[11px] font-bold mt-1.5 ${vqExpired ? 'text-red-600' : remainDays <= 7 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {vqExpired ? 'Süresi doldu' : `${remainDays} gün kaldı`}
                  </p>
                </Panel>

                {/* Detaylar */}
                <Panel icon={ClipboardList} title="Detaylar" bodyClassName="p-0">
                  <div className="divide-y divide-slate-100 text-xs">
                    <div className="flex justify-between px-4 py-2.5"><span className="text-slate-500 font-medium">Tür</span><span className="font-bold text-slate-700">{quoteTypeLabel(vq.quoteType) ?? '—'}</span></div>
                    <div className="flex justify-between px-4 py-2.5"><span className="text-slate-500 font-medium">Kalem</span><span className="font-bold text-slate-700">{vq.items.length} kalem · {vq.items.reduce((s, i) => s + i.quantity, 0)} adet</span></div>
                    <div className="flex justify-between px-4 py-2.5"><span className="text-slate-500 font-medium">Ön Yazı</span><span className={`font-bold ${vq.coverLetter && vq.includeCover !== false ? 'text-emerald-600' : 'text-slate-400'}`}>{vq.coverLetter && vq.includeCover !== false ? 'Dahil' : 'Yok'}</span></div>
                    <div className="flex justify-between px-4 py-2.5"><span className="text-slate-500 font-medium">Şartlar</span><span className={`font-bold ${vq.terms?.length && vq.includeTerms !== false ? 'text-emerald-600' : 'text-slate-400'}`}>{vq.terms?.length && vq.includeTerms !== false ? `${vq.terms.length} madde` : 'Yok'}</span></div>
                  </div>
                </Panel>

                {/* Teklif notları */}
                {vq.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">Teklif Notları</div>
                    <p className="text-xs text-amber-800 whitespace-pre-wrap leading-relaxed">{vq.notes}</p>
                  </div>
                )}

                {/* İlişkili teklifler — aynı firma */}
                {related.length > 0 && (
                  <Panel icon={FileText} title="Firmanın Diğer Teklifleri" bodyClassName="p-0">
                    <div className="divide-y divide-slate-100">
                      {related.map(rq => (
                        <button key={rq.id} onClick={() => openDetail(rq)} className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_META[rq.status].dot}`} />
                          <span className="text-xs font-mono font-bold text-slate-700">{rq.quoteNumber}</span>
                          <span className="text-[10px] text-slate-400">{new Date(rq.createdAt).toLocaleDateString('tr-TR')}</span>
                          <span className="ml-auto text-xs font-bold text-slate-700 tabular-nums">₺{fmtTL(totalOf(rq))}</span>
                        </button>
                      ))}
                    </div>
                  </Panel>
                )}

                {/* Onaylıysa operasyon köprüsü */}
                {onGoToDashboard && vq.status === 'onaylandi' && (
                  <button onClick={onGoToDashboard} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-indigo-200 active:scale-95">
                    Taramaya Dönüştür / Sonuçlara Git <ArrowRight size={14}/>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Firma Seçim Modalı — sihirbaz Adım 1 */}
      <Modal open={companyMenuOpen && !!form} onClose={() => { setCompanyMenuOpen(false); setCompanySearch(''); }} overlayClassName="p-2 sm:p-4">
        <div className={`${modalPanel} rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden`}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><Building2 size={18}/></div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Firma Seçin</h3>
                <p className="text-[11px] text-slate-500">{companies.length} kayıtlı firma</p>
              </div>
            </div>
            <button onClick={() => { setCompanyMenuOpen(false); setCompanySearch(''); }} className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"><X size={18}/></button>
          </div>
          <div className="p-3 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                autoFocus
                type="text"
                placeholder="Firma adı, yetkili veya sektör ara..."
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredCompanies.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">Eşleşen firma yok</div>
            ) : filteredCompanies.map(company => {
              const isSelected = form?.companyId === company.id;
              const quoteCount = quotes.filter(q => q.companyId === company.id).length;
              return (
                <button
                  key={company.id}
                  onClick={() => { patchForm({ companyId: company.id }); setCompanyMenuOpen(false); setCompanySearch(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'}`}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {company.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold truncate ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>{company.name}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {company.sector || '—'}
                      {company.employeeCount !== undefined && ` · ${company.employeeCount} çalışan`}
                      {` · ${quoteCount} teklif`}
                      {company.contactPerson && ` · ${company.contactPerson}`}
                    </p>
                  </div>
                  {isSelected && <Check size={15} className="text-emerald-600 shrink-0"/>}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* Confirm Modals */}
      <ConfirmModal
        open={confirmDelete !== null}
        title="Teklifi Sil"
        message={`"${quotes.find(q => q.id === confirmDelete)?.quoteNumber || 'Bu teklif'}" kalıcı olarak silinecek. Emin misiniz?`}
        confirmLabel="Evet, Sil"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
      <ConfirmModal
        open={confirmClone !== null}
        title="Teklifi Kopyala"
        message={`"${confirmClone?.quoteNumber || ''}" tüm kalemleriyle kopyalanarak yeni taslak teklif oluşturulacak.`}
        confirmLabel="Kopyala"
        variant="info"
        onConfirm={doClone}
        onCancel={() => setConfirmClone(null)}
      />
    </div>
  );
};
