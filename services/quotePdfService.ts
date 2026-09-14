import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { Company, OrgInfo, Quote, QuoteStatus, QuoteType } from '../types';
import { storageService } from './storageService';
import { getImage } from './logoStorage';

/**
 * TEKLİF PDF ÜRETİMİ
 * ──────────────────
 * pdfmake + gömülü Roboto fontu — Türkçe karakterler (ş/ğ/İ/ı/ç/ö/ü) tam destekli,
 * metin seçilebilir gerçek PDF üretir (ekran görüntüsü değil).
 */

// vfs_fonts modülünün dışa aktarım şekli sürüme göre değişebiliyor — ikisini de dene
const vfs = (pdfFonts as { pdfMake?: { vfs: unknown }; vfs?: unknown }).pdfMake?.vfs
  ?? (pdfFonts as { vfs?: unknown }).vfs;
if (vfs) (pdfMake as { vfs?: unknown }).vfs = vfs;

// ── Yardımcılar ──

const fmtTL = (n: number) =>
  n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const trDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR');

const STATUS_LABEL: Record<QuoteStatus, string> = {
  taslak: 'Taslak',
  gonderildi: 'Gönderildi',
  onaylandi: 'Onaylandı',
  reddedildi: 'Reddedildi'
};

const TYPE_LABEL: Record<QuoteType, string> = {
  ise_giris: 'İşe Giriş Muayenesi',
  periyodik: 'Periyodik Muayene'
};

/** Dosya adı için Türkçe karakterleri ASCII'ye çevirir */
const slugify = (s: string) => s
  .replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g').replace(/[ıI]/g, 'i')
  .replace(/[iİ]/g, 'i').replace(/[çÇ]/g, 'c').replace(/[öÖ]/g, 'o')
  .replace(/[üÜ]/g, 'u')
  .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Kurumsal renk paleti — uygulamadaki mavi/slate diliyle uyumlu
const C = {
  primary: '#2563eb',      // blue-600
  primaryDark: '#1d4ed8', // blue-700
  primarySoft: '#eff6ff',  // blue-50
  primarySofter: '#dbeafe',// blue-100
  ink: '#1e293b',          // slate-800
  muted: '#64748b',        // slate-500
  line: '#e2e8f0',         // slate-200
  softBg: '#f8fafc',       // slate-50
  white: '#ffffff',
  danger: '#dc2626'
};

/** IndexedDB blob'unu pdfmake'in kullanabileceği dataURL'e çevirir */
const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result as string);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** Kurum görseli (logo/imza) — yoksa veya okunamazsa null döner, PDF metinle devam eder */
const loadImageDataUrl = async (key?: string): Promise<string | null> => {
  if (!key) return null;
  const blob = await getImage(key);
  if (!blob) return null;
  try { return await blobToDataUrl(blob); } catch { return null; }
};

/** İletişim satırı — etiket + değer, noktalı virgülle ayrılmış */
const contactLine = (label: string, value?: string): Content | null =>
  value ? { text: [{ text: `${label}: `, bold: true, color: C.muted }, { text: value, color: C.ink }] } : null;

// ── Doküman tanımı üretici ──

const buildQuoteDoc = async (quote: Quote, company?: Company): Promise<TDocumentDefinitions> => {
  const org: OrgInfo = storageService.getOrgInfo();
  const [logoDataUrl, signatureDataUrl] = await Promise.all([
    loadImageDataUrl(org.logoKey),
    loadImageDataUrl(org.signatureKey)
  ]);
  const sub = quote.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discount = quote.discountType === 'amount'
    ? Math.min(quote.discountRate, sub)
    : sub * ((quote.discountRate ?? 0) / 100);
  const netTotal = sub - discount;
  const vat = netTotal * ((quote.vatRate ?? 0) / 100);
  const total = netTotal + vat;
  const totalQuantity = quote.items.reduce((s, i) => s + i.quantity, 0);
  const perUnit = totalQuantity > 0 ? total / totalQuantity : 0;

  const content: Content[] = [];

  // ════════════════════════════════════════════════════
  // SAYFA 1 — KURUMSAL KAPAK
  // ════════════════════════════════════════════════════

  // ── Başlık bandı: beyaz zemin, alt mavi çizgi ──
  content.push({
    columns: [
      ...(logoDataUrl
        ? [{ width: 52 as const, image: logoDataUrl, fit: [48, 48] as [number, number], margin: [0, 2, 12, 0] as [number, number, number, number] }]
        : []),
      {
        width: '*',
        stack: [
          { text: org.name.toLocaleUpperCase('tr-TR'), style: 'brand' },
          ...(org.tagline ? [{ text: org.tagline, style: 'brandSub' }] : [])
        ],
        margin: [logoDataUrl ? 0 : 0, 4, 0, 4] as [number, number, number, number]
      },
      {
        width: 'auto',
        stack: [
          { text: 'FİYAT TEKLİFİ', style: 'docTitle', alignment: 'right' },
          { text: quote.quoteNumber, style: 'docNo', alignment: 'right' }
        ],
        margin: [0, 4, 0, 4] as [number, number, number, number]
      }
    ],
    margin: [0, 0, 0, 4]
  });
  // Çift çizgi: ince mavi + kalın mavi
  content.push({
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: C.primarySofter },
      { type: 'line', x1: 0, y1: 3, x2: 515, y2: 3, lineWidth: 2.5, lineColor: C.primary }
    ],
    margin: [0, 0, 0, 14]
  });

  // ── Kurum kısa bilgi şeridi (boşluğu değerlendir) ──
  const orgQuickInfo: Content[] = [];
  if (org.phone) orgQuickInfo.push({ text: `☎ ${org.phone}`, style: 'quickInfo' });
  if (org.email) orgQuickInfo.push({ text: `✉ ${org.email}`, style: 'quickInfo' });
  if (org.web) orgQuickInfo.push({ text: `🌐 ${org.web}`, style: 'quickInfo' });
  if (org.address) orgQuickInfo.push({ text: `📍 ${org.address}`, style: 'quickInfo' });
  if (orgQuickInfo.length) {
    content.push({
      columns: orgQuickInfo.map((item, i) => ({
        width: i === orgQuickInfo.length - 1 ? '*' : 'auto',
        text: (item as { text: string }).text,
        style: 'quickInfo',
        alignment: i === orgQuickInfo.length - 1 ? ('right' as const) : ('left' as const)
      })),
      margin: [0, 0, 0, 14]
    });
  }

  // ── Bilgi bloğu: firma | teklif detayları (iki kart) ──
  const infoRows: [string, string][] = [
    ['Teklif No', quote.quoteNumber],
    ['Teklif Tarihi', trDate(quote.createdAt)],
    ['Geçerlilik', trDate(quote.validUntil)],
    ['Teklif Türü', TYPE_LABEL[quote.quoteType ?? 'ise_giris']],
    ['Durum', STATUS_LABEL[quote.status]]
  ];

  // Firma kartı
  const companyStack: Content[] = [
    { text: 'TEKLİF EDİLEN', style: 'cardLabel' },
    { text: company?.name ?? '—', style: 'companyName', margin: [0, 4, 0, 4] }
  ];
  if (company?.contactPerson) companyStack.push(contactLine('Yetkili', company.contactPerson)!);
  if (company?.phone) companyStack.push(contactLine('Telefon', company.phone)!);
  if (company?.email) companyStack.push(contactLine('E-Posta', company.email)!);
  if (company?.address) companyStack.push({ text: company.address, style: 'muted', margin: [0, 2, 0, 0] });

  content.push({
    columns: [
      {
        width: '55%',
        table: {
          widths: ['*'],
          body: [[{ stack: companyStack, margin: [12, 10, 12, 10] as [number, number, number, number] }]]
        },
        layout: {
          fillColor: () => C.softBg,
          hLineWidth: () => 0.5, vLineWidth: () => 0,
          hLineColor: () => C.line,
          paddingTop: () => 0, paddingBottom: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0
        },
        margin: [0, 0, 8, 16]
      },
      {
        width: '45%',
        table: {
          widths: ['auto', '*'],
          body: [
            [{ text: 'TEKLİF DETAYI', style: 'cardLabel', colSpan: 2 }, ''],
            ...infoRows.map(([k, v]) => [
              { text: k, style: 'infoKey' },
              { text: v, style: 'infoVal', alignment: 'right' }
            ])
          ]
        },
        layout: {
          fillColor: () => C.white,
          hLineWidth: (i: number) => i === 0 ? 0 : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => C.line,
          paddingTop: (i: number) => i === 0 ? 10 : 4,
          paddingBottom: (i: number, node: { table: { body: unknown[] } }) => i === node.table.body.length - 1 ? 10 : 4,
          paddingLeft: () => 12, paddingRight: () => 12
        },
        margin: [8, 0, 0, 16]
      }
    ]
  });

  // ── Ön yazı — sol kenar çizgili kart ──
  if (quote.coverLetter && quote.includeCover !== false) {
    content.push({
      table: {
        widths: [3, '*'],
        body: [[
          { text: '', fillColor: C.primary },
          {
            stack: [
              { text: 'ÖN YAZI', style: 'blockLabel', margin: [0, 0, 0, 6] },
              { text: quote.coverLetter, style: 'body' }
            ],
            margin: [12, 12, 14, 12] as [number, number, number, number],
            fillColor: C.primarySoft
          }
        ]]
      },
      layout: {
        hLineWidth: () => 0, vLineWidth: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0,
        paddingLeft: () => 0, paddingRight: () => 0
      },
      margin: [0, 0, 0, 16]
    });
  }

  // ── Şartlar ve koşullar — kart görselliği ──
  if (quote.terms?.length && quote.includeTerms !== false) {
    content.push({
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'ŞARTLAR VE KOŞULLAR', style: 'blockLabel', margin: [0, 0, 0, 8] },
            { ol: quote.terms.map(t => ({ text: t, style: 'terms' })) }
          ],
          margin: [14, 12, 14, 12] as [number, number, number, number]
        }]]
      },
      layout: {
        fillColor: () => C.white,
        hLineWidth: () => 0.5, vLineWidth: () => 0.5,
        hLineColor: () => C.line, vLineColor: () => C.line,
        paddingTop: () => 0, paddingBottom: () => 0,
        paddingLeft: () => 0, paddingRight: () => 0
      },
      margin: [0, 0, 0, 16]
    });
  }

  // ── İmza & iletişim bloğu — iki kart yan yana ──
  const contactStack: Content[] = [];
  if (org.phone) contactStack.push(contactLine('Telefon', org.phone)!);
  if (org.email) contactStack.push(contactLine('E-Posta', org.email)!);
  if (org.web) contactStack.push(contactLine('Web', org.web)!);
  if (org.address) contactStack.push({ text: org.address, style: 'muted', margin: [0, 2, 0, 0] });
  const taxLine = [org.taxOffice && `${org.taxOffice} V.D.`, org.taxNumber && `VKN: ${org.taxNumber}`].filter(Boolean).join(' · ');
  if (taxLine) contactStack.push({ text: taxLine, style: 'muted', margin: [0, 4, 0, 0] });

  content.push({
    columns: [
      // İletişim kartı
      {
        width: '*',
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'KURUM İLETİŞİM', style: 'cardLabel', margin: [0, 0, 0, 8] },
              ...(contactStack.length ? contactStack : [{ text: '—', style: 'muted' }])
            ],
            margin: [12, 10, 12, 10] as [number, number, number, number]
          }]]
        },
        layout: {
          fillColor: () => C.softBg,
          hLineWidth: () => 0.5, vLineWidth: () => 0,
          hLineColor: () => C.line,
          paddingTop: () => 0, paddingBottom: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0
        },
        margin: [0, 0, 8, 0]
      },
      // İmza kartı
      {
        width: 'auto',
        table: {
          widths: [180],
          body: [[{
            stack: [
              { text: 'Saygılarımızla,', style: 'muted', alignment: 'right' },
              { text: org.name, style: 'signerOrg', alignment: 'right', margin: [0, 2, 0, 0] },
              ...(signatureDataUrl
                ? [{ image: signatureDataUrl, fit: [90, 36] as [number, number], alignment: 'right' as const, margin: [0, 6, 0, 2] as [number, number, number, number] }]
                : []),
              { text: org.signerName || ' ', style: 'signer', alignment: 'right', margin: [0, signatureDataUrl ? 4 : 22, 0, 0] },
              { text: [org.signerTitle, trDate(quote.createdAt)].filter(Boolean).join(' · '), style: 'muted', alignment: 'right' }
            ],
            margin: [12, 10, 12, 10] as [number, number, number, number]
          }]]
        },
        layout: {
          fillColor: () => C.white,
          hLineWidth: () => 0.5, vLineWidth: () => 0,
          hLineColor: () => C.line,
          paddingTop: () => 0, paddingBottom: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0
        },
        margin: [8, 0, 0, 0]
      }
    ],
    margin: [0, 8, 0, 0]
  });

  // ════════════════════════════════════════════════════
  // SAYFA 2 — TEKLİF KALEMLERİ & MALİ ÖZET
  // (tek bir stack içinde pageBreak ile — boş sayfa oluşmaz)
  // ════════════════════════════════════════════════════
  const page2: Content[] = [];

  // ── Sayfa 2 başlık bandı: beyaz zemin, alt mavi çizgi ──
  page2.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: org.name.toLocaleUpperCase('tr-TR'), style: 'brand' },
          ...(org.tagline ? [{ text: org.tagline, style: 'brandSub' }] : [])
        ],
        margin: [0, 4, 0, 4] as [number, number, number, number]
      },
      {
        width: 'auto',
        stack: [
          { text: 'TEKLİF KALEMLERİ', style: 'docTitle', alignment: 'right' },
          { text: quote.quoteNumber, style: 'docNo', alignment: 'right' }
        ],
        margin: [0, 4, 0, 4] as [number, number, number, number]
      }
    ],
    margin: [0, 0, 0, 4]
  });
  page2.push({
    canvas: [
      { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: C.primarySofter },
      { type: 'line', x1: 0, y1: 3, x2: 515, y2: 3, lineWidth: 2.5, lineColor: C.primary }
    ],
    margin: [0, 0, 0, 14]
  });

  // ── Firma özet şeridi ──
  page2.push({
    table: {
      widths: ['auto', '*', 'auto', 'auto'],
      body: [[
        { text: 'FİRMA', style: 'stripLabel' },
        { text: company?.name ?? '—', style: 'stripVal' },
        { text: 'TÜR', style: 'stripLabel' },
        { text: TYPE_LABEL[quote.quoteType ?? 'ise_giris'], style: 'stripVal', alignment: 'right' }
      ]]
    },
    layout: {
      fillColor: () => C.softBg,
      hLineWidth: () => 0, vLineWidth: () => 0,
      paddingTop: () => 6, paddingBottom: () => 6,
      paddingLeft: () => 10, paddingRight: () => 10
    },
    margin: [0, 0, 0, 14]
  });

  // ── Kalem tablosu — sıra no'lu ──
  page2.push({ text: 'TEKLİF KALEMLERİ', style: 'blockLabel', margin: [0, 0, 0, 6] });
  page2.push({
    table: {
      headerRows: 1,
      widths: [28, '*', 45, 70, 80],
      body: [
        [
          { text: '#', style: 'th', alignment: 'center' },
          { text: 'KALEM / HİZMET', style: 'th' },
          { text: 'MİKTAR', style: 'th', alignment: 'center' },
          { text: 'BİRİM FİYAT', style: 'th', alignment: 'right' },
          { text: 'TUTAR', style: 'th', alignment: 'right' }
        ],
        ...quote.items.map((item, idx) => [
          { text: String(idx + 1), style: 'tdNo', alignment: 'center', fillColor: idx % 2 ? C.softBg : C.white },
          { text: item.name, style: 'td', fillColor: idx % 2 ? C.softBg : C.white },
          { text: String(item.quantity), style: 'td', alignment: 'center', fillColor: idx % 2 ? C.softBg : C.white },
          { text: `₺${fmtTL(item.unitPrice)}`, style: 'td', alignment: 'right', fillColor: idx % 2 ? C.softBg : C.white },
          { text: `₺${fmtTL(item.quantity * item.unitPrice)}`, style: 'tdStrong', alignment: 'right', fillColor: idx % 2 ? C.softBg : C.white }
        ]),
        // Alt toplam satırı
        [
          { text: '', style: 'tdTotal', colSpan: 2, alignment: 'right' },
          { text: 'TOPLAM', style: 'tdTotalLabel', alignment: 'right' },
          { text: String(totalQuantity), style: 'tdTotalVal', alignment: 'center' },
          { text: '', style: 'tdTotal' },
          { text: `₺${fmtTL(sub)}`, style: 'tdTotalVal', alignment: 'right' }
        ]
      ]
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => {
        if (i === 1) return 1;
        if (i === node.table.body.length - 1) return 1.5;
        return 0.5;
      },
      vLineWidth: () => 0,
      hLineColor: (i: number, node: { table: { body: unknown[] } }) =>
        i === 1 || i === node.table.body.length - 1 ? C.primary : C.line,
      paddingTop: () => 6, paddingBottom: () => 6,
      paddingLeft: () => 8, paddingRight: () => 8
    },
    margin: [0, 0, 0, 14]
  });

  // ── Mali özet — iki sütun: sol açıklama, sağ tutar tablosu ──
  const totalsBody: Content[][] = [
    [
      { text: 'Ara Toplam (KDV Hariç)', style: 'totKey' },
      { text: `₺${fmtTL(sub)}`, style: 'totVal' }
    ]
  ];
  if (discount > 0) {
    totalsBody.push([
      { text: `İndirim${quote.discountType !== 'amount' ? ` (%${quote.discountRate})` : ''}`, style: 'totKey' },
      { text: `-₺${fmtTL(discount)}`, style: 'totValDiscount' }
    ]);
  }
  totalsBody.push([
    { text: 'Net Tutar', style: 'totKey' },
    { text: `₺${fmtTL(netTotal)}`, style: 'totVal' }
  ]);
  totalsBody.push([
    { text: `KDV (%${quote.vatRate})`, style: 'totKey' },
    { text: `₺${fmtTL(vat)}`, style: 'totVal' }
  ]);
  totalsBody.push([
    { text: 'GENEL TOPLAM', style: 'totGrandKey' },
    { text: `₺${fmtTL(total)}`, style: 'totGrandVal' }
  ]);

  // Sol: özet bilgiler
  const summaryStack: Content[] = [
    { text: 'ÖZET', style: 'cardLabel', margin: [0, 0, 0, 8] },
    { text: [{ text: 'Kalem Sayısı: ', bold: true, color: C.muted }, { text: String(quote.items.length), color: C.ink }], style: 'muted', margin: [0, 0, 0, 3] },
    { text: [{ text: 'Toplam Adet: ', bold: true, color: C.muted }, { text: String(totalQuantity), color: C.ink }], style: 'muted', margin: [0, 0, 0, 3] },
    { text: [{ text: 'Birim Başına Ortalama: ', bold: true, color: C.muted }, { text: `₺${fmtTL(perUnit)}`, color: C.ink }], style: 'muted', margin: [0, 0, 0, 3] },
    { text: [{ text: 'KDV Oranı: ', bold: true, color: C.muted }, { text: `%${quote.vatRate}`, color: C.ink }], style: 'muted' }
  ];

  page2.push({
    columns: [
      {
        width: '*',
        table: {
          widths: ['*'],
          body: [[{ stack: summaryStack, margin: [12, 10, 12, 10] as [number, number, number, number] }]]
        },
        layout: {
          fillColor: () => C.softBg,
          hLineWidth: () => 0.5, vLineWidth: () => 0,
          hLineColor: () => C.line,
          paddingTop: () => 0, paddingBottom: () => 0,
          paddingLeft: () => 0, paddingRight: () => 0
        },
        margin: [0, 0, 8, 0]
      },
      {
        width: 220,
        table: { widths: ['*', 'auto'], body: totalsBody },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) => i === node.table.body.length - 1 ? 1.5 : 0,
          vLineWidth: () => 0,
          hLineColor: (i: number, node: { table: { body: unknown[] } }) =>
            i === node.table.body.length - 1 ? C.primary : C.line,
          paddingTop: () => 5, paddingBottom: () => 5,
          paddingLeft: () => 10, paddingRight: () => 10
        }
      }
    ],
    margin: [0, 0, 0, 18]
  });

  // ── Alt not ──
  if (quote.notes) {
    page2.push({
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'NOT', style: 'blockLabel', margin: [0, 0, 0, 4] },
            { text: quote.notes, style: 'muted' }
          ],
          margin: [12, 8, 12, 8] as [number, number, number, number]
        }]]
      },
      layout: {
        fillColor: () => C.softBg,
        hLineWidth: () => 0, vLineWidth: () => 0,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0
      },
      margin: [0, 0, 0, 0]
    });
  }

  // Sayfa 2 içeriğini tek bir stack olarak pageBreak ile ekle
  content.push({ stack: page2, pageBreak: 'before' as const });

  return {
    pageSize: 'A4',
    pageMargins: [40, 45, 40, 55],
    footer: (page: number, pages: number) => ({
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: C.line }], margin: [0, 0, 0, 6] },
        {
          columns: [
            { text: `${org.name} — ${quote.quoteNumber}`, style: 'footer' },
            { text: `Sayfa ${page} / ${pages}`, style: 'footer', alignment: 'right' }
          ]
        },
        { text: 'Sağlıklı çalışanlar, güvenli yarınlar için — Mobil sağlık taramalarında güvenilir çözüm ortağınız.', style: 'slogan', alignment: 'center' }
      ],
      margin: [40, 0, 40, 0]
    }),
    content,
    defaultStyle: { fontSize: 9.5, color: C.ink },
    styles: {
      brand: { fontSize: 17, bold: true, color: C.primaryDark, characterSpacing: 0.5 },
      brandSub: { fontSize: 8.5, color: C.muted, margin: [0, 2, 0, 0] },
      docTitle: { fontSize: 14, bold: true, color: C.ink, characterSpacing: 1 },
      docNo: { fontSize: 10, bold: true, color: C.primary, margin: [0, 3, 0, 0] },
      quickInfo: { fontSize: 8, color: C.muted, margin: [0, 0, 8, 0] },
      blockLabel: { fontSize: 8, bold: true, color: C.primary, characterSpacing: 1.2 },
      cardLabel: { fontSize: 7.5, bold: true, color: C.muted, characterSpacing: 1.2 },
      stripLabel: { fontSize: 7.5, bold: true, color: C.muted, characterSpacing: 1 },
      stripVal: { fontSize: 9.5, bold: true, color: C.ink },
      companyName: { fontSize: 12, bold: true, color: C.ink },
      muted: { fontSize: 8.5, color: C.muted, lineHeight: 1.35 },
      infoKey: { fontSize: 8.5, color: C.muted, bold: false },
      infoVal: { fontSize: 8.5, bold: true, color: C.ink },
      body: { fontSize: 9.5, color: C.ink, lineHeight: 1.5 },
      th: { fontSize: 8, bold: true, color: C.white, fillColor: C.primary, characterSpacing: 0.8 },
      tdNo: { fontSize: 8.5, bold: true, color: C.muted },
      td: { fontSize: 9, color: C.ink },
      tdStrong: { fontSize: 9, bold: true, color: C.ink },
      tdTotal: { fontSize: 9, color: C.ink, fillColor: C.primarySofter },
      tdTotalLabel: { fontSize: 9, bold: true, color: C.primaryDark, fillColor: C.primarySofter },
      tdTotalVal: { fontSize: 9.5, bold: true, color: C.primaryDark, fillColor: C.primarySofter },
      totKey: { fontSize: 8.5, color: C.muted, alignment: 'right' },
      totVal: { fontSize: 9, bold: true, color: C.ink, alignment: 'right' },
      totValDiscount: { fontSize: 9, bold: true, color: C.danger, alignment: 'right' },
      totGrandKey: { fontSize: 10, bold: true, color: C.ink, alignment: 'right' },
      totGrandVal: { fontSize: 12, bold: true, color: C.primary, alignment: 'right' },
      terms: { fontSize: 8.5, color: C.muted, lineHeight: 1.4, margin: [0, 0, 0, 3] },
      signerOrg: { fontSize: 10, bold: true, color: C.ink },
      signer: { fontSize: 9.5, bold: true, color: C.ink, decoration: 'underline' as const },
      footer: { fontSize: 7.5, color: C.muted },
      slogan: { fontSize: 8, color: C.primary, italics: true, margin: [0, 4, 0, 0], characterSpacing: 0.3 }
    }
  };
};

// ── Dışa açık API ──

/** PDF'i dosya olarak indirir */
export const downloadQuotePdf = async (quote: Quote, company?: Company) => {
  const filename = `${quote.quoteNumber}${company ? `-${slugify(company.name)}` : ''}.pdf`;
  pdfMake.createPdf(await buildQuoteDoc(quote, company)).download(filename);
};

/** PDF'i yeni tarayıcı sekmesinde önizleme olarak açar */
export const previewQuotePdf = async (quote: Quote, company?: Company) => {
  pdfMake.createPdf(await buildQuoteDoc(quote, company)).open();
};
