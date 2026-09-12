
import { TestDefinition } from "./types";

export const DEFAULT_TESTS: TestDefinition[] = [
  // --- KOMPLEKS HEMOGRAM PANELİ ---
  { 
    id: 'hemogram_panel', 
    name: 'Hemogram (Tam Kan Sayımı)', 
    key: 'hemogram', 
    unit: 'Panel', 
    type: 'text', // The main result is text summary (e.g. "Normal" or "WBC Yüksek...")
    subTests: [
      { id: 'h_wbc', name: 'WBC', key: 'wbc', unit: 'K/uL', type: 'numeric', range: { min: 4.49, max: 12.68 } },
      { id: 'h_hgb', name: 'HGB', key: 'hgb', unit: 'g/dL', type: 'numeric', range: { min: 11.5, max: 14.6 } },
      { id: 'h_rbc', name: 'RBC', key: 'rbc', unit: 'K/uL', type: 'numeric', range: { min: 3.92, max: 5.08 } },
      { id: 'h_plt', name: 'PLT', key: 'plt', unit: 'K/uL', type: 'numeric', range: { min: 100, max: 390 } },
      { id: 'h_hct', name: 'HCT', key: 'hct', unit: '%', type: 'numeric', range: { min: 36.6, max: 44.0 } },
      { id: 'h_mcv', name: 'MCV', key: 'mcv', unit: 'fL', type: 'numeric', range: { min: 81.8, max: 98.0 } },
      { id: 'h_mch', name: 'MCH', key: 'mch', unit: 'pg', type: 'numeric', range: { min: 27.0, max: 32.3 } },
      { id: 'h_mchc', name: 'MCHC', key: 'mchc', unit: 'g/dL', type: 'numeric', range: { min: 31.8, max: 35.0 } },
      { id: 'h_rdw', name: 'RDW_CV', key: 'rdw', unit: '%', type: 'numeric', range: { min: 12.0, max: 14.3 } },
      { id: 'h_mpv', name: 'MPV', key: 'mpv', unit: 'fL', type: 'numeric', range: { min: 9.1, max: 12.1 } },
      { id: 'h_pdw', name: 'PDW', key: 'pdw', unit: 'fL', type: 'numeric', range: { min: 9.9, max: 16.1 } },
      { id: 'h_pct', name: 'PCT', key: 'pct', unit: '%', type: 'numeric', range: { min: 0.18, max: 0.39 } },
      
      // Diferansiyel Değerler (# ve %)
      { id: 'h_neu_abs', name: 'NEU #', key: 'neu_#', unit: 'K/uL', type: 'numeric', range: { min: 2.10, max: 8.89 } },
      { id: 'h_lym_abs', name: 'LYMP #', key: 'lymp_#', unit: 'K/uL', type: 'numeric', range: { min: 1.26, max: 3.35 } },
      { id: 'h_mon_abs', name: 'MON #', key: 'mon_#', unit: 'K/uL', type: 'numeric', range: { min: 0.25, max: 0.95 } },
      { id: 'h_eos_abs', name: 'EOS #', key: 'eos_#', unit: 'K/uL', type: 'numeric', range: { min: 0.01, max: 0.59 } },
      { id: 'h_bas_abs', name: 'BAS #', key: 'bas_#', unit: 'K/uL', type: 'numeric', range: { min: 0.00, max: 0.06 } },
      
      { id: 'h_neu_pct', name: 'NEU %', key: 'neu_%', unit: '%', type: 'numeric', range: { min: 41.0, max: 74.3 } },
      { id: 'h_lym_pct', name: 'LYM %', key: 'lym_%', unit: '%', type: 'numeric', range: { min: 18.3, max: 47.9 } },
      { id: 'h_mon_pct', name: 'MON %', key: 'mon_%', unit: '%', type: 'numeric', range: { min: 4.2, max: 15.2 } },
      { id: 'h_eos_pct', name: 'EOS %', key: 'eos_%', unit: '%', type: 'numeric', range: { min: 0.2, max: 7.6 } },
      { id: 'h_bas_pct', name: 'BAS %', key: 'bas_%', unit: '%', type: 'numeric', range: { min: 0.0, max: 1.0 } },
    ]
  },

  // --- TAM İDRAR TAHLİLİ (TİT) PANELİ ---
  {
    id: 'idrar_panel',
    name: 'Tam İdrar Tahlili (TİT)',
    key: 'tam_idrar',
    unit: 'Panel',
    type: 'text',
    subTests: [
        { id: 'tit_eritrosit', name: 'Eritrosit (İdrar)', key: 'tit_eritrosit', unit: 'uL', type: 'text' }, // NEGATİF
        { id: 'tit_bilirubin', name: 'Bilirubin', key: 'tit_bilirubin', unit: 'mg/dL', type: 'text' }, // NEGATİF
        { id: 'tit_urobilinojen', name: 'Urobilinojen', key: 'tit_urobilinojen', unit: 'mg/dL', type: 'text' }, // NORMAL
        { id: 'tit_keton', name: 'Keton', key: 'tit_keton', unit: 'mg/dL', type: 'text' }, // NEGATİF
        { id: 'tit_protein', name: 'Protein', key: 'tit_protein', unit: 'mg/dL', type: 'text' }, // NEGATİF
        { id: 'tit_nitrit', name: 'Nitrit', key: 'tit_nitrit', unit: 'Sonuç', type: 'text' }, // NEGATİF
        { id: 'tit_glukoz', name: 'Glukoz (İdrar)', key: 'tit_glukoz', unit: 'mg/dL', type: 'text' }, // NEGATİF
        { id: 'tit_ph', name: 'pH', key: 'tit_ph', unit: '', type: 'numeric', range: { min: 5.0, max: 7.5 } },
        { id: 'tit_dansite', name: 'Dansite', key: 'tit_dansite', unit: '', type: 'numeric', range: { min: 1005, max: 1030 } },
        { id: 'tit_lokosit', name: 'Lökosit (Kimyasal)', key: 'tit_lokosit', unit: 'uL', type: 'text' }, // NEGATİF
        { id: 'tit_mikroskopi', name: 'İdrar Mikroskopisi', key: 'tit_mikroskopi', unit: 'Bulgu', type: 'text' } // NADİR HPF vb.
    ]
  },

  // --- AYRI AYRI HEPATIT / SEROLOJİ TESTLERİ ---
  
  // 1. KART TESTLER (Niteliksel - Var/Yok)
  { id: 's_hbsag_kart', name: 'HBsAg (Kart Test)', key: 'hbsag_kart', unit: 'Sonuç', type: 'text' },
  { id: 's_anti_hbs_kart', name: 'Anti HBs (Kart Test)', key: 'anti_hbs_kart', unit: 'Sonuç', type: 'text' },
  { id: 's_anti_hcv_kart', name: 'Anti HCV (Kart Test)', key: 'anti_hcv_kart', unit: 'Sonuç', type: 'text' },
  { id: 's_anti_hiv_kart', name: 'Anti HIV (Kart Test)', key: 'anti_hiv_kart', unit: 'Sonuç', type: 'text' },

  // 2. SAYISAL TESTLER (Niceliksel - Değer)
  { id: 's_hbsag_val', name: 'HBsAg', key: 'hbsag_val', unit: 'S/CO', type: 'numeric', range: { min: 0, max: 1 } },
  { id: 's_anti_hbs_val', name: 'Anti HBs', key: 'anti_hbs_val', unit: 'mIU/mL', type: 'numeric', range: { min: 10, max: 1000 } }, // Note: Min 10 for immunity
  { id: 's_anti_hcv_val', name: 'Anti HCV', key: 'anti_hcv_val', unit: 'S/CO', type: 'numeric', range: { min: 0, max: 1 } },
  { id: 's_anti_hiv_val', name: 'Anti HIV', key: 'anti_hiv_val', unit: 'S/CO', type: 'numeric', range: { min: 0, max: 1 } },

  // Diğer Standart Testler
  { id: '4', name: 'Glikoz (Açlık)', key: 'glikoz', unit: 'mg/dL', type: 'numeric', range: { min: 70, max: 100 } },
  { id: '5', name: 'Kolesterol (Total)', key: 'kolesterol', unit: 'mg/dL', type: 'numeric', range: { min: 0, max: 200 } },
  { id: '6', name: 'ALT', key: 'alt', unit: 'U/L', type: 'numeric', range: { min: 0, max: 41 } },
  { id: '7', name: 'AST', key: 'ast', unit: 'U/L', type: 'numeric', range: { min: 0, max: 40 } },
  { id: '8', name: 'Kreatinin', key: 'kreatinin', unit: 'mg/dL', type: 'numeric', range: { min: 0.7, max: 1.2 } },
  
  // Görüntüleme ve Diğerleri
  { id: '9', name: 'Akciğer Grafisi', key: 'akciger_grafisi', unit: 'Sonuç', type: 'text' },
  { id: '10', name: 'Odyometri (İşitme)', key: 'odyometri', unit: 'dB', type: 'text' },
  { id: '11', name: 'Göz Muayenesi', key: 'goz', unit: 'Not', type: 'text' },
  { id: '12', name: 'EKG', key: 'ekg', unit: 'Bulgu', type: 'text' },
  { id: '13', name: 'Tetanoz', key: 'tetanoz', unit: 'Aşı Durumu', type: 'text' },
  { id: '14', name: 'Kan Grubu', key: 'kan_grubu', unit: 'Grup', type: 'text' },
  { id: '15', name: 'Solunum Fonksiyon Testi (SFT)', key: 'sft', unit: 'Sonuç', type: 'text' },

  // --- PORTÖR MUAYENESİ (ARTIK AYRI AYRI) ---
  { id: 'p_burun', name: 'Burun Kültürü', key: 'burun_kulturu', unit: 'Sonuç', type: 'text' },
  { id: 'p_bogaz', name: 'Boğaz Kültürü', key: 'bogaz_kulturu', unit: 'Sonuç', type: 'text' },
  { id: 'p_gaita_kultur', name: 'Gaita Kültürü', key: 'gaita_kulturu', unit: 'Sonuç', type: 'text' },
  { id: 'p_gaita_mikro', name: 'Gaita Mikroskopi', key: 'gaita_mikroskopi', unit: 'Sonuç', type: 'text' },

  // --- TOKSİKOLOJİ / MARUZİYET (YENİ EKLENENLER) ---
  { id: 'toks_kreatinin_spot', name: 'Kreatinin (Spot İdrar)', key: 'kreatinin_spot_idrar', unit: 'mg/dL', type: 'numeric', range: { min: 20, max: 500 } },
  { id: 'toks_mukonik_asit', name: 't-Trans Mukonik Asit', key: 'mukonik_asit', unit: 'mg/L', type: 'numeric', range: { min: 0, max: 2.0 } }, // Ref belirtilmemiş, genel toksikoloji
  { id: 'toks_mukonik_oran', name: 't-Trans Muk. Asit / Kreatinin', key: 'mukonik_asit_oran', unit: 'mg/g crea', type: 'numeric', range: { min: 0, max: 0.5 } },
  
  // Ağır Metaller
  { id: 'toks_krom', name: 'Krom (Tam Kan)', key: 'krom', unit: 'µg/L', type: 'numeric', range: { min: 0.70, max: 28.00 } },
  { id: 'toks_kadmiyum', name: 'Kadmiyum (Tam Kan)', key: 'kadmiyum', unit: 'µg/L', type: 'numeric', range: { min: 0.00, max: 5.00 } },
  { id: 'toks_manganez', name: 'Manganez (Tam Kan)', key: 'manganez', unit: 'µg/L', type: 'numeric', range: { min: 4.70, max: 18.30 } },
  { id: 'toks_civa', name: 'Civa (Tam Kan)', key: 'civa', unit: 'µg/L', type: 'numeric', range: { min: 0.00, max: 10.00 } },
  { id: 'toks_kursun', name: 'Kurşun (Tam Kan)', key: 'kursun', unit: 'µg/dL', type: 'numeric', range: { min: 0.00, max: 20.00 } },

  // Kimyasallar
  { id: 'toks_fenol', name: 'Fenol (İdrar)', key: 'fenol_idrar', unit: 'mg/L', type: 'numeric', range: { min: 0, max: 50 } },
  { id: 'toks_fenol_oran', name: 'Fenol / Kreatinin Oranı', key: 'fenol_oran', unit: 'mg/g krea', type: 'numeric', range: { min: 0, max: 20 } },
  { id: 'toks_hidroksipiren', name: '1-Hidroksipiren', key: 'hidroksipiren', unit: 'µg/L', type: 'numeric', range: { min: 0.0, max: 2.5 } },
  { id: 'toks_benzen', name: 'Benzen (İdrar)', key: 'benzen_idrar', unit: 'µg/L', type: 'numeric', range: { min: 0, max: 1 } },
  { id: 'toks_okresol', name: 'O-Kresol', key: 'o_kresol', unit: 'mcg/ml', type: 'numeric', range: { min: 0, max: 1 } }
];

/** Varsayılan test fiyatları (₺) — test tanımında unitPrice yoksa kullanılır */
export const TEST_DEFAULT_PRICES: Record<string, number> = {
  // Paneller
  hemogram: 150,
  tam_idrar: 120,
  // Seroloji kart testleri
  hbsag_kart: 80, anti_hbs_kart: 80, anti_hcv_kart: 80, anti_hiv_kart: 80,
  // Seroloji kantitatif
  hbsag_val: 200, anti_hbs_val: 200, anti_hcv_val: 200, anti_hiv_val: 200,
  // Biyokimya
  glikoz: 60, kolesterol: 80, alt: 60, ast: 60, kreatinin: 60,
  // Muayene & görüntüleme
  akciger_grafisi: 250, odyometri: 200, goz: 150, ekg: 150,
  tetanoz: 250, kan_grubu: 100, sft: 200,
  // Portör kültürleri
  burun_kulturu: 100, bogaz_kulturu: 100, gaita_kulturu: 100, gaita_mikroskopi: 80,
  // Toksikoloji baz
  kreatinin_spot_idrar: 60, mukonik_asit: 400, mukonik_asit_oran: 150,
  // Ağır metaller
  krom: 350, kadmiyum: 350, manganez: 350, civa: 400, kursun: 350,
  // Kimyasallar
  fenol_idrar: 300, fenol_oran: 150, hidroksipiren: 500, benzen_idrar: 350, o_kresol: 350
};

/** Testin etkin birim fiyatı — test.unitPrice varsa o, yoksa varsayılan tablo */
export const testPrice = (t: { key: string; unitPrice?: number }): number =>
  t.unitPrice ?? TEST_DEFAULT_PRICES[t.key] ?? 0;

/** Test kategorileri — havuz gruplama ve teklif seçiminde kullanılır */
export const TEST_CATEGORIES: string[] = [
  'Paneller',
  'Seroloji',
  'Biyokimya',
  'Muayene & Görüntüleme',
  'Portör Kültürleri',
  'Ağır Metaller',
  'Toksikoloji',
  'Diğer'
];

/** Varsayılan kategori eşleşmesi — test tanımında category yoksa key'e göre çözülür */
export const DEFAULT_TEST_CATEGORIES: Record<string, string> = {
  hemogram: 'Paneller',
  tam_idrar: 'Paneller',
  hbsag_kart: 'Seroloji', anti_hbs_kart: 'Seroloji', anti_hcv_kart: 'Seroloji', anti_hiv_kart: 'Seroloji',
  hbsag_val: 'Seroloji', anti_hbs_val: 'Seroloji', anti_hcv_val: 'Seroloji', anti_hiv_val: 'Seroloji',
  glikoz: 'Biyokimya', kolesterol: 'Biyokimya', alt: 'Biyokimya', ast: 'Biyokimya', kreatinin: 'Biyokimya',
  akciger_grafisi: 'Muayene & Görüntüleme', odyometri: 'Muayene & Görüntüleme', goz: 'Muayene & Görüntüleme',
  ekg: 'Muayene & Görüntüleme', tetanoz: 'Muayene & Görüntüleme', kan_grubu: 'Muayene & Görüntüleme',
  sft: 'Muayene & Görüntüleme',
  burun_kulturu: 'Portör Kültürleri', bogaz_kulturu: 'Portör Kültürleri',
  gaita_kulturu: 'Portör Kültürleri', gaita_mikroskopi: 'Portör Kültürleri',
  krom: 'Ağır Metaller', kadmiyum: 'Ağır Metaller', manganez: 'Ağır Metaller', civa: 'Ağır Metaller', kursun: 'Ağır Metaller',
  kreatinin_spot_idrar: 'Toksikoloji', mukonik_asit: 'Toksikoloji', mukonik_asit_oran: 'Toksikoloji',
  fenol_idrar: 'Toksikoloji', fenol_oran: 'Toksikoloji', hidroksipiren: 'Toksikoloji',
  benzen_idrar: 'Toksikoloji', o_kresol: 'Toksikoloji'
};

/** Testin etkin kategorisi — test.category varsa o, yoksa key bazlı varsayılan */
export const testCategory = (t: { key: string; category?: string }): string =>
  t.category ?? DEFAULT_TEST_CATEGORIES[t.key] ?? 'Diğer';
