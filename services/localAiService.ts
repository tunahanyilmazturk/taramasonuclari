import { TestDefinition, PatientRecord, ResultStatus, ExtractedResult, ExtractionReport } from '../types';
import { flattenTests, normalizeTr, includesTr } from '../utils/lab';

/**
 * Yerel kural tabanlı AI servisi.
 * Gemini'ye bağımlı olmadan PDF metninden test sonuçlarını çıkarır
 * ve şablon tabanlı tıbbi kanaat üretir.
 */

// ─── METADATA ÇIKARIMI ───────────────────────────────────────────────────────

interface MetadataPatterns {
    nameKeys: string[];
    regKeys: string[];
    jobKeys: string[];
    dateKeys: string[];
}

const META: MetadataPatterns = {
    nameKeys: ['sayın', 'adı soyadı', 'ad soyad', 'adı:', 'hasta:', 'hastanın adı', 'adı soyadı:'],
    regKeys: ['protokol no', 'protokol', 'dosya no', 'hasta no', 'sicil no', 'sicil', 't.c. no', 'tc no', 'id no', 'hasta id'],
    jobKeys: ['görevi', 'mesleği', 'bölümü', 'departmanı', 'unvanı', 'pozisyon', 'görev', 'işyeri bölümü'],
    dateKeys: ['numune alma tarihi', 'numune tarihi', 'işlem tarihi', 'rapor tarihi', 'sonuç tarihi', 'onay tarihi', 'istek tarihi', 'tarih']
};

/** "DD.MM.YYYY" veya "DD/MM/YYYY" formatındaki tarihi bulur */
const DATE_RE = /(\d{1,2})[./](\d{1,2})[./](\d{2,4})/;

/** Çıkarılan değerin sonuna sızıntı yapan metadata'yı temizler */
const stripTrailingFields = (value: string): string => {
    const TRAILING_KEYS = [
        'numune', 'tarih', 'saat', 'protokol', 'dosya', 'hasta no',
        'sicil', 'tc no', 'id no', 'görevi', 'mesleği', 'bölümü',
        'departmanı', 'unvanı', 'pozisyon', 'sayın', 'adı soyadı',
        'cinsiyet', 'doğum', 'yaş', 'tel', 'telefon', 'eposta', 'email',
        'istek', 'onay', 'sonuç', 'rapor', 'işlem', 'numune alma'
    ];
    const norm = normalizeTr(value);
    let cutPos = value.length;
    for (const key of TRAILING_KEYS) {
        const idx = norm.indexOf(normalizeTr(key));
        if (idx > 0 && idx < cutPos) cutPos = idx;
    }
    return value.substring(0, cutPos).trim();
};

const extractField = (lines: string[], keys: string[]): string => {
    for (const line of lines) {
        const norm = normalizeTr(line);
        for (const key of keys) {
            const normKey = normalizeTr(key);
            const idx = norm.indexOf(normKey);
            if (idx === -1) continue;
            let value = line.substring(idx + normKey.length).trim();
            value = value.replace(/^[\s:=-]+/, '').trim();
            value = stripTrailingFields(value);
            if (value) return value;
        }
    }
    return '';
};

/** Bağımsız (etiketli olmayan) hasta adı satırını bulur */
const extractPatientName = (lines: string[]): string => {
    // 1. Önce etiketli alanlara bak
    const labeled = extractField(lines, META.nameKeys);
    if (labeled) return labeled;

    // 2. İsim + boşluk + bilinen metadata keyword
    //    "ALİ CANER ÜLKÜSAL Numune Alma Tarihi : 30.06.2026 12:29"
    //    "Ali Caner Ülküsal Görevi : Forklift Operatörü"
    const NAME_BEFORE_FIELD = /^([\p{L}\s]{4,60}?)\s+(?=(?:Numune|Tarih|Saat|Protokol|Dosya|Sicil|Görev|Meslek|Bölüm|Departman|Unvan|Cinsiyet|Doğum|Yaş|TC|Tel|İstek|Onay|Sonuç|Rapor|İşlem))/iu;
    for (const line of lines) {
        const m = line.match(NAME_BEFORE_FIELD);
        if (m && m[1].trim().split(/\s+/).length >= 2) {
            return m[1].trim();
        }
    }

    // 3. Tamamen ALL CAPS satır — başlık/etiket içermeyen, sadece isim
    for (const line of lines) {
        const t = line.trim();
        if (!t || t.includes(':') || t.length < 5 || t.length > 50) continue;
        // Türkçe büyük harfle başlayan, sadece büyük harf + boşluk içeren, en az 2 kelime
        if (/^[A-ZÇĞİÖŞÜ][A-ZÇĞİÖŞÜ\s]+$/.test(t) && t.split(/\s+/).length >= 2) {
            // Bilinen başlıkları atla (LABORATUVAR, SONUÇ RAPORU, vb.)
            if (!includesTr(t, 'laboratuvar') && !includesTr(t, 'sonuç') && !includesTr(t, 'rapor') &&
                !includesTr(t, 'tahlil') && !includesTr(t, 'test') && !includesTr(t, 'hastane') &&
                !includesTr(t, 'adı') && !includesTr(t, 'soyadı') && !includesTr(t, 'hasta') &&
                !includesTr(t, 'tarih') && !includesTr(t, 'numune') && !includesTr(t, 'protokol')) {
                return t;
            }
        }
    }

    return '';
};

/** İsim/alan sonundaki box-drawing ve pipe karakterlerini temizler */
const cleanFieldChars = (s: string): string =>
    s.replace(/[\u2500-\u257F|│┃]/g, '').replace(/\s+/g, ' ').trim();

const extractMetadata = (lines: string[]) => {
    const patientName = cleanFieldChars(extractPatientName(lines));
    const registrationNumber = cleanFieldChars(extractField(lines, META.regKeys));
    const jobTitle = cleanFieldChars(extractField(lines, META.jobKeys));

    // Tarih: önce etiketli alanlara bak, sonra genel date pattern'i tara
    let date = extractField(lines, META.dateKeys);
    if (!date) {
        for (const line of lines) {
            const m = line.match(DATE_RE);
            if (m) {
                date = m[0].replace(/\//g, '.');
                break;
            }
        }
    } else {
        const m = date.match(DATE_RE);
        if (m) date = m[0].replace(/\//g, '.');
        // Saat kısmını at
        date = date.split(' ')[0];
    }

    return { patientName, registrationNumber, jobTitle, date };
};

// ─── TEST EŞLEŞTIRME ─────────────────────────────────────────────────────────

/** Test için aranabilecek tüm metin varyasyonları */
const buildAliases = (test: TestDefinition): string[] => {
    const aliases = new Set<string>();

    // 1. Tam ad
    aliases.add(normalizeTr(test.name));

    // 2. Key (underscore → boşluk)
    aliases.add(normalizeTr(test.key.replace(/_/g, ' ')));

    // 3. Key (parantezsiz kısa ad) — ama eğer test adı parantezli bir niteleme içeriyorsa
    //    ve kısa ad başka bir testle çakışabilecek kadar jenerikse ekleme
    const shortName = test.name.split('(')[0].trim();
    if (shortName !== test.name) {
        const normShort = normalizeTr(shortName);
        // "Kreatinin (Spot İdrar)" → "kreatinin" tek başına ekleme (kan kreatinini yakalar)
        // Sadece parantez içeriğiyle birlikte ara
        const hasQualifier = test.name.includes('(');
        if (!hasQualifier || normShort.split(/\s+/).length > 1) {
            aliases.add(normShort);
        }
    }

    // 4. Bilinen alternatif yazımlar
    const ALIAS_MAP: Record<string, string[]> = {
        'wbc': ['wbc', 'lökosit', 'leukosit', 'beyaz küre', 'white blood cell'],
        'hgb': ['hgb', 'hemoglobin', 'hb'],
        'rbc': ['rbc', 'eritrosit', 'kırmızı küre', 'red blood cell'],
        'plt': ['plt', 'trombosit', 'platelet'],
        'hct': ['hct', 'hematokrit', 'pcv'],
        'mcv': ['mcv'],
        'mch': ['mch'],
        'mchc': ['mchc'],
        'rdw': ['rdw', 'rdw_cv', 'rdw-cv'],
        'mpv': ['mpv'],
        'pdw': ['pdw'],
        'pct': ['pct'],
        'neu_#': ['neu#', 'neu #', 'nötrofil#', 'nötrofil #', 'neutrophil#', 'neu.abs', 'neu abs'],
        'lymp_#': ['lymp#', 'lymp #', 'lenfosit#', 'lenfosit #', 'lymphocyte#', 'lym#', 'lym #'],
        'mon_#': ['mon#', 'mon #', 'monosit#', 'monosit #', 'monocyte#'],
        'eos_#': ['eos#', 'eos #', 'eozinofil#', 'eozinofil #', 'eosinophil#'],
        'bas_#': ['bas#', 'bas #', 'bazofil#', 'bazofil #', 'basophil#'],
        'neu_%': ['neu%', 'neu %', 'nötrofil%', 'nötrofil %'],
        'lym_%': ['lym%', 'lym %', 'lenfosit%', 'lenfosit %'],
        'mon_%': ['mon%', 'mon %', 'monosit%', 'monosit %'],
        'eos_%': ['eos%', 'eos %', 'eozinofil%', 'eozinofil %'],
        'bas_%': ['bas%', 'bas %', 'bazofil%', 'bazofil %'],
        'glikoz': ['glikoz', 'glukoz', 'açlık glikoz', 'açlık glukoz', 'fasting glucose', 'glucose', 'glukoz (açlık)'],
        'kolesterol': ['kolesterol', 'total kolesterol', 'cholesterol'],
        'alt': ['alt', 'sgpt', 'alanin aminotransferaz'],
        'ast': ['ast', 'sgot', 'aspartat aminotransferaz'],
        'kreatinin': ['kreatinin', 'creatinine', 'krea'],
        'tetanoz': ['tetanoz', 'tetanus', 'td', 'dt'],
        'kan_grubu': ['kan grubu', 'kan grubu', 'blood group', 'abo', 'rh'],
        'goz': ['göz', 'göz muayenesi', 'göz muayene', 'eye examination', 'görme', 'vizu'],
        'ekg': ['ekg', 'ecg', 'elektrokardiyogram'],
        'odyometri': ['odyometri', 'odyo', 'işitme', 'audiometri', 'audiometry', 'hearing'],
        'akciger_grafisi': ['akciğer', 'akciğer grafisi', 'pa akciğer', 'chest x-ray', 'toraks', 'pa ac'],
        'sft': ['sft', 'solunum fonksiyon', 'spirometri', 'spirometry', 'solunum testi'],
        'tam_idrar': ['tam idrar', 'tam idrar tahlili', 'tit', 'urinalysis', 'idrar tahlili'],
        'burun_kulturu': ['burun kültürü', 'burun kulturu', 'burun', 'nasal kültür'],
        'bogaz_kulturu': ['boğaz kültürü', 'boğaz kulturu', 'boğaz', 'throat kültür', 'farinks'],
        'gaita_kulturu': ['gaita kültürü', 'gaita kulturu', 'dışkı kültürü', 'stool kültür', 'gaita'],
        'gaita_mikroskopi': ['gaita mikroskopi', 'dışkı mikroskopi', 'stool mikroskopi', 'gaita mikroskopisi'],
        'kreatinin_spot_idrar': ['spot idrar kreatinin', 'idrar kreatinin', 'kreatinin spot'],
        'mukonik_asit': ['mukonik asit', 't-trans mukonik', 'ttma', 'muk.asit'],
        'mukonik_asit_oran': ['mukonik asit oran', 'muk.asit/krea', 'muk asit oranı', 'mukonik/kreatinin'],
        'fenol_idrar': ['fenol', 'phenol', 'idrar fenol'],
        'fenol_oran': ['fenol oran', 'fenol/krea', 'fenol oranı'],
        'hidroksipiren': ['hidroksipiren', '1-ohp', '1-hidroksipiren', 'hydroxypyrene'],
        'benzen_idrar': ['benzen', 'benzene', 'idrar benzen'],
        'o_kresol': ['o-kresol', 'o kresol', 'orto kresol', 'cresol'],
        'krom': ['krom', 'chromium', 'cr'],
        'kadmiyum': ['kadmiyum', 'cadmium', 'cd'],
        'manganez': ['manganez', 'manganese', 'mn'],
        'civa': ['civa', 'mercury', 'hg', 'cıva'],
        'kursun': ['kurşun', 'kursun', 'lead', 'pb'],
        'hbsag_kart': ['hbsag kart', 'hbsag (kart', 'hbsag kart test'],
        'anti_hbs_kart': ['anti hbs kart', 'anti-hbs kart', 'anti hbs (kart'],
        'anti_hcv_kart': ['anti hcv kart', 'anti-hcv kart', 'anti hcv (kart'],
        'anti_hiv_kart': ['anti hiv kart', 'anti-hiv kart', 'anti hiv (kart'],
        'hbsag_val': ['hbsag', 'hbs ag', 'hepatit b yüzey antijeni'],
        'anti_hbs_val': ['anti hbs', 'anti-hbs', 'anti hbs (kantitatif)', 'hepatit b antikoru'],
        'anti_hcv_val': ['anti hcv', 'anti-hcv', 'anti hcv (kantitatif)', 'hepatit c antikoru'],
        'anti_hiv_val': ['anti hiv', 'anti-hiv', 'anti hiv (kantitatif)', 'hiv antikoru'],
        'tit_eritrosit': ['eritrosit', 'idrar eritrosit', 'eritrosit (idrar)'],
        'tit_bilirubin': ['bilirubin', 'idrar bilirubin'],
        'tit_urobilinojen': ['urobilinojen', 'idrar urobilinojen'],
        'tit_keton': ['keton', 'idrar keton', 'keton cisimcikleri'],
        'tit_protein': ['protein', 'idrar protein', 'idrar proteini'],
        'tit_nitrit': ['nitrit', 'idrar nitrit'],
        'tit_glukoz': ['glukoz (idrar)', 'idrar glukoz', 'idrar glukozu', 'glukoz'],
        'tit_ph': ['ph', 'idrar ph'],
        'tit_dansite': ['dansite', 'density', 'idrar dansite', 'yoğunluk', 'specific gravity'],
        'tit_lokosit': ['lökosit (kimyasal)', 'lökosit', 'idrar lökosit', 'leukocyte'],
        'tit_mikroskopi': ['idrar mikroskopi', 'idrar mikroskopisi', 'mikroskopi', 'sediment'],
        'pnomokonyoz_1': ['pnmokonyoz', 'pnömokonyoz', 'pnomokonyoz', 'ilo', 'radyografi okuma', 'dier yorumlar', 'diğer yorumlar', '4d', '4d. diğer yorumlar'],
        'pnomokonyoz_2': ['pnmokonyoz', 'pnömokonyoz', 'pnomokonyoz', 'ilo', 'radyografi okuma', 'dier yorumlar', 'diğer yorumlar', '4d', '4d. diğer yorumlar'],
        // Servikal Grafi — radyoloji raporu
        'servikal_grafi': ['servikal grafi', 'servikal grafide', 'servikal vertebra grafi', 'servikal', 'cervical', 'iki yönlü servikal', 'servikal vertebra'],
        // Lumbosakral Grafi — radyoloji raporu
        'lumbosakral_grafi': ['lumbosakral grafi', 'lumbosakral grafide', 'lumbosakral', 'lumbar', 'iki yönlü lumbosakral', 'lumbosakral vertebra', 'lomber'],
        // Ek-2 Belgesi
        'ek_2_belgesi': ['ek-2', 'ek 2 belgesi', 'ek-2 belgesi', 'ek2']
    };

    const testKeyLower = normalizeTr(test.key);
    const mapped = ALIAS_MAP[testKeyLower];
    if (mapped) mapped.forEach(a => aliases.add(a));

    return Array.from(aliases);
};

/** Satırın test ile eşleşip eşleşmediğini kontrol eder — word boundary kullanır */
const matchLine = (normLine: string, aliases: string[]): { matched: boolean; endPos: number } => {
    for (const alias of aliases) {
        const normAlias = normalizeTr(alias);
        if (normAlias.length < 2) continue;

        // Escape regex özel karakterleri
        const escaped = normAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Word boundary: satır başı veya harf/sayı olmayan karakter öncesi
        //                  harf/sayı olmayan karakter veya satır sonu sonrası
        // Bu "kol" → "protokol" veya "kolon" eşleşmesini engeller
        const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?=[^\\p{L}\\p{N}]|$)`, 'iu');
        const m = normLine.match(re);
        if (m) {
            const endPos = (m.index ?? 0) + m[0].length;
            return { matched: true, endPos };
        }
    }
    return { matched: false, endPos: -1 };
};

// ─── DEĞER ÇIKARIMI ──────────────────────────────────────────────────────────

/** Satırdan test adından sonraki değeri çıkarır */
const extractValue = (line: string, endPos: number, test: TestDefinition): string | undefined => {
    const remainder = line.substring(endPos).trim();

    if (test.type === 'numeric') {
        return extractNumericValue(remainder);
    }
    return extractTextValue(remainder, test);
};

/** Değer sadece bölüm başlığı mı? (ÖLÇÜM RAPORU, SONUÇ RAPORU vb.) */
const isHeaderOnly = (value: string): boolean => {
    const norm = normalizeTr(value);
    return includesTr(norm, 'ölçüm raporu') || includesTr(norm, 'sonuç raporu') ||
        includesTr(norm, 'raporu') && norm.split(' ').length <= 3 ||
        includesTr(norm, 'muayenesi') && norm.split(' ').length <= 3;
};

/**
 * Çok satırlı bölüm taraması — karmaşık testler için (göz, ekg, odyometri, akciğer, sft).
 * Eşleşen satır + sonraki ~8 satırı birleştirip sonuç arar.
 */
const extractSectionValue = (lines: string[], startIdx: number, test: TestDefinition): string | undefined => {
    const SECTION_LINES = 8;
    const endIdx = Math.min(startIdx + SECTION_LINES, lines.length);
    const sectionText = lines.slice(startIdx, endIdx).join('\n');

    return extractTextValue(sectionText, test, true);
};

/** Sayısal değer çıkar — Türkçe ondalık virgül destekler */
const extractNumericValue = (text: string): string | undefined => {
    // Ayraçları temizle
    const cleaned = text.replace(/^[\s:=-]+/, '');
    // İlk sayıyı bul (virgüllü ondalık destekli)
    const match = cleaned.match(/(\d+[.,]?\d*)/);
    if (!match) return undefined;

    // Referans aralığı değil, hasta sonucu al — örn "7.2    K/uL    4-10" → 7.2
    return match[1].replace(',', '.');
};

/** Metin değer çıkar — Negatif/Pozitif/Normal/+++/etc.
 *  `suppressFallback`: true ise hiçbir kural eşleşmezse undefined döner (çok satırlı bölüm taraması için) */
const extractTextValue = (text: string, test: TestDefinition, suppressFallback = false): string | undefined => {
    const cleaned = text.replace(/^[\s:=-]+/, '').trim();
    if (!cleaned) return undefined;

    const norm = normalizeTr(cleaned);

    // Seroloji / kart testleri — negatif/pozitif kontrolü
    if (test.key.includes('_kart') || test.key.includes('hbsag') || test.key.includes('anti_h') || test.key.includes('anti_hcv') || test.key.includes('anti_hiv')) {
        if (includesTr(norm, 'negatif')) return 'NEGATİF';
        if (includesTr(norm, 'pozitif')) return 'POZİTİF';
        if (includesTr(norm, 'nonreaktif')) return 'NEGATİF';
        if (includesTr(norm, 'reaktif')) return 'POZİTİF';
    }

    // Kültür testleri
    if (test.key.includes('kulturu') || test.key.includes('gaita')) {
        if (includesTr(norm, 'üreme yok') || includesTr(norm, 'üremedi') || includesTr(norm, 'normal flora') ||
            includesTr(norm, 'patojen bakteri görülmedi') || includesTr(norm, 'patojen görülmedi')) {
            return 'Üreme Yok / Normal';
        }
        if (includesTr(norm, 'pozitif') || includesTr(norm, 'üredi') || includesTr(norm, 'koloni')) {
            // Organizm adını bulmaya çalış
            const orgMatch = cleaned.match(/(?:üredi|pozitif|koloni)[:\s]+(.+)/i);
            return orgMatch ? `Pozitif: ${orgMatch[1].trim()}` : 'Pozitif';
        }
    }

    // TİT sembolleri ve kelimeler
    if (test.key.includes('tit_')) {
        // +, ++, +++, ++++ sembolleri
        const plusMatch = cleaned.match(/(\+{1,4})/);
        if (plusMatch) {
            const plusText = norm.includes('pozitif') ? `${plusMatch[1]} Pozitif` : plusMatch[1];
            return plusText;
        }
        if (includesTr(norm, 'negatif')) return 'Negatif';
        if (includesTr(norm, 'pozitif')) return 'Pozitif';
        if (includesTr(norm, 'normal')) return 'Normal';
        if (includesTr(norm, 'eser')) return 'Eser';
        if (includesTr(norm, 'nadir')) return 'Nadir';
    }

    // Kan grubu
    if (test.key.includes('kan_grubu')) {
        const bloodMatch = cleaned.match(/\b(0|A|B|AB)\s*(Rh)?\s*([+-]|Pozitif|Negatif)?\b/i);
        if (bloodMatch) {
            let result = bloodMatch[0].trim().toUpperCase();
            if (includesTr(norm, 'pozitif') && !result.includes('+')) result += ' Rh+';
            if (includesTr(norm, 'negatif') && !result.includes('-')) result += ' Rh-';
            return result;
        }
    }

    // Tetanoz
    if (test.key.includes('tetanoz')) {
        if (includesTr(norm, 'yapıldı') || includesTr(norm, 'var') || includesTr(norm, '+') || includesTr(norm, 'tamam')) {
            return 'Tetanoz aşısı yapılmıştır';
        }
        if (includesTr(norm, 'yok') || includesTr(norm, 'yapılmadı') || includesTr(norm, 'kaydı yok')) {
            return 'Aşı Kaydı Yok';
        }
    }

    // Göz muayenesi — birleşik metin
    if (test.key.includes('goz')) {
        const parts: string[] = [];
        if (includesTr(norm, 'renk körlüğü yok') || includesTr(norm, 'renk korlugu yok') ||
            includesTr(norm, 'renk körlüğü yoktur') || includesTr(norm, 'renk korlugu yoktur')) {
            parts.push('Renk Körlüğü Yok');
        } else if (includesTr(norm, 'renk körlüğü var') || includesTr(norm, 'renk korlugu var')) {
            parts.push('Renk Körlüğü Var');
        }
        if (includesTr(norm, 'gece çalışabilir') || includesTr(norm, 'gece calisabilir')) {
            parts.push('Gece Çalışabilir');
        } else if (includesTr(norm, 'gece çalışamaz') || includesTr(norm, 'gece calisamaz')) {
            parts.push('Gece Çalışamaz');
        }
        // Gözlük tespiti — sadece hasta bulgusu olarak geçen ifadeleri al, kolon başlığını alma
        if (includesTr(norm, 'gözlük kullan') || includesTr(norm, 'gozluk kullan') ||
            includesTr(norm, 'gözlükle') || includesTr(norm, 'gozlukle') ||
            includesTr(norm, 'lens kullan') || includesTr(norm, 'lens kullanıyor')) {
            parts.push('Gözlük/Lens Kullanıyor');
        }
        // Görme keskinliği 10/10 veya "tam" ifadesi
        if (includesTr(norm, '10/10') || includesTr(norm, 'tam görme') ||
            includesTr(norm, 'her iki göz tam') || includesTr(norm, 'görme tam')) {
            parts.push('Her iki göz tam (10/10)');
        }
        // Sonuç satırı: "Sonuç: SAĞLAM" veya "Sonuç: Normal"
        if (includesTr(norm, 'sonuç:') || includesTr(norm, 'sonuc:')) {
            if (includesTr(norm, 'sağlam') || includesTr(norm, 'saglam') ||
                includesTr(norm, 'normal') || includesTr(norm, 'uygun')) {
                if (!parts.some(p => p.includes('tam') || p.includes('SAĞLAM'))) {
                    parts.push('Sonuç: Sağlam');
                }
            }
        }
        if (parts.length > 0) return parts.join(' | ');
    }

    // EKG
    if (test.key.includes('ekg')) {
        if (includesTr(norm, 'normal') || includesTr(norm, 'nsr') || includesTr(norm, 'sinüs') ||
            includesTr(norm, 'normal sinüs') || includesTr(norm, 'özellik yok')) {
            return 'Normal Sinüs Ritmi';
        }
        // Patoloji adı geçiyorsa al
        const pathMatch = cleaned.match(/(taşikardi|bradikardi|aritmi|iskemi|blok|dal|hipertrofi|fibrilasyon)/i);
        if (pathMatch) return pathMatch[1].charAt(0).toUpperCase() + pathMatch[1].slice(1);
    }

    // Odyometri
    if (test.key.includes('odyometri') || test.key.includes('odyo')) {
        if (includesTr(norm, 'normal') || includesTr(norm, 'kayıp yok') || includesTr(norm, 'kayip yok') ||
            includesTr(norm, 'normal sınırlarda') || includesTr(norm, 'normoacusis')) {
            return 'Bilateral İşitme Normal';
        }
        const lossMatch = cleaned.match(/(sensörinöral|sensorinöral|iletim tipi|hafif|orta|ileri|kayip|kayıp|işitme kaybı)/i);
        if (lossMatch) return `İşitme Kaybı: ${lossMatch[0]}`;
    }

    // Akciğer grafisi
    if (test.key.includes('akciger') || test.key.includes('thorax')) {
        if (includesTr(norm, 'normal') || includesTr(norm, 'aktif lezyon yok') || includesTr(norm, 'lezyon yok') ||
            includesTr(norm, 'normal sınırlarda') || includesTr(norm, 'pa normal')) {
            return 'Normal PA Akciğer Grafisi';
        }
        const pathMatch = cleaned.match(/(infiltrasyon|nodül|kalsifikasyon|büyük|fibrozis|kitle|konsolidasyon)/i);
        if (pathMatch) return `Bulgu: ${pathMatch[0]}`;
    }

    // Servikal Grafi — radyoloji raporu
    if (test.key.includes('servikal')) {
        // SONUÇ: satırını özel olarak yakala
        const sonucMatch = cleaned.match(/sonu[cç]\s*[:=]\s*(.+)/i);
        if (sonucMatch) {
            const sonuc = sonucMatch[1].trim();
            if (includesTr(normalizeTr(sonuc), 'normal') || includesTr(normalizeTr(sonuc), 'tabii') ||
                includesTr(normalizeTr(sonuc), 'sağlam')) {
                return 'Normal Servikal Vertebra Grafisi';
            }
            if (sonuc.length > 3) return sonuc;
        }
        if (includesTr(norm, 'normal') || includesTr(norm, 'tabii') || includesTr(norm, 'doğaldır') ||
            includesTr(norm, 'patoloji izlenmedi') || includesTr(norm, 'normal sınırlarda') ||
            includesTr(norm, 'sağlam') || includesTr(norm, 'normaldir')) {
            return 'Normal Servikal Vertebra Grafisi';
        }
        const pathMatch = cleaned.match(/(skolyoz|lordoz|kifoz|deformite|daralma|dejeneratif|herniasyon|kemik lezyonu|osteopeni|osteoporoz)/i);
        if (pathMatch) return `Bulgu: ${pathMatch[0]}`;
    }

    // Lumbosakral Grafi — radyoloji raporu
    if (test.key.includes('lumbosakral') || test.key.includes('lumbar') || test.key.includes('lomber')) {
        // SONUÇ: satırını özel olarak yakala
        const sonucMatch = cleaned.match(/sonu[cç]\s*[:=]\s*(.+)/i);
        if (sonucMatch) {
            const sonuc = sonucMatch[1].trim();
            if (includesTr(normalizeTr(sonuc), 'normal') || includesTr(normalizeTr(sonuc), 'tabii') ||
                includesTr(normalizeTr(sonuc), 'sağlam')) {
                return 'Normal Lumbosakral Vertebra Grafisi';
            }
            if (sonuc.length > 3) return sonuc;
        }
        if (includesTr(norm, 'normal') || includesTr(norm, 'tabii') || includesTr(norm, 'doğaldır') ||
            includesTr(norm, 'patoloji izlenmedi') || includesTr(norm, 'normal sınırlarda') ||
            includesTr(norm, 'sağlam') || includesTr(norm, 'normaldir')) {
            return 'Normal Lumbosakral Vertebra Grafisi';
        }
        const pathMatch = cleaned.match(/(skolyoz|lordoz|kifoz|deformite|daralma|dejeneratif|herniasyon|kemik lezyonu|osteopeni|osteoporoz|kompresyon)/i);
        if (pathMatch) return `Bulgu: ${pathMatch[0]}`;
    }

    // Ek-2 Belgesi — henüz taranmıyor, açık bırakıldı
    if (test.key.includes('ek_2')) {
        // Ek-2 belgesi manuel olarak taranacak — otomatik çıkarım yok
        return undefined;
    }

    // SFT
    if (test.key.includes('sft') || test.key.includes('solunum')) {
        if (includesTr(norm, 'normal spirometri') || includesTr(norm, 'normal') ||
            includesTr(norm, 'kabul edilebilir') || includesTr(norm, 'yeterli')) {
            return 'Normal Spirometri';
        }
        const pathMatch = cleaned.match(/(obstrüktif|restriktif|küçük hava yolu|miks|kombine|hafif|orta|ağır)/i);
        if (pathMatch) return `SFT Bulgusu: ${pathMatch[0]}`;
    }

    // Pnömokonyoz — ILO radyografi okuma raporu
    // "4D. DİĞER YORUMLAR" kısmındaki metni al
    if (test.key.includes('pnomokonyoz')) {
        // "pnömokonyoz açısından" ifadesini ara — bu genelde sonuç satırıdır
        if (includesTr(norm, 'pnömokonyoz') || includesTr(norm, 'pnmokonyoz') || includesTr(norm, 'pnomokonyoz')) {
            // "normal sınırlarda" varsa normal kabul et
            if (includesTr(norm, 'normal') && (includesTr(norm, 'sınır') || includesTr(norm, 'sinir'))) {
                return 'Pnömokonyoz açısından normal sınırlarda akciğer grafisi';
            }
            // Patoloji varsa metni al
            if (includesTr(norm, 'bulgu') || includesTr(norm, 'patoloji') || includesTr(norm, 'anormallik') ||
                includesTr(norm, 'opasite') || includesTr(norm, 'plak') || includesTr(norm, 'kalınla')) {
                // "4D" ve "DİĞER YORUMLAR" başlığını temizle
                const result = cleaned.replace(/^4d[.\s]*/i, '').replace(/diger yorumlar/i, '').replace(/diğer yorumlar/i, '').trim();
                if (result) return result;
            }
            // Genel durum — metni temizle ve döndür
            const result = cleaned.replace(/^4d[.\s]*/i, '').replace(/diger yorumlar/i, '').replace(/diğer yorumlar/i, '').trim();
            if (result && result.length > 5) return result;
        }
    }

    // Genel metin — temizlenmiş kalan metni döndür (kısa olanı)
    if (!suppressFallback && cleaned.length < 80) return cleaned;
    return undefined;
};

// ─── ANA ÇIKARIM FONKSİYONU ─────────────────────────────────────────────────

/**
 * Kural tabanlı PDF metin analizi — Gemini'ye bağımlı değil.
 * Satır satır tarar, test adlarını eşleştirir, değerleri çıkarır.
 */
export const analyzeMedicalTextLocal = (
    text: string,
    tests: TestDefinition[]
): ExtractionReport => {

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const meta = extractMetadata(lines);
    const flatTests = flattenTests(tests);
    const extractedResults: ExtractedResult[] = [];
    const foundTests: string[] = [];
    const missingTests: string[] = [];

    // Her test için değer bul
    for (const test of flatTests) {
        const aliases = buildAliases(test);
        // Karmaşık metin testleri — çok satırlı bölüm taraması gerektirir
        const needsSectionScan = test.type === 'text' && (
            test.key.includes('goz') || test.key.includes('ekg') || test.key.includes('odyometri') ||
            test.key.includes('odyo') || test.key.includes('akciger') || test.key.includes('thorax') ||
            test.key.includes('sft') || test.key.includes('solunum') || test.key.includes('kulturu') ||
            test.key.includes('gaita') || test.key.includes('tetanoz') || test.key.includes('kan_grubu') ||
            test.key.includes('pnomokonyoz') || test.key.includes('servikal') || test.key.includes('lumbosakral') ||
            test.key.includes('ek_2')
        );

        let found = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const normLine = normalizeTr(line);
            const match = matchLine(normLine, aliases);
            if (!match.matched) continue;

            let value: string | undefined;
            if (needsSectionScan) {
                value = extractSectionValue(lines, i, test);
            } else {
                value = extractValue(line, match.endPos, test);
            }

            // Bölüm başlığı kalıntısını değer olarak kabul etme
            if (value !== undefined && isHeaderOnly(value)) continue;

            if (value !== undefined) {
                // Sayısal değer sağlık kontrolü — aşırı uçuk değerleri reddet
                // (örn. protokol numarası 12345 kolesterol olarak okunmasın)
                if (test.type === 'numeric') {
                    const numVal = parseFloat(String(value));
                    if (!isNaN(numVal) && test.range) {
                        const rangeSpan = test.range.max - test.range.min;
                        if (numVal > test.range.max + rangeSpan * 20) {
                            console.warn(`Şüpheli değer reddedildi: ${test.name} = ${value} (aralık: ${test.range.min}-${test.range.max})`);
                            break;
                        }
                    }
                }

                extractedResults.push({
                    testName: test.name,
                    value: String(value),
                    unit: test.unit || ''
                });
                foundTests.push(test.name);
                found = true;
                break; // İlk eşleşme yeterli
            }
        }
        if (!found) missingTests.push(test.name);
    }

    return {
        patientName: meta.patientName || 'Bilinmeyen Hasta',
        registrationNumber: meta.registrationNumber || 'Belirtilmemiş',
        jobTitle: meta.jobTitle || 'Belirtilmemiş',
        date: meta.date || new Date().toISOString().split('T')[0],
        extractedResults,
        foundTests,
        missingTests,
        totalTests: flatTests.length,
        foundCount: extractedResults.length
    };
};

// ─── ŞABLON TABANLI KANAAT ÜRETİMİ ──────────────────────────────────────────

/**
 * Şablon tabanlı tıbbi kanaat — Gemini'ye bağımlı değil.
 * Kayıt durumlarına göre standart işyeri hekimi kanaati üretir.
 */
export const generateMedicalSummaryLocal = (record: PatientRecord): string => {
    const abnormalFindings: string[] = [];
    const normalTests: string[] = [];

    Object.entries(record.status).forEach(([testId, status]) => {
        const res = record.results[testId];
        if (!res) return;

        if (status === ResultStatus.HIGH) {
            abnormalFindings.push(`${res.testName}: Yüksek (${res.value})`);
        } else if (status === ResultStatus.LOW) {
            abnormalFindings.push(`${res.testName}: Düşük (${res.value})`);
        } else if (status === ResultStatus.UNKNOWN) {
            const val = String(res.value);
            if (includesTr(val, 'pozitif') || includesTr(val, 'var') || includesTr(val, 'patoloji')) {
                abnormalFindings.push(`${res.testName}: ${val}`);
            } else {
                normalTests.push(res.testName);
            }
        } else {
            normalTests.push(res.testName);
        }
    });

    // Tüm değerler normalse
    if (abnormalFindings.length === 0) {
        return 'Yapılan tetkiklerde patolojik bir bulguya rastlanmamıştır. Periyodik muayene açısından uygundur.';
    }

    // Anormal bulguları listele
    const findings = abnormalFindings.join(', ');
    const jobNote = record.jobTitle && record.jobTitle !== 'Belirtilmemiş'
        ? `Hastanın görevi: ${record.jobTitle}.`
        : '';

    // Klinik anlam tahmini (basit kurallar)
    const implications: string[] = [];

    if (abnormalFindings.some(f => includesTr(f, 'wbc') || includesTr(f, 'lökosit'))) {
        implications.push('Enfeksiyon veya inflamatuvar süreç lehine değerlendirilebilir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'hgb') || includesTr(f, 'hemoglobin') || includesTr(f, 'hct'))) {
        implications.push('Anemi veya polisitemi açısından değerlendirilmelidir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'plt') || includesTr(f, 'trombosit'))) {
        implications.push('Kanama veya pıhtılaşma bozukluğu açısından değerlendirilmelidir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'alt') || includesTr(f, 'ast') || includesTr(f, 'sgpt') || includesTr(f, 'sgot'))) {
        implications.push('Karaciğer fonksiyon bozukluğu düşündürebilir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'kreatinin'))) {
        implications.push('Böbrek fonksiyonu açısından değerlendirilmelidir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'glikoz') || includesTr(f, 'glukoz'))) {
        implications.push('Diyabet veya metabolik bozukluk açısından değerlendirilmelidir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'kolesterol'))) {
        implications.push('Lipid metabolizması bozukluğu düşündürebilir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'hbsag') || includesTr(f, 'hepatit'))) {
        implications.push('Hepatit B açısından ileri değerlendirme önerilir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'işitme') || includesTr(f, 'odyometri'))) {
        implications.push('İşitme kaybı açısından KBB konsültasyonu önerilir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'akciğer') || includesTr(f, 'sft') || includesTr(f, 'solunum'))) {
        implications.push('Solunum sistemi açısından ileri değerlendirme önerilir');
    }
    if (abnormalFindings.some(f => includesTr(f, 'göz') || includesTr(f, 'renk körlüğü'))) {
        implications.push('Görme açısından göz muayenesi önerilir');
    }

    let summary = `${jobNote} Yapılan tetkiklerde aşağıdaki anormal bulgular tespit edilmiştir: ${findings}.`;

    if (implications.length > 0) {
        summary += ` ${implications.join('; ')}.`;
    }

    // Standart öneri
    if (abnormalFindings.length <= 2) {
        summary += ' İlgili branş poliklinik kontrolü önerilir.';
    } else {
        summary += ' İlgili branş poliklinik kontrolleri önerilir. İşe girişinde/periodik muayenede tıbbi açıdan takip edilmelidir.';
    }

    return summary;
};
