import type { GoogleGenAI } from "@google/genai";
import { TestDefinition, PatientRecord, ResultStatus, ExtractedResult, ExtractionReport } from "../types";
import { flattenTests, includesTr, normalizeTr } from "../utils/lab";
import { aiConfigService } from "./aiConfigService";
import { analyzeMedicalTextLocal, generateMedicalSummaryLocal } from "./localAiService";
import { analyzeMedicalTextOpenRouter, generateMedicalSummaryOpenRouter, testOpenRouterConnection } from "./openrouterService";

// @google/genai büyük bir SDK — ilk AI çağrısında lazy-load edilir
const getAiClient = async (): Promise<GoogleGenAI> => {
  const apiKey = aiConfigService.getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API anahtarı tanımlı değil. Ayarlar → AI & API bölümünden anahtarınızı girin veya Yerel Sistem'e geçin.");
  }
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey });
};

// Ayarlar sayfasındaki "Bağlantıyı Test Et" için minimal çağrı
export const testAiConnection = async (): Promise<string> => {
    const provider = aiConfigService.getProvider();
    if (provider === 'openrouter') {
        return testOpenRouterConnection();
    }
    if (provider === 'local') {
        return 'Yerel sistem aktif — API gerekmez.';
    }
    const ai = await getAiClient();
    const response = await ai.models.generateContent({
        model: aiConfigService.getModel('comment'),
        contents: 'Sadece "OK" yaz.',
        config: { maxOutputTokens: 16, temperature: 0 }
    });
    return response.text?.trim() || 'Boş yanıt alındı';
};

// Helper function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 429 hatalarını yakala ve API'nin söylediği retryDelay kadar bekle
const isRateLimitError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const e = error as Record<string, unknown>;
    const status = e.status as string | undefined;
    const message = (e.message as string | undefined) || '';
    return status === '429' || message.includes('429') || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota');
};

// 429 hatasından API'nin söylediği bekleme süresini çıkar (saniye → ms)
const extractRetryDelay = (error: unknown): number => {
    try {
        const e = error as Record<string, unknown>;
        const message = (e.message as string) || '';
        // "Please retry in 50.594168496s" formatını yakala
        const match = message.match(/retry in ([\d.]+)s/i);
        if (match) return Math.ceil(parseFloat(match[1]) * 1000) + 1000; // +1s buffer
    } catch { /* ignore */ }
    return 60000; // Varsayılan: 60 saniye
};

// --- OPTIMIZATION: SMART TEXT PRE-PROCESSING ---
// Reduces token usage and latency by filtering out irrelevant pages/lines from large PDFs
const filterRelevantContext = (fullText: string, tests: TestDefinition[]): string => {
    // 1. If text is small (< 50k chars ~ 10-15 pages), send full context for best accuracy.
    if (fullText.length < 50000) return fullText;

    // 2. For large texts, extract relevant sections
    const lines = fullText.split('\n');
    const relevantIndices = new Set<number>();
    
    // Create a set of keywords from test definitions
    const keywords: string[] = [];
    const addKeywords = (def: TestDefinition) => {
        keywords.push(normalizeTr(def.name));
        keywords.push(normalizeTr(def.key.replace(/_/g, ' ')));
        if (def.subTests) def.subTests.forEach(addKeywords);
    };
    tests.forEach(addKeywords);

    // Scan lines
    lines.forEach((line, idx) => {
        const lowerLine = normalizeTr(line);
        // Always keep metadata lines
        if (includesTr(line, 'tarih') || includesTr(line, 'sayın') || includesTr(line, 'hasta') || includesTr(line, 'protokol')) {
            relevantIndices.add(idx);
            return;
        }

        // Keep lines matching test names + context window (1 line before, 2 lines after)
        if (keywords.some(k => lowerLine.includes(k))) {
            if (idx > 0) relevantIndices.add(idx - 1);
            relevantIndices.add(idx);
            if (idx < lines.length - 1) relevantIndices.add(idx + 1);
            if (idx < lines.length - 2) relevantIndices.add(idx + 2);
        }
    });

    // Reconstruct text maintaining order
    const sortedIndices = Array.from(relevantIndices).sort((a, b) => a - b);
    let filteredText = "";
    let lastIdx = -1;

    sortedIndices.forEach(idx => {
        if (lastIdx !== -1 && idx > lastIdx + 1) {
            filteredText += "\n... [Irrelevant sections skipped] ...\n";
        }
        filteredText += lines[idx] + "\n";
        lastIdx = idx;
    });

    console.log(`Smart Context: Reduced ${fullText.length} chars to ${filteredText.length} chars.`);
    return filteredText;
};

// --- 1. MAIN EXTRACTION FUNCTION (GEMINI) ---
const analyzeMedicalTextGemini = async (
  text: string,
  tests: TestDefinition[],
  retries = 5
): Promise<ExtractionReport> => {
  
  const ai = await getAiClient();
  const { Type } = await import("@google/genai");

  // Apply Smart Filtering
  const processedText = filterRelevantContext(text, tests);

  const generateDescription = (t: TestDefinition): string => {
    // Custom Logic for Specific Tests
    if (t.key.includes('tetanoz')) {
        return `- "${t.name}": Look for Tetanus/Tetanoz vaccination status. If found with a date or positive word ("Yapıldı", "Var", "+"), return "Tetanoz aşısı yapılmıştır". If explicitly negative or missing, return "Aşı Kaydı Yok".`;
    }
    
    if (t.key.includes('kan_grubu')) {
        return `- "${t.name}": Extract the FULL Blood Type string. Look for A, B, AB, or 0 (Zero) combined with Rh factors like "+", "-", "Rh+", "Rh-", "Pozitif", "Negatif". 
        Examples: "A Rh+", "0 Rh+", "B (-)", "AB Pozitif". 
        CRITICAL: Do not return just "0" or just "A". You MUST include the Rh/Sign part.`;
    }

    if (t.key.includes('goz')) {
        return `- "${t.name}": Analyze the Eye Examination / Göz Muayenesi section carefully.
        Extract and combine these specific details using " | " (pipe) as separator:
        1. Color Blindness: If "Renk körlüğü yoktur" -> "Renk Körlüğü Yok". If "Renk körlüğü vardır" -> "Renk Körlüğü Var".
        2. Night Work: If "Gece çalışabilir" -> "Gece Çalışabilir". If "Gece çalışamaz" -> "Gece Çalışamaz".
        3. Glasses/Lens: If "Gözlük" or "Lens" mentioned -> "Gözlük/Lens Kullanıyor".
        4. Visual Acuity: e.g. "Sağ Tam Sol Tam".
        Example Output: "Renk Körlüğü Yok | Gece Çalışabilir | Her iki göz tam"`;
    }

    // --- STANDARDIZATION LOGIC (EKG, ODYOMETRI, AKCIGER, SFT) ---
    if (t.key.includes('ekg')) {
        return `- "${t.name}": Analyze the ECG/EKG result.
        STANDARDIZATION RULE:
        - If the result implies normal limits (e.g., "Normal", "NSR", "Normal Sinus", "Özellik yok"), return EXACTLY: "Normal Sinüs Ritmi".
        - If there is a specific pathology (e.g., "Taşikardi", "Bradikardi", "Iskemi", "Aritmi"), return that specific text.`;
    }

    if (t.key.includes('odyometri') || t.key.includes('odyo')) {
        return `- "${t.name}": Analyze Audiometry/Hearing test.
        STANDARDIZATION RULE:
        - If the result implies normal hearing (e.g., "Normal", "Normoacusis", "Kayıp yok", "Normal Sınırlarda"), return EXACTLY: "Bilateral İşitme Normal".
        - If there is hearing loss (e.g., "Sensörinöral kayıp", "İletim tipi", "Hafif kayıp"), return the detailed finding.`;
    }

    if (t.key.includes('akciger') || t.key.includes('thorax') || t.key.includes('pa_')) {
        return `- "${t.name}": Analyze Chest X-Ray/Akciğer Grafisi.
        STANDARDIZATION RULE:
        - If the result implies normal lungs (e.g., "Normal", "Aktif lezyon yok", "Normal sinüsler", "Normal Sınırlarda"), return EXACTLY: "Normal PA Akciğer Grafisi".
        - If there is a pathology (e.g., "İnfiltrasyon", "Nodül", "Kalsifikasyon", "Kalp büyük"), return the detailed finding.`;
    }

    if (t.key.includes('servikal')) {
        return `- "${t.name}": Analyze Cervical X-Ray/Servikal Grafi.
        STANDARDIZATION RULE:
        - If the result implies normal vertebrae (e.g., "Normal", "Tabii", "Doğaldır", "Patoloji izlenmedi", "Normal Sınırlarda"), return EXACTLY: "Normal Servikal Vertebra Grafisi".
        - If there is a pathology (e.g., "Skolyoz", "Lordoz", "Deformite", "Dejeneratif", "Herniasyon"), return the detailed finding.`;
    }

    if (t.key.includes('lumbosakral') || t.key.includes('lumbar') || t.key.includes('lomber')) {
        return `- "${t.name}": Analyze Lumbosacral X-Ray/Lumbosakral Grafi.
        STANDARDIZATION RULE:
        - If the result implies normal vertebrae (e.g., "Normal", "Tabii", "Doğaldır", "Patoloji izlenmedi", "Normal Sınırlarda"), return EXACTLY: "Normal Lumbosakral Vertebra Grafisi".
        - If there is a pathology (e.g., "Skolyoz", "Lordoz", "Deformite", "Kompresyon", "Dejeneratif"), return the detailed finding.`;
    }

    if (t.key.includes('ek_2')) {
        return `- "${t.name}": Analyze Ek-2 Belgesi (Ek-2 Document).
        STANDARDIZATION RULE:
        - This document is not yet supported for automated extraction. Return "Belge taranacak".`;
    }

    if (t.key.includes('sft') || t.key.includes('solunum')) {
        return `- "${t.name}": Analyze the Pulmonary Function Test (SFT/Spirometry) section.
        Look for the 'Yorum', 'Sonuç', 'Tıbbi Rapor' or 'Değerlendirme' lines.
        - If it says "Normal Spirometri", "Normal", "Kabul edilebilir" or shows normal curve, return "Normal Spirometri".
        - If there is a pathology (e.g., "Obstrüktif", "Restriktif", "Küçük hava yolu"), extract that summary text.`;
    }

    if (t.key.includes('pnomokonyoz')) {
        return `- "${t.name}": This is an ILO Pneumoconiosis X-Ray reading report.
        Look for section "4D. DİĞER YORUMLAR" (Other Comments) at the bottom of the report.
        Extract the text written under that section — it typically says something like "Pnömokonyoz açısından normal sınırlarda akciğer grafisi" or describes findings.
        Return the full text found in that section.`;
    }

    // Specific logic for Hepatitis Card Tests
    if (t.key.includes('_kart')) {
        const baseName = t.key.replace('_kart', '').replace('_', ' ').toUpperCase();
        return `- "${t.name}" (ID: ${t.id}): Look for the line containing "${baseName}" AND keywords like "Kart", "Kaset", "Doğrulama". Return ONLY text: "NEGATİF" or "POZİTİF". Ignore numeric values on this line.`;
    }

    // Specific logic for Hepatitis Quantitative Tests
    if (t.key === 'hbsag_val' || t.key === 'anti_hbs_val' || t.key === 'anti_hcv_val' || t.key === 'anti_hiv_val') {
        const baseName = t.name.replace(' (Kantitatif)', '');
        return `- "${t.name}" (ID: ${t.id}): Look for "${baseName}" where the result is a NUMBER (e.g. 0.45, 120.5). Ignore lines saying "Kart Test". extract the numeric value.`;
    }

    // --- SPOT KREATININ & ORAN LOGIC (NEW) ---
    if (t.key.includes('kreatinin_spot')) {
        return `- "${t.name}": Look specifically for "Kreatinin (Spot İdrar)", "Spot İdrar Kreatinin" or "Kreatinin" found in a URINE/IDRAR section. Do NOT confuse with Serum Creatinine. Extract the numeric result (e.g. 113.5).`;
    }
    if (t.key.includes('mukonik_asit_oran') || t.key.includes('fenol_oran')) {
        return `- "${t.name}": Look for ratio lines like "muk.asit/İdr Krea Oranı", "Fenol/İdr Krea" or "Oran". Extract the numeric value (e.g. 0.18, 2.75).`;
    }

    // --- HEAVY METALS & CHEMICALS LOGIC ---
    if (t.key.includes('krom') || t.key.includes('kadmiyum') || t.key.includes('manganez') || t.key.includes('fenol') || t.key.includes('civa') || t.key.includes('kursun')) {
        return `- "${t.name}": Look for the name. Ignore '(*)' prefix. Extract the numeric result (e.g. 1.52, 2.91, 3.70).`;
    }

    if (t.key.includes('hidroksipiren') || t.key.includes('benzen') || t.key.includes('kresol')) {
        return `- "${t.name}": Look for "${t.name}". Ignore '(*)' prefix. 
        Important: The result might be text "NEGATİF" or a number. 
        - If it is "NEGATİF", return exactly "NEGATİF". 
        - If it is a number, return the number.`;
    }

    // --- PORTEUR / MIKROBIYOLOJI LOGIC ---
    if (t.key.includes('kulturu') || t.key.includes('gaita_mikroskopi')) {
        return `- "${t.name}": This is a Microbiology result. 
        Read the sentence describing the growth. 
        1. If it says "Üremedi", "Normal Flora", "Patojen bakteri görülmedi", "Kist görülmedi", "Parazit görülmedi" -> Return "Normal" or "Üreme Yok".
        2. If a specific bacteria/parasite name is found (e.g. "Salmonella", "Shigella", "Entamoeba") -> Return "Pozitif: [Organism Name]".
        Keep it concise.`;
    }

    // --- TAM IDRAR TAHLILI (TIT) LOGIC ---
    if (t.key.includes('tit_') || t.key.includes('tam_idrar')) {
        if (t.key.includes('mikroskopi')) {
             return `- "${t.name}": Look for "Mikroskopi" or "İdrar Mikroskopisi". Extract content like "Lökosit Nadir", "Her sahada...", "Eritrosit..." or "Özellik yok".`;
        }
        // Specific instruction for +, ++, +++, Pozitif
        return `- "${t.name}": This is a Urinalysis parameter. 
        EXTRACT EXACT TEXT found. 
        - Look for symbols like "++", "+++", "+", "++++". 
        - Look for words "Pozitif", "Negatif", "Normal", "Eser".
        - Example: If it says "Glukoz ... ++", extract "++".
        - Example: If it says "Lökosit ... +++ Pozitif", extract "+++ Pozitif".
        - Do NOT convert symbols to numbers.`;
    }

    const typeInstruction = t.type === 'numeric' 
      ? `[TARGET: NUMERIC] Look for the Patient Result column. It is usually the first number to the right of the test name.` 
      : `[TARGET: SHORT TEXT] Extract summary (e.g., 'Normal', 'Negatif', 'Pathology detected').`;
    
    // Add fuzzy matching hint
    return `- "${t.name}" (Aliases: ${t.key}, Unit: ${t.unit}) -> ${typeInstruction}`;
  };

  const flatTestDescriptions: string[] = [];
  
  tests.forEach(t => {
    if (t.subTests && t.subTests.length > 0) {
      t.subTests.forEach(sub => {
        flatTestDescriptions.push(generateDescription(sub));
      });
    } else {
      flatTestDescriptions.push(generateDescription(t));
    }
  });

  const targetTestsDescription = flatTestDescriptions.join('\n');

  const systemInstruction = `
    You are an advanced Medical Data Extraction AI. 
    Your goal is to parse raw text from PDF medical reports (OCR output) and extract specific test results into structured JSON.

    ### EXTRACTION RULES (STRICT):

    1. **ROW-BASED SCANNING:** 
       - Find the line (or adjacent lines) containing the Test Name.
       - Scan to the right to find the RESULT value.
       - The **Result** is almost always BEFORE the Unit and BEFORE the Reference Range.

    2. **NUMERIC vs REFERENCE RANGE (CRITICAL):**
       - Do NOT extract the Reference Range. 
       - Reference ranges usually look like: "10-20", "(0-5)", "< 0.5", "> 100".
       - The Patient Result is a single number (e.g., "15.4", "0.2").
       - If you see "15.4  (10-20)", extract "15.4".
       - If you see "WBC .... 8.5 .... 4.0-10.0", extract "8.5".

    3. **OCR NOISE CORRECTION:**
       - If a number has spaces (e.g., "1 4 . 5"), merge it to "14.5".
       - If a number uses a comma as decimal (e.g., "14,5"), treat it as "14.5".
    
    4. **HEPATITIS / SEROLOGY HANDLING:**
       - Strict separation is required.
       - If I ask for "Kart Test" (Card Test), look for text results like "NEGATİF" / "POZİTİF".
       - If I ask for standard/quantitative tests, look for NUMERIC values (e.g. "0.35 S/CO").
       - Do not mix them up.

    5. **METADATA:**
       - **Patient Name:** Look for "Sayın:", "Adı Soyadı:", "Hasta:". Format: Title Case (e.g. "Ahmet Yilmaz").
       - **Registration Number (Sicil No):** Look for "Sicil No", "Sicil", "Protokol No", "Dosya No", "T.C. No", "ID". Extract the value associated with it. If not found, return empty string.
       - **Job Title (Görevi):** Look for "Görevi:", "Bölümü:", "Unvanı:", "Mesleği:", "Pozisyon:". Extract the text (e.g., "Kaynakçı", "Şoför", "İdari Personel"). If not found, return empty string.
       - **Date:** Look for "Tarih:", "Numune:", "Onay:". Format: DD.MM.YYYY.
  `;

  const prompt = `
    ### TARGET TESTS
    Extract results ONLY for the following list. If a test is not in the text, omit it or return null value.
    ${targetTestsDescription}

    ### INPUT TEXT
    """
    ${processedText}
    """
    
    Return ONLY valid JSON matching the schema.
  `;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      patientName: { type: Type.STRING },
      registrationNumber: { type: Type.STRING },
      jobTitle: { type: Type.STRING },
      date: { type: Type.STRING },
      extractedResults: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            testName: { type: Type.STRING, description: "Exact name of the test from my target list" },
            value: { type: Type.STRING, description: "The extracted result (Clean number string or Text)" }, 
            unit: { type: Type.STRING, description: "Unit found (optional)" }
          }
        }
      }
    }
  };

  // Retry Loop
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: aiConfigService.getModel('extraction'),
        contents: prompt,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          temperature: 0.1, // Low temperature for high precision
        }
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("No response from AI");
      
      const parsed = JSON.parse(jsonText);
      
      if (parsed.extractedResults) {
        parsed.extractedResults = parsed.extractedResults.map((res: ExtractedResult) => {
          let cleanVal = res.value;

          if (typeof cleanVal === 'string') {
             cleanVal = cleanVal.trim();
             // Handle standard number cleanup
             if (/^\d+,\d+$/.test(cleanVal)) {
               cleanVal = cleanVal.replace(',', '.');
             }
             if (cleanVal.endsWith('.')) {
               cleanVal = cleanVal.slice(0, -1);
             }
          }

          const isNumeric = !isNaN(parseFloat(String(cleanVal))) && isFinite(Number(cleanVal));

          const allDefs = flattenTests(tests);

          const def = allDefs.find(t => t.name === res.testName) || allDefs.find(t => normalizeTr(res.testName).includes(normalizeTr(t.name)));
          
          // Special logic for tests that can be "NEGATİF" but are technically numeric/mixed
          if (typeof cleanVal === 'string' && includesTr(cleanVal, 'negatif')) {
              return { ...res, value: "NEGATİF", testName: def ? def.name : res.testName };
          }

          const shouldBeNumeric = def ? def.type === 'numeric' : true;

          if (isNumeric && shouldBeNumeric) {
            return { ...res, value: parseFloat(String(cleanVal)), testName: def ? def.name : res.testName };
          }
          
          return { ...res, value: cleanVal, testName: def ? def.name : res.testName };
        });
      }

      // ExtractionReport formatına çevir
      const flatTests = flattenTests(tests);
      const foundTests = (parsed.extractedResults || []).map((r: ExtractedResult) => r.testName);
      const missingTests = flatTests.filter(t => !foundTests.includes(t.name)).map(t => t.name);

      return {
        ...parsed,
        foundTests,
        missingTests,
        totalTests: flatTests.length,
        foundCount: (parsed.extractedResults || []).length
      };

    } catch (error) {
      console.warn(`AI Attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        throw error; // Throw on final failure
      }
      // 429 rate limit için API'nin söylediği süre kadar bekle
      if (isRateLimitError(error)) {
        const waitMs = extractRetryDelay(error);
        console.warn(`Rate limit hit, waiting ${waitMs}ms before retry...`);
        await delay(waitMs);
      } else {
        await delay(1000 * Math.pow(2, attempt - 1));
      }
    }
  }

  throw new Error("AI Service unavailable after retries");
};

// --- 2. AI DOCTOR ASSISTANT (GEMINI) ---
const generateMedicalSummaryGemini = async (record: PatientRecord): Promise<string> => {
    const ai = await getAiClient();

    // Prepare context for AI
    const abnormalResults: string[] = [];
    const normalResults: string[] = [];

    Object.entries(record.status).forEach(([testId, status]) => {
        const res = record.results[testId];
        if(!res) return;

        if (status === ResultStatus.HIGH) abnormalResults.push(`${res.testName}: YÜKSEK (${res.value})`);
        else if (status === ResultStatus.LOW) abnormalResults.push(`${res.testName}: DÜŞÜK (${res.value})`);
        else if (status === ResultStatus.UNKNOWN && typeof res.value === 'string' && (includesTr(res.value, 'pozitif') || includesTr(res.value, 'var') || includesTr(res.value, 'patoloji'))) {
            abnormalResults.push(`${res.testName}: ${res.value}`);
        } else {
            normalResults.push(res.testName);
        }
    });

    const jobContext = record.jobTitle ? `Hastanın Görevi: ${record.jobTitle}.` : '';
    
    const prompt = `
        Sen uzman bir İşyeri Hekimisin. Aşağıdaki sağlık taraması sonuçlarını değerlendirerek kısa, net ve profesyonel bir tıbbi kanaat notu yaz.

        ${jobContext}
        
        ANORMAL BULGULAR:
        ${abnormalResults.length > 0 ? abnormalResults.join('\n') : "Yok (Tüm değerler referans aralığında)"}

        NORMAL OLAN ÖNEMLİ TESTLER:
        ${normalResults.slice(0, 5).join(', ')}...

        YÖNERGELER:
        1. Dil: Türkçe.
        2. Format: Tek bir paragraf veya 2-3 kısa cümle.
        3. Eğer tüm değerler normalse: "Yapılan tetkiklerde patolojik bir bulguya rastlanmamıştır. Periyodik muayene açısından uygundur." yaz.
        4. Eğer anormal değerler varsa: 
           - Önemli olanları belirt (örn: "Lökositoz ve sedimantasyon yüksekliği mevcut").
           - Olası klinik anlamı kısaca belirt (örn: "Enfeksiyon lehine değerlendirilebilir").
           - Öneri ekle (örn: "Dahiliye poliklinik kontrolü önerilir" veya "İşe girişinde tıbbi açıdan sakınca yoktur ancak takip edilmelidir").
        5. Ton: Resmi ve tıbbi.
    `;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: aiConfigService.getModel('comment'),
                contents: prompt,
                config: {
                    maxOutputTokens: 200,
                    temperature: 0.4
                }
            });
            return response.text?.trim() || "Yorum oluşturulamadı.";
        } catch (e) {
            if (attempt === 3) {
                console.error("Auto-comment error", e);
                return "Otomatik yorum servisi şu an kullanılamıyor.";
            }
            if (isRateLimitError(e)) {
                const waitMs = extractRetryDelay(e);
                console.warn(`Auto-comment rate limited, waiting ${waitMs}ms...`);
                await delay(waitMs);
            } else {
                await delay(1000 * Math.pow(2, attempt - 1));
            }
        }
    }
    return "Otomatik yorum servisi şu an kullanılamıyor.";
};

// ═══════════════════════════════════════════════════════════════════════════
//  PROVIDER ROUTER — Gemini veya Yerel Sistem
// ═══════════════════════════════════════════════════════════════════════════

export const analyzeMedicalText = async (
  text: string,
  tests: TestDefinition[],
  retries = 5,
  forceLocal = false
): Promise<ExtractionReport> => {
  const provider = aiConfigService.getProvider();
  if (provider === 'local' || forceLocal) {
    return Promise.resolve(analyzeMedicalTextLocal(text, tests));
  }
  if (provider === 'openrouter') {
    return analyzeMedicalTextOpenRouter(text, tests, retries);
  }
  return analyzeMedicalTextGemini(text, tests, retries);
};

export const generateMedicalSummary = async (record: PatientRecord): Promise<string> => {
  const provider = aiConfigService.getProvider();
  if (provider === 'local') {
    return Promise.resolve(generateMedicalSummaryLocal(record));
  }
  if (provider === 'openrouter') {
    return generateMedicalSummaryOpenRouter(record);
  }
  return generateMedicalSummaryGemini(record);
};

