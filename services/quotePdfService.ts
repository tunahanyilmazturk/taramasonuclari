import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { Company, OrgInfo, Quote, QuoteStatus, QuoteType } from '../types';
import { storageService } from './storageService';

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

// Kurumsal renk paleti — uygulamadaki emerald/slate diliyle uyumlu
const C = {
  primary: '#059669',      // emerald-600
  primarySoft: '#ecfdf5',  // emerald-50
  ink: '#1e293b',          // slate-800
  muted: '#64748b',        // slate-500
  line: '#e2e8f0',         // slate-200
  softBg: '#f8fafc',       // slate-50
  accent: '#0f766e'        // teal-700
};

// ── Doküman tanımı üretici ──

const buildQuoteDoc = (quote: Quote, company?: Company): TDocumentDefinitions => {
  const org: OrgInfo = storageService.getOrgInfo();
  const sub = quote.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discount = quote.discountType === 'amount'
    ? Math.min(quote.discountRate, sub)
    : sub * ((quote.discountRate ?? 0) / 100);
  const vat = (sub - discount) * ((quote.vatRate ?? 0) / 100);
  const total = sub - discount + vat;

  const orgContact = [org.phone, org.email, org.web, org.address].filter(Boolean).join('  ·  ');
  const orgTax = [org.taxOffice && `${org.taxOffice} V.D.`, org.taxNumber && `VN: ${org.taxNumber}`].filter(Boolean).join(' · ');

  const content: Content[] = [];

  // ── Başlık bandı: kurum kimliği | teklif kimliği ──
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: org.name.toLocaleUpperCase('tr-TR'), style: 'brand' },
          ...(org.tagline ? [{ text: org.tagline, style: 'brandSub' }] : [])
        ]
      },
      {
        width: 'auto',
        stack: [
          { text: 'FİYAT TEKLİFİ', style: 'docTitle', alignment: 'right' },
          { text: quote.quoteNumber, style: 'docNo', alignment: 'right' }
        ]
      }
    ],
    margin: [0, 0, 0, 10]
  });
  content.push({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: C.primary }],
    margin: [0, 0, 0, 14]
  });

  // ── Bilgi bloğu: firma | teklif detayları ──
  const infoRows: [string, string][] = [
    ['Teklif No', quote.quoteNumber],
    ['Teklif Tarihi', trDate(quote.createdAt)],
    ['Geçerlilik', trDate(quote.validUntil)],
    ['Teklif Türü', TYPE_LABEL[quote.quoteType ?? 'ise_giris']],
    ['Durum', STATUS_LABEL[quote.status]]
  ];
  content.push({
    columns: [
      {
        width: '55%',
        stack: [
          { text: 'SAYIN', style: 'blockLabel' },
          { text: company?.name ?? '—', style: 'companyName' },
          ...(company?.contactPerson ? [{ text: company.contactPerson, style: 'muted' }] : []),
          ...([company?.phone, company?.email].filter(Boolean).length
            ? [{ text: [company?.phone, company?.email].filter(Boolean).join('  ·  '), style: 'muted' }] : []),
          ...(company?.address ? [{ text: company.address, style: 'muted' }] : [])
        ]
      },
      {
        width: '45%',
        layout: 'noBorders',
        table: {
          widths: ['auto', '*'],
          body: infoRows.map(([k, v]) => [
            { text: k, style: 'infoKey' },
            { text: v, style: 'infoVal', alignment: 'right' }
          ])
        }
      }
    ],
    margin: [0, 0, 0, 16]
  });

  // ── Ön yazı ──
  if (quote.coverLetter && quote.includeCover !== false) {
    content.push({
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'ÖN YAZI', style: 'blockLabel', margin: [0, 0, 0, 6] },
            { text: quote.coverLetter, style: 'body' }
          ],
          margin: [12, 10, 12, 10]
        }]]
      },
      layout: {
        fillColor: C.softBg,
        hLineWidth: () => 0, vLineWidth: () => 0,
        paddingLeft: () => 0, paddingRight: () => 0
      },
      margin: [0, 0, 0, 16]
    });
  }

  // ── Kalem tablosu ──
  content.push({ text: 'TEKLİF KALEMLERİ', style: 'blockLabel', margin: [0, 0, 0, 6] });
  content.push({
    table: {
      headerRows: 1,
      widths: ['*', 50, 75, 80],
      body: [
        [
          { text: 'KALEM / HİZMET', style: 'th' },
          { text: 'MİKTAR', style: 'th', alignment: 'center' },
          { text: 'BİRİM FİYAT', style: 'th', alignment: 'right' },
          { text: 'TUTAR', style: 'th', alignment: 'right' }
        ],
        ...quote.items.map((item, idx) => [
          { text: item.name, style: 'td', fillColor: idx % 2 ? C.softBg : '#ffffff' },
          { text: String(item.quantity), style: 'td', alignment: 'center', fillColor: idx % 2 ? C.softBg : '#ffffff' },
          { text: `₺${fmtTL(item.unitPrice)}`, style: 'td', alignment: 'right', fillColor: idx % 2 ? C.softBg : '#ffffff' },
          { text: `₺${fmtTL(item.quantity * item.unitPrice)}`, style: 'tdStrong', alignment: 'right', fillColor: idx % 2 ? C.softBg : '#ffffff' }
        ])
      ]
    },
    layout: {
      hLineWidth: (i: number, node: { table: { body: unknown[] } }) => (i === 0 || i === node.table.body.length) ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: C.line,
      paddingTop: () => 5, paddingBottom: () => 5,
      paddingLeft: () => 6, paddingRight: () => 6
    },
    margin: [0, 0, 0, 10]
  });

  // ── Mali özet — sağa yaslı ──
  const totalsBody = [
    [
      { text: 'Ara Toplam', style: 'totKey' },
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
    { text: `KDV (%${quote.vatRate})`, style: 'totKey' },
    { text: `₺${fmtTL(vat)}`, style: 'totVal' }
  ]);
  totalsBody.push([
    { text: 'GENEL TOPLAM', style: 'totGrandKey' },
    { text: `₺${fmtTL(total)}`, style: 'totGrandVal' }
  ]);
  content.push({
    columns: [
      { width: '*', text: '' },
      {
        width: 190,
        table: { widths: ['*', 'auto'], body: totalsBody },
        layout: {
          // sadece genel toplam satırının üstünde ayırıcı çizgi
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) => i === node.table.body.length - 1 ? 1 : 0,
          vLineWidth: () => 0,
          hLineColor: C.primary,
          paddingTop: () => 3, paddingBottom: () => 3
        }
      }
    ],
    margin: [0, 0, 0, 18]
  });

  // ── Şartlar ve koşullar ──
  if (quote.terms?.length && quote.includeTerms !== false) {
    content.push({
      stack: [
        { text: 'ŞARTLAR VE KOŞULLAR', style: 'blockLabel', margin: [0, 0, 0, 6] },
        { ol: quote.terms.map(t => ({ text: t, style: 'terms' })) }
      ],
      margin: [0, 0, 0, 14]
    });
  }

  // ── İç notlar — dokümana basılmaz, sadece sistemde kalır ──

  // ── İmza bloğu ──
  content.push({
    columns: [
      {
        width: '*',
        stack: orgContact || orgTax ? [
          { text: 'İLETİŞİM', style: 'blockLabel', margin: [0, 0, 0, 4] },
          ...(orgContact ? [{ text: orgContact, style: 'muted' }] : []),
          ...(orgTax ? [{ text: orgTax, style: 'muted' }] : [])
        ] : []
      },
      {
        width: 'auto',
        stack: [
          { text: 'Saygılarımızla,', style: 'muted', alignment: 'right' },
          { text: org.name, style: 'signerOrg', alignment: 'right', margin: [0, 2, 0, 0] },
          { text: org.signerName || ' ', style: 'signer', alignment: 'right', margin: [0, 22, 0, 0] },
          { text: [org.signerTitle, trDate(quote.createdAt)].filter(Boolean).join(' · '), style: 'muted', alignment: 'right' }
        ]
      }
    ],
    margin: [0, 8, 0, 0]
  });

  return {
    pageSize: 'A4',
    pageMargins: [40, 45, 40, 55],
    footer: (page: number, pages: number) => ({
      columns: [
        { text: `${org.name} — ${quote.quoteNumber}`, style: 'footer' },
        { text: `Sayfa ${page} / ${pages}`, style: 'footer', alignment: 'right' }
      ],
      margin: [40, 0, 40, 0]
    }),
    content,
    defaultStyle: { fontSize: 9.5, color: C.ink },
    styles: {
      brand: { fontSize: 17, bold: true, color: C.accent, characterSpacing: 0.5 },
      brandSub: { fontSize: 8.5, color: C.muted, margin: [0, 2, 0, 0] },
      docTitle: { fontSize: 15, bold: true, color: C.ink, characterSpacing: 1 },
      docNo: { fontSize: 10, bold: true, color: C.primary, margin: [0, 3, 0, 0] },
      blockLabel: { fontSize: 8, bold: true, color: C.primary, characterSpacing: 1.2 },
      companyName: { fontSize: 12, bold: true, color: C.ink, margin: [0, 2, 0, 3] },
      muted: { fontSize: 8.5, color: C.muted, lineHeight: 1.35 },
      infoKey: { fontSize: 8.5, color: C.muted, bold: false },
      infoVal: { fontSize: 8.5, bold: true, color: C.ink },
      body: { fontSize: 9.5, color: C.ink, lineHeight: 1.5 },
      th: { fontSize: 8, bold: true, color: '#ffffff', fillColor: C.primary, characterSpacing: 0.8 },
      td: { fontSize: 9, color: C.ink },
      tdStrong: { fontSize: 9, bold: true, color: C.ink },
      totKey: { fontSize: 8.5, color: C.muted, alignment: 'right' },
      totVal: { fontSize: 9, bold: true, color: C.ink, alignment: 'right' },
      totValDiscount: { fontSize: 9, bold: true, color: '#dc2626', alignment: 'right' },
      totGrandKey: { fontSize: 9.5, bold: true, color: C.ink, alignment: 'right' },
      totGrandVal: { fontSize: 11.5, bold: true, color: C.primary, alignment: 'right' },
      terms: { fontSize: 8.5, color: C.muted, lineHeight: 1.4, margin: [0, 0, 0, 2] },
      signerOrg: { fontSize: 10, bold: true, color: C.ink },
      signer: { fontSize: 9.5, bold: true, color: C.ink, decoration: 'underline' as const },
      footer: { fontSize: 7.5, color: C.muted }
    }
  };
};

// ── Dışa açık API ──

/** PDF'i dosya olarak indirir */
export const downloadQuotePdf = (quote: Quote, company?: Company) => {
  const filename = `${quote.quoteNumber}${company ? `-${slugify(company.name)}` : ''}.pdf`;
  pdfMake.createPdf(buildQuoteDoc(quote, company)).download(filename);
};

/** PDF'i yeni tarayıcı sekmesinde önizleme olarak açar */
export const previewQuotePdf = (quote: Quote, company?: Company) => {
  pdfMake.createPdf(buildQuoteDoc(quote, company)).open();
};
