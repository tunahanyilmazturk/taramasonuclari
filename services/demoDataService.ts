
import { Company, PatientRecord, TestDefinition, ResultStatus, ExtractedResult, AppState } from '../types';
import { DEFAULT_TESTS } from '../constants';
import { MOCK_COMPANIES, MOCK_RECORDS, MOCK_TEAM, MOCK_EQUIPMENT, MOCK_QUOTES, MOCK_SCREENINGS, MOCK_CALENDAR_EVENTS } from './mockData';

const JOBS = {
  WELDING: ['Kaynakçı', 'Montaj Elemanı', 'Pres Operatörü'],
  LOGISTICS: ['Forklift Operatörü', 'Şoför', 'Depo Sorumlusu'],
  OFFICE: ['İdari Personel', 'Muhasebe', 'Yazılım Uzmanı']
};

const NAMES = [
  "Ahmet Yılmaz", "Mehmet Demir", "Ayşe Kaya", "Fatma Çelik", "Mustafa Şahin", 
  "Emine Yıldız", "Ali Öztürk", "Zeynep Arslan", "Hüseyin Doğan", "Hatice Aydın",
  "İbrahim Koç", "Elif Kurt", "Hasan Özkan", "Hacer Polat", "Osman Çetin",
  "Sevgi Aslan", "Murat Kara", "Sultan Yavuz", "Yusuf Bilgin", "Hanife Tekin"
];

const generateRandomValue = (min: number, max: number, decimals: number = 1) => {
  const val = Math.random() * (max - min) + min;
  return Number(val.toFixed(decimals));
};

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Helper to safely find test
const findTest = (key: string, list: TestDefinition[]) => list.find(t => t.key === key);

export const generateDemoData = (): AppState => {
  const masterTests = DEFAULT_TESTS; // Use the standard test pool

  // Helper to get tests safely
  const getSafeTests = (keys: string[]) => {
      return keys.map(k => findTest(k, masterTests)).filter(t => t !== undefined) as TestDefinition[];
  };

  // --- COMPANY 1: ANADOLU METAL SANAYİ (Heavy Industry) ---
  const company1: Company = {
    id: 'demo_comp_1',
    name: 'Anadolu Metal Sanayi A.Ş.',
    sector: 'Metal İşleme',
    hazardClass: 'cok_tehlikeli',
    employeeCount: 148,
    contactPerson: 'Murat Kaya (İK Müdürü)',
    phone: '0(312) 555 12 34',
    email: 'ik@anadolumetal.com.tr',
    address: 'OSB 12. Cadde No:8, Sincan / Ankara',
    notes: 'Ağır metal maruziyeti var — krom/kadmiyum testleri zorunlu.',
    reportSettings: {
        title: 'PERİYODİK SAĞLIK MUAYENESİ',
        doctorName: 'Dr. Selim Güçlü',
        doctorTitle: 'İşyeri Hekimi',
        labTechName: 'Ayşe Laborant',
        labTechTitle: 'Laboratuvar Sorumlusu'
    },
    tests: getSafeTests(['hemogram', 'odyometri', 'akciger_grafisi', 'tetanoz', 'alt', 'ast'])
  };

  // --- COMPANY 2: TECHLOJİSTİK GLOBAL (Logistics & Office) ---
  const company2: Company = {
    id: 'demo_comp_2',
    name: 'TechLojistik Global Ltd.',
    sector: 'Lojistik & Depolama',
    hazardClass: 'tehlikeli',
    employeeCount: 62,
    contactPerson: 'Elif Demirtaş (Operasyon)',
    phone: '0(216) 444 78 90',
    email: 'operasyon@techlojistik.com',
    address: 'İstanbul Deri OSB, Tuzla / İstanbul',
    reportSettings: {
        title: 'İŞE GİRİŞ / PERİYODİK MUAYENE',
        doctorName: 'Dr. Canan Sever',
        doctorTitle: 'İşyeri Hekimi',
        labTechName: 'Mehmet Lab',
        labTechTitle: 'Biyolog'
    },
    tests: getSafeTests(['hemogram', 'goz', 'glikoz', 'kolesterol', 'ekg'])
  };

  const records: PatientRecord[] = [];

  // --- GENERATE RECORDS FOR COMPANY 1 (Metal) ---
  for (let i = 0; i < 12; i++) {
    const job = i < 8 ? getRandomItem(JOBS.WELDING) : getRandomItem(JOBS.OFFICE); // Mostly manual labor
    const isRiskyJob = JOBS.WELDING.includes(job);
    
    // Create Results
    const results: Record<string, ExtractedResult> = {};
    const status: Record<string, ResultStatus> = {};

    // 1. Hemogram (Randomly generate)
    const hemogram = findTest('hemogram', masterTests);
    if (hemogram && hemogram.subTests) {
        hemogram.subTests.forEach(sub => {
            // Introduce some anomalies for 20% of workers
            const hasAnomaly = Math.random() < 0.2;
            let val = generateRandomValue(sub.range?.min || 0, sub.range?.max || 100, 2);
            let stat = ResultStatus.NORMAL;

            if (hasAnomaly && sub.key === 'wbc') { // Infection simulation
                val = generateRandomValue(13, 18, 2); 
                stat = ResultStatus.HIGH;
            }

            results[sub.id] = { testName: sub.name, value: val, unit: sub.unit };
            status[sub.id] = stat;
        });
        // Set panel status
        const hasPanelIssue = Object.values(status).some(s => s === ResultStatus.HIGH || s === ResultStatus.LOW);
        results[hemogram.id] = { testName: hemogram.name, value: hasPanelIssue ? 'Bulgu Var' : 'Normal', unit: 'Panel' };
        status[hemogram.id] = hasPanelIssue ? ResultStatus.HIGH : ResultStatus.NORMAL;
    }

    // 2. Audiometry (High risk for welders)
    const audio = findTest('odyometri', masterTests);
    if (audio) {
        if (isRiskyJob && Math.random() < 0.4) { // 40% chance of hearing loss for welders
            results[audio.id] = { testName: audio.name, value: 'Bilateral yüksek frekans kaybı', unit: 'dB' };
            status[audio.id] = ResultStatus.HIGH;
        } else {
            results[audio.id] = { testName: audio.name, value: 'Normal', unit: 'dB' };
            status[audio.id] = ResultStatus.NORMAL;
        }
    }

    // 3. Lung X-Ray
    const lung = findTest('akciger_grafisi', masterTests);
    if (lung) {
        if (isRiskyJob && Math.random() < 0.2) {
            results[lung.id] = { testName: lung.name, value: 'Sol hiler dolgunluk', unit: 'Sonuç' };
            status[lung.id] = ResultStatus.HIGH;
        } else {
            results[lung.id] = { testName: lung.name, value: 'Normal', unit: 'Sonuç' };
            status[lung.id] = ResultStatus.NORMAL;
        }
    }

    // 4. Tetanus
    const tetanus = findTest('tetanoz', masterTests);
    if (tetanus) {
        results[tetanus.id] = { testName: tetanus.name, value: 'Tetanoz aşısı yapılmıştır', unit: 'Aşı' };
        status[tetanus.id] = ResultStatus.NORMAL;
    }

    records.push({
        id: `demo_rec_1_${i}`,
        companyId: company1.id,
        patientName: NAMES[i],
        registrationNumber: `Sicil-${1000+i}`,
        jobTitle: job,
        date: new Date().toLocaleDateString('tr-TR'),
        fileName: 'demo_report.pdf',
        results,
        status,
        isReviewed: Math.random() > 0.7, // 30% reviewed
        doctorNotes: (audio && isRiskyJob && status[audio.id] === ResultStatus.HIGH) 
            ? "Gürültüye bağlı işitme kaybı şüphesi. KBB poliklinik sevki uygundur. Kulak koruyucu kullanımı hatırlatıldı." 
            : ""
    });
  }

  // --- GENERATE RECORDS FOR COMPANY 2 (Logistics/Office) ---
  for (let i = 12; i < 20; i++) {
    const job = i < 16 ? getRandomItem(JOBS.LOGISTICS) : getRandomItem(JOBS.OFFICE);
    const isDriver = job === 'Şoför' || job === 'Forklift Operatörü';

    const results: Record<string, ExtractedResult> = {};
    const status: Record<string, ResultStatus> = {};

    // 1. Eye Exam (Critical for drivers)
    const eye = findTest('goz', masterTests);
    if (eye) {
        if (isDriver && Math.random() < 0.3) {
            if (Math.random() < 0.5) {
                results[eye.id] = { testName: eye.name, value: 'Renk Körlüğü Var | Gece Çalışabilir', unit: 'Not' };
                status[eye.id] = ResultStatus.HIGH;
            } else {
                results[eye.id] = { testName: eye.name, value: 'Miyop Astigmat | Gözlük Kullanmalı', unit: 'Not' };
                status[eye.id] = ResultStatus.LOW; // Minor issue
            }
        } else {
            results[eye.id] = { testName: eye.name, value: 'Renk Körlüğü Yok | Gece Çalışabilir', unit: 'Not' };
            status[eye.id] = ResultStatus.NORMAL;
        }
    }

    // 2. Cholesterol
    const chol = findTest('kolesterol', masterTests);
    if (chol) {
        const cholVal = generateRandomValue(150, 240, 0);
        results[chol.id] = { testName: chol.name, value: cholVal, unit: 'mg/dL' };
        status[chol.id] = cholVal > 200 ? ResultStatus.HIGH : ResultStatus.NORMAL;
    }

    // 3. Glucose
    const glc = findTest('glikoz', masterTests);
    if (glc) {
        const glcVal = generateRandomValue(70, 115, 0);
        results[glc.id] = { testName: glc.name, value: glcVal, unit: 'mg/dL' };
        status[glc.id] = glcVal > 100 ? ResultStatus.HIGH : ResultStatus.NORMAL;
    }

    records.push({
        id: `demo_rec_2_${i}`,
        companyId: company2.id,
        patientName: NAMES[i],
        registrationNumber: `Sicil-${2000+i}`,
        jobTitle: job,
        date: new Date().toLocaleDateString('tr-TR'),
        fileName: 'demo_lab_result.pdf',
        results,
        status,
        isReviewed: Math.random() > 0.8, // 20% reviewed
        doctorNotes: (eye && status[eye.id] === ResultStatus.HIGH) 
            ? "Renk körlüğü mevcuttur. İşaret fişeklerini ayırt etmesi gereken görevlerde çalıştırılmamalıdır." 
            : ""
    });
  }

  return {
      tests: masterTests,
      companies: [company1, company2, ...MOCK_COMPANIES],
      records: [...records, ...MOCK_RECORDS],
      // Mobil tarama modülleri
      screenings: MOCK_SCREENINGS,
      quotes: MOCK_QUOTES,
      events: MOCK_CALENDAR_EVENTS,
      equipment: MOCK_EQUIPMENT,
      team: MOCK_TEAM
  };
};
