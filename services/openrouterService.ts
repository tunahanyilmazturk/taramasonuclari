// OpenRouter API servisi — OpenAI-uyumlu endpoint üzerinden GLM-5.2 ve diğer modeller
// Ücretsiz modeller: z-ai/glm-5.2:free, z-ai/glm-4.7-flash:free, z-ai/glm-4.5-flash:free
// API dökümantasyonu: https://openrouter.ai/docs
import { TestDefinition, PatientRecord, ResultStatus, ExtractedResult, ExtractionReport } from "../types";
import { flattenTests, includesTr, normalizeTr } from "../utils/lab";
import { aiConfigService } from "./aiConfigService";

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRateLimitError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const e = error as Record<string, unknown>;
    const status = e.status as number | undefined;
    const message = (e.message as string | undefined) || '';
    return status === 429 || message.includes('429') || message.includes('rate limit') || message.includes('quota');
};

const getHeaders = (): Record<string, string> => {
    const apiKey = aiConfigService.getOpenRouterKey();
    if (!apiKey) throw new Error('OpenRouter API anahtarı tanımlı değil. Ayarlar → AI & API bölümünden OpenRouter anahtarınızı girin.');
    return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Sonuç Okuma Sistemi'
    };
};

// OpenRouter'a OpenAI-uyumlu chat completion isteği
const chatCompletion = async (
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    options: { temperature?: number; maxTokens?: number; responseFormat?: 'json_object' | 'text' } = {}
): Promise<string> => {
    const model = aiConfigService.getOpenRouterModel();
    const headers = getHeaders();

    const body: Record<string, unknown> = {
        model,
        messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 4096
    };
    if (options.responseFormat === 'json_object') {
        body.response_format = { type: 'json_object' };
    }

    const response = await fetch(OPENROUTER_BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        const error = new Error(`OpenRouter API hatası (${response.status}): ${errText.slice(0, 200)}`);
        (error as unknown as Record<string, unknown>).status = response.status;
        throw error;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenRouter\'dan boş yanıt alındı');
    return content as string;
};

// --- BAĞLANTI TESTİ ---
export const testOpenRouterConnection = async (): Promise<string> => {
    const reply = await chatCompletion(
        [{ role: 'user', content: 'Sadece "OK" yaz.' }],
        { temperature: 0, maxTokens: 16 }
    );
    return reply.trim() || 'Boş yanıt alındı';
};

// --- SMART TEXT PRE-PROCESSING (Gemini ile aynı) ---
const filterRelevantContext = (fullText: string, tests: TestDefinition[]): string => {
    if (fullText.length < 50000) return fullText;

    const lines = fullText.split('\n');
    const relevantIndices = new Set<number>();

    const keywords: string[] = [];
    const addKeywords = (def: TestDefinition) => {
        keywords.push(normalizeTr(def.name));
        keywords.push(normalizeTr(def.key.replace(/_/g, ' ')));
        if (def.subTests) def.subTests.forEach(addKeywords);
    };
    tests.forEach(addKeywords);

    lines.forEach((line, idx) => {
        const lowerLine = normalizeTr(line);
        if (includesTr(line, 'tarih') || includesTr(line, 'sayın') || includesTr(line, 'hasta') || includesTr(line, 'protokol')) {
            relevantIndices.add(idx);
            return;
        }
        if (keywords.some(k => lowerLine.includes(k))) {
            if (idx > 0) relevantIndices.add(idx - 1);
            relevantIndices.add(idx);
            if (idx < lines.length - 1) relevantIndices.add(idx + 1);
            if (idx < lines.length - 2) relevantIndices.add(idx + 2);
        }
    });

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

// --- 1. PDF SONUÇ ÇIKARMA ---
export const analyzeMedicalTextOpenRouter = async (
    text: string,
    tests: TestDefinition[],
    retries = 5
): Promise<ExtractionReport> => {
    const processedText = filterRelevantContext(text, tests);

    const generateDescription = (t: TestDefinition): string => {
        if (t.key.includes('tetanoz')) {
            return `- "${t.name}": Look for Tetanus/Tetanoz vaccination status. If found with a date or positive word ("Yapıldı", "Var", "+"), return "Tetanoz aşısı yapılmıştır". If explicitly negative or missing, return "Aşı Kaydı Yok".`;
        }
        if (t.key.includes('kan_grubu')) {
            return `- "${t.name}": Extract the FULL Blood Type string. Look for A, B, AB, or 0 (Zero) combined with Rh factors like "+", "-", "Rh+", "Rh-", "Pozitif", "Negatif". Examples: "A Rh+", "0 Rh+", "B (-)", "AB Pozitif". CRITICAL: You MUST include the Rh/Sign part.`;
        }
        if (t.key.includes('goz')) {
            return `- "${t.name}": Analyze the Eye Examination / Göz Muayenesi section. Extract and combine these details using " | " separator: 1. Color Blindness 2. Night Work 3. Glasses/Lens 4. Visual Acuity. Example: "Renk Körlüğü Yok | Gece Çalışabilir | Her iki göz tam"`;
        }
        if (t.key.includes('ekg')) {
            return `- "${t.name}": Analyze ECG/EKG. If normal (NSR, "Normal"), return "Normal Sinüs Ritmi". If pathology, return that text.`;
        }
        if (t.key.includes('odyometri') || t.key.includes('odyo')) {
            return `- "${t.name}": Analyze Audiometry. If normal, return "Bilateral İşitme Normal". If loss, return detailed finding.`;
        }
        if (t.key.includes('akciger') || t.key.includes('thorax') || t.key.includes('pa_')) {
            return `- "${t.name}": Analyze Chest X-Ray. If normal, return "Normal PA Akciğer Grafisi". If pathology, return detailed finding.`;
        }
        if (t.key.includes('servikal')) {
            return `- "${t.name}": Analyze Cervical X-Ray. If normal, return "Normal Servikal Vertebra Grafisi". If pathology, return detailed finding.`;
        }
        if (t.key.includes('lumbosakral') || t.key.includes('lumbar') || t.key.includes('lomber')) {
            return `- "${t.name}": Analyze Lumbosacral X-Ray. If normal, return "Normal Lumbosakral Vertebra Grafisi". If pathology, return detailed finding.`;
        }
        if (t.key.includes('ek_2')) {
            return `- "${t.name}": Analyze Ek-2 İşe Giriş/Periyodik Muayene Formu. Find the "KANAAT VE SONUÇ" section. Return ONLY the conclusion sentence (e.g., "KALİTE KONTROL işinde bedenen ve ruhen çalışmaya elverişlidir").`;
        }
        if (t.key.includes('sft') || t.key.includes('solunum')) {
            return `- "${t.name}": Analyze SFT/Spirometry. If normal, return "Normal Spirometri". If pathology, return summary.`;
        }
        if (t.key.includes('pnomokonyoz')) {
            return `- "${t.name}": ILO Pneumoconiosis report. Extract text under "4D. DİĞER YORUMLAR" section.`;
        }
        if (t.key.includes('_kart')) {
            const baseName = t.key.replace('_kart', '').replace('_', ' ').toUpperCase();
            return `- "${t.name}" (ID: ${t.id}): Look for line with "${baseName}" AND "Kart"/"Kaset". Return ONLY "NEGATİF" or "POZİTİF".`;
        }
        if (t.key === 'hbsag_val' || t.key === 'anti_hbs_val' || t.key === 'anti_hcv_val' || t.key === 'anti_hiv_val') {
            const baseName = t.name.replace(' (Kantitatif)', '');
            return `- "${t.name}" (ID: ${t.id}): Look for "${baseName}" where result is a NUMBER. Ignore "Kart Test". Extract numeric value.`;
        }
        if (t.key.includes('kreatinin_spot')) {
            return `- "${t.name}": Look for "Kreatinin (Spot İdrar)" in URINE section. Extract numeric result.`;
        }
        if (t.key.includes('mukonik_asit_oran') || t.key.includes('fenol_oran')) {
            return `- "${t.name}": Look for ratio lines. Extract numeric value.`;
        }
        if (t.key.includes('krom') || t.key.includes('kadmiyum') || t.key.includes('manganez') || t.key.includes('fenol') || t.key.includes('civa') || t.key.includes('kursun')) {
            return `- "${t.name}": Look for the name. Ignore '(*)'. Extract numeric result.`;
        }
        if (t.key.includes('hidroksipiren') || t.key.includes('benzen') || t.key.includes('kresol')) {
            return `- "${t.name}": Look for "${t.name}". If "NEGATİF", return "NEGATİF". If number, return number.`;
        }
        if (t.key.includes('kulturu') || t.key.includes('gaita_mikroskopi')) {
            return `- "${t.name}": Microbiology result. If "Üremedi"/"Normal Flora" → "Normal" or "Üreme Yok". If bacteria found → "Pozitif: [Name]".`;
        }
        if (t.key.includes('tit_') || t.key.includes('tam_idrar')) {
            if (t.key.includes('mikroskopi')) {
                return `- "${t.name}": Look for "Mikroskopi". Extract content like "Lökosit Nadir", "Eritrosit..." or "Özellik yok".`;
            }
            return `- "${t.name}": Urinalysis. Extract EXACT text: "++", "+++", "+", "Pozitif", "Negatif", "Normal", "Eser". Do NOT convert to numbers.`;
        }
        const typeInstruction = t.type === 'numeric'
            ? `[TARGET: NUMERIC] Look for Patient Result column — first number to the right of test name.`
            : `[TARGET: SHORT TEXT] Extract summary ('Normal', 'Negatif', 'Pathology detected').`;
        return `- "${t.name}" (Aliases: ${t.key}, Unit: ${t.unit}) -> ${typeInstruction}`;
    };

    const flatTestDescriptions: string[] = [];
    tests.forEach(t => {
        if (t.subTests && t.subTests.length > 0) {
            t.subTests.forEach(sub => flatTestDescriptions.push(generateDescription(sub)));
        } else {
            flatTestDescriptions.push(generateDescription(t));
        }
    });
    const targetTestsDescription = flatTestDescriptions.join('\n');

    const systemInstruction = `You are an advanced Medical Data Extraction AI. Your goal is to parse raw text from PDF medical reports (OCR output) and extract specific test results into structured JSON.

### EXTRACTION RULES (STRICT):
1. ROW-BASED SCANNING: Find the line containing the Test Name. Scan right for the RESULT value (before Unit and Reference Range).
2. NUMERIC vs REFERENCE RANGE: Do NOT extract Reference Range (e.g. "10-20", "(0-5)"). Extract the single Patient Result number (e.g. "15.4").
3. OCR NOISE CORRECTION: Merge spaced numbers ("1 4 . 5" → "14.5"). Treat comma decimal ("14,5" → "14.5").
4. HEPATITIS/SEROLOGY: "Kart Test" → "NEGATİF"/"POZİTİF". Quantitative → numeric value.
5. METADATA: Patient Name ("Sayın:", "Adı Soyadı:"), Registration Number ("Sicil No", "Protokol No"), Job Title ("Görevi:"), Date (DD.MM.YYYY).

Return ONLY valid JSON with this schema:
{
  "patientName": "string",
  "registrationNumber": "string",
  "jobTitle": "string",
  "date": "string",
  "extractedResults": [
    { "testName": "exact test name from target list", "value": "extracted result", "unit": "unit if found (optional)" }
  ]
}`;

    const userPrompt = `### TARGET TESTS
Extract results ONLY for the following list. If a test is not in the text, omit it.
${targetTestsDescription}

### INPUT TEXT
"""
${processedText}
"""

Return ONLY valid JSON.`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const raw = await chatCompletion(
                [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: userPrompt }
                ],
                { temperature: 0.1, maxTokens: 8192, responseFormat: 'json_object' }
            );

            const parsed = JSON.parse(raw);

            if (parsed.extractedResults) {
                parsed.extractedResults = parsed.extractedResults.map((res: ExtractedResult) => {
                    let cleanVal = res.value;
                    if (typeof cleanVal === 'string') {
                        cleanVal = cleanVal.trim();
                        if (/^\d+,\d+$/.test(cleanVal)) cleanVal = cleanVal.replace(',', '.');
                        if (cleanVal.endsWith('.')) cleanVal = cleanVal.slice(0, -1);
                    }
                    const isNumeric = !isNaN(parseFloat(String(cleanVal))) && isFinite(Number(cleanVal));
                    const allDefs = flattenTests(tests);
                    const def = allDefs.find(t => t.name === res.testName) || allDefs.find(t => normalizeTr(res.testName).includes(normalizeTr(t.name)));
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
            console.warn(`OpenRouter attempt ${attempt} failed:`, error);
            if (attempt === retries) throw error;
            if (isRateLimitError(error)) {
                await delay(60000);
            } else {
                await delay(1000 * Math.pow(2, attempt - 1));
            }
        }
    }
    throw new Error('OpenRouter AI Service unavailable after retries');
};

// --- 2. AI DOCTOR ASSISTANT (KANAAT) ---
export const generateMedicalSummaryOpenRouter = async (record: PatientRecord): Promise<string> => {
    const abnormalResults: string[] = [];
    const normalResults: string[] = [];

    Object.entries(record.status).forEach(([testId, status]) => {
        const res = record.results[testId];
        if (!res) return;
        if (status === ResultStatus.HIGH) abnormalResults.push(`${res.testName}: YÜKSEK (${res.value})`);
        else if (status === ResultStatus.LOW) abnormalResults.push(`${res.testName}: DÜŞÜK (${res.value})`);
        else if (status === ResultStatus.UNKNOWN && typeof res.value === 'string' && (includesTr(res.value, 'pozitif') || includesTr(res.value, 'var') || includesTr(res.value, 'patoloji'))) {
            abnormalResults.push(`${res.testName}: ${res.value}`);
        } else {
            normalResults.push(res.testName);
        }
    });

    const jobContext = record.jobTitle ? `Hastanın Görevi: ${record.jobTitle}.` : '';

    const prompt = `Sen uzman bir İşyeri Hekimisin. Aşağıdaki sağlık taraması sonuçlarını değerlendirerek kısa, net ve profesyonel bir tıbbi kanaat notu yaz.

${jobContext}

ANORMAL BULGULAR:
${abnormalResults.length > 0 ? abnormalResults.join('\n') : "Yok (Tüm değerler referans aralığında)"}

NORMAL OLAN ÖNEMLİ TESTLER:
${normalResults.slice(0, 5).join(', ')}...

YÖNERGELER:
1. Dil: Türkçe.
2. Format: Tek bir paragraf veya 2-3 kısa cümle.
3. Eğer tüm değerler normalse: "Yapılan tetkiklerde patolojik bir bulguya rastlanmamıştır. Periyodik muayene açısından uygundur." yaz.
4. Eğer anormal değerler varsa: Önemli olanları belirt, olası klinik anlamı kısaca belirt, öneri ekle.
5. Ton: Resmi ve tıbbi.`;

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const reply = await chatCompletion(
                [{ role: 'user', content: prompt }],
                { temperature: 0.4, maxTokens: 300 }
            );
            return reply.trim() || 'Yorum oluşturulamadı.';
        } catch (e) {
            if (attempt === 3) {
                console.error('OpenRouter auto-comment error', e);
                return 'Otomatik yorum servisi şu an kullanılamıyor.';
            }
            if (isRateLimitError(e)) {
                await delay(60000);
            } else {
                await delay(1000 * Math.pow(2, attempt - 1));
            }
        }
    }
    return 'Otomatik yorum servisi şu an kullanılamıyor.';
};
