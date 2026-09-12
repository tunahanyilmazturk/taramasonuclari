import {
  Company, PatientRecord, ExtractedResult, ResultStatus,
  Screening, Quote, CalendarEvent, Equipment, TeamMember
} from '../types';
import { DEFAULT_TESTS } from '../constants';

/**
 * MOCK / DEMO VERİLER
 * ───────────────────
 * Gelecek modüller (Taramalar, Teklifler, Takvim, Ekipman, Ekip) için
 * örnek kayıtlar + mevcut sayfaları zenginleştiren ek firma ve hasta kayıtları.
 * "Örnek Veri Yükle" butonu üzerinden localStorage'a yazılır.
 */

// Bugünden n gün sonrasının ISO tarihi — takvimde kayıtlar her zaman görünür kalsın
const day = (offset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
};

const findTest = (key: string) => DEFAULT_TESTS.find(t => t.key === key);
const testId = (key: string): string => findTest(key)?.id ?? key;
const testName = (key: string): string => findTest(key)?.name ?? key;
const getTests = (keys: string[]) => keys.map(findTest).filter((t): t is NonNullable<typeof t> => !!t);

// ══════════════ EK MOCK FİRMALAR ══════════════
// (demoDataService'teki demo_comp_1 / demo_comp_2'ye ek olarak)

export const MOCK_COMPANIES: Company[] = [
  {
    id: 'mock_comp_3',
    name: 'Ege Gıda Üretim A.Ş.',
    sector: 'Gıda Üretimi',
    hazardClass: 'tehlikeli',
    employeeCount: 96,
    contactPerson: 'Selin Aydın (İK Uzmanı)',
    phone: '0(232) 376 45 12',
    email: 'selin.aydin@egegida.com.tr',
    address: 'İzmir Atatürk OSB, 10001 Sk. No:14, Çiğli / İzmir',
    notes: 'Gıda sektörü — portör muayeneleri ve hijyen eğitimi zorunlu.',
    tests: getTests(['hemogram', 'tam_idrar', 'burun_kulturu', 'bogaz_kulturu', 'gaita_kulturu', 'goz'])
  },
  {
    id: 'mock_comp_4',
    name: 'Yıldız İnşaat Taahhüt Ltd.',
    sector: 'İnşaat',
    hazardClass: 'cok_tehlikeli',
    employeeCount: 210,
    contactPerson: 'Ramazan Şen (Şantiye Şefi)',
    phone: '0(533) 812 90 44',
    email: 'rsen@yildizinsaat.com',
    address: 'Başakşehir Şantiyesi, Kayaşehir / İstanbul',
    notes: 'Mobil şantiye — tarama araçla sahada yapılacak. Vinç operatörleri için SFT şart.',
    tests: getTests(['hemogram', 'akciger_grafisi', 'sft', 'odyometri', 'tetanoz', 'goz'])
  }
];

// ══════════════ EK MOCK HASTA KAYITLARI ══════════════

const record = (
  id: string, companyId: string, name: string, reg: string, job: string,
  results: Record<string, ExtractedResult>, status: Record<string, ResultStatus>,
  reviewed: boolean, notes = ''
): PatientRecord => ({
  id, companyId, patientName: name, registrationNumber: reg, jobTitle: job,
  date: new Date(Date.now() - Math.floor(Math.random() * 10) * 86400000).toLocaleDateString('tr-TR'),
  fileName: 'mock_lab.pdf', results, status, isReviewed: reviewed, doctorNotes: notes
});

const res = (name: string, value: number | string, unit: string): ExtractedResult => ({ testName: name, value, unit });

export const MOCK_RECORDS: PatientRecord[] = [
  record('mock_rec_3_1', 'mock_comp_3', 'Kemal Usta', 'Sicil-3001', 'Üretim Operatörü', {
    [testId('tam_idrar')]: res('Tam İdrar Tetkiki', 'Normal', 'Panel'),
    [testId('burun_kulturu')]: res('Burun Kültürü', 'Üreme Yok', 'Sonuç'),
    [testId('bogaz_kulturu')]: res('Boğaz Kültürü', 'Üreme Yok', 'Sonuç')
  }, {
    [testId('tam_idrar')]: ResultStatus.NORMAL,
    [testId('burun_kulturu')]: ResultStatus.NORMAL,
    [testId('bogaz_kulturu')]: ResultStatus.NORMAL
  }, true),
  record('mock_rec_3_2', 'mock_comp_3', 'Nurten Aksoy', 'Sicil-3002', 'Paketleme', {
    [testId('gaita_kulturu')]: res('Gaita Kültürü', 'Salmonella spp. Üreme Yok', 'Sonuç'),
    [testId('goz')]: res('Göz Muayenesi', 'Presbiyopi başlangıcı | Yakın gözlük önerildi', 'Not')
  }, {
    [testId('gaita_kulturu')]: ResultStatus.NORMAL,
    [testId('goz')]: ResultStatus.LOW
  }, false, 'Yakın görme için gözlük önerisi verildi. Çalışmasına engel değildir.'),
  record('mock_rec_4_1', 'mock_comp_4', 'İsmail Toprak', 'Sicil-4101', 'Vinç Operatörü', {
    [testId('sft')]: res('Solunum Fonksiyon Testi', 'FVC %82 — Hafif restriktif patern', 'Sonuç'),
    [testId('odyometri')]: res('Odyometri (İşitme)', 'Normal', 'dB'),
    [testId('akciger_grafisi')]: res('Akciğer Grafisi', 'Normal', 'Sonuç')
  }, {
    [testId('sft')]: ResultStatus.HIGH,
    [testId('odyometri')]: ResultStatus.NORMAL,
    [testId('akciger_grafisi')]: ResultStatus.NORMAL
  }, false, 'SFT bulgusu takip edilmeli. Tozlu ortamda FFP2 maske zorunluluğu hatırlatıldı.'),
  record('mock_rec_4_2', 'mock_comp_4', 'Ömer Faruk Çelik', 'Sicil-4102', 'Demirci', {
    [testId('hemogram')]: res('Hemogram (Tam Kan Sayımı)', 'Normal', 'Panel'),
    [testId('tetanoz')]: res('Tetanoz', 'Tetanoz aşısı yapılmıştır', 'Aşı Durumu'),
    [testId('odyometri')]: res('Odyometri (İşitme)', 'Sağ kulak 4kHz çentik', 'dB')
  }, {
    [testId('hemogram')]: ResultStatus.NORMAL,
    [testId('tetanoz')]: ResultStatus.NORMAL,
    [testId('odyometri')]: ResultStatus.HIGH
  }, true, 'Gürültü travmasına bağlı erken işitme kaybı. Çift koruma (kulaklık+tıkaç) önerildi.')
];

// ══════════════ EKİP (PERSONEL) ══════════════

export const MOCK_TEAM: TeamMember[] = [
  {
    id: 'team_1', fullName: 'Dr. Selim Güçlü', role: 'is_yeri_hekimi', status: 'aktif',
    phone: '0(532) 111 22 33', email: 'selim.guclu@hantech.com.tr',
    certificates: [
      { name: 'İşyeri Hekimliği Sertifikası', expiryDate: day(540) },
      { name: 'İSG Eğiticisi Belgesi' }
    ]
  },
  {
    id: 'team_2', fullName: 'Dr. Canan Sever', role: 'is_yeri_hekimi', status: 'aktif',
    phone: '0(533) 444 55 66', email: 'canan.sever@hantech.com.tr',
    certificates: [{ name: 'İşyeri Hekimliği Sertifikası', expiryDate: day(720) }]
  },
  {
    id: 'team_3', fullName: 'Ayşe Demir', role: 'hemsire', status: 'aktif',
    phone: '0(542) 777 88 99',
    certificates: [
      { name: 'Hemşirelik Lisansı' },
      { name: 'Temel İlk Yardım', expiryDate: day(400) }
    ]
  },
  {
    id: 'team_4', fullName: 'Emre Kılıç', role: 'saglik_memuru', status: 'aktif',
    phone: '0(536) 222 33 44',
    certificates: [{ name: 'Sağlık Memuru (Toplum Sağlığı)' }, { name: 'Kan Alma Sertifikası' }]
  },
  {
    id: 'team_5', fullName: 'Volkan Arslan', role: 'teknisyen', status: 'izinli',
    phone: '0(541) 999 00 11',
    certificates: [
      { name: 'Radyoloji Teknisyeni', expiryDate: day(180) },
      { name: 'Odyometri Uygulayıcısı' }
    ]
  },
  {
    id: 'team_6', fullName: 'Hasan Yörük', role: 'sofor', status: 'aktif',
    phone: '0(537) 555 66 77',
    certificates: [
      { name: 'SRC-4 Belgesi', expiryDate: day(900) },
      { name: 'Psikoteknik', expiryDate: day(300) }
    ]
  }
];

// ══════════════ EKİPMAN ══════════════

export const MOCK_EQUIPMENT: Equipment[] = [
  {
    id: 'eq_1', name: 'Mobil Sağlık Tarama Aracı', category: 'arac', status: 'musait',
    serialNumber: '34 HT 1453', notes: 'Odyometre kabini + röntgen ünitesi dahili.'
  },
  {
    id: 'eq_2', name: 'Odyometre (Interacoustics AD629)', category: 'cihaz', status: 'zimmetli',
    serialNumber: 'ODY-2023-114', lastCalibrationDate: day(-200), nextCalibrationDate: day(165),
    assignedScreeningId: 'scr_2'
  },
  {
    id: 'eq_3', name: 'Spirometre (SFT Cihazı)', category: 'cihaz', status: 'musait',
    serialNumber: 'SFT-2024-038', lastCalibrationDate: day(-90), nextCalibrationDate: day(275)
  },
  {
    id: 'eq_4', name: 'Portatif EKG Cihazı', category: 'cihaz', status: 'musait',
    serialNumber: 'EKG-2022-007', lastCalibrationDate: day(-310), nextCalibrationDate: day(55),
    notes: 'Kalibrasyon yaklaşıyor — bakım planlanmalı.'
  },
  {
    id: 'eq_5', name: 'Mobil Röntgen Ünitesi', category: 'cihaz', status: 'bakimda',
    serialNumber: 'XRY-2021-502', lastCalibrationDate: day(-400), nextCalibrationDate: day(-35),
    notes: 'Kalibrasyon süresi geçti — kullanım dışı, servis bekleniyor.'
  },
  {
    id: 'eq_6', name: 'Göz Tarama Vizörü (Titmus)', category: 'cihaz', status: 'arizali',
    serialNumber: 'GOZ-2020-019', notes: 'Lamba arızalı — yedek parça sipariş edildi.'
  },
  {
    id: 'eq_7', name: 'Vakumlu Kan Tüpü (500 adet)', category: 'sarf', status: 'musait',
    notes: 'EDTA + ayrıştırıcılı jel karışık koli.'
  },
  {
    id: 'eq_8', name: 'Tek Kullanımlık Eldiven (20 kutu)', category: 'sarf', status: 'musait'
  }
];

// ══════════════ TEKLİFLER ══════════════

const qItem = (id: string, key: string, qty: number, price: number, customName?: string) => ({
  id, testId: testId(key), name: customName ?? testName(key), quantity: qty, unitPrice: price
});

/** Standart şart maddeleri — TERM_LIBRARY'deki önerilenlerle uyumlu */
const stdTerms = (validDate: string): string[] => [
  'Fiyatlara KDV dahil değildir.',
  'Ödeme: %50 avans, bakiye tarama tamamlandıktan sonra.',
  `Teklif, ${validDate} tarihine kadar geçerlidir.`,
  'Raporlar, tarama sonrası 5 iş günü içinde teslim edilir.',
  'Mobil ekip ulaşım ücreti fiyatlara dahildir.',
  'Muayene için uygun ortam (sessiz oda, priz erişimi) firma tarafından sağlanır.',
  'Tüm sağlık verileri 6698 sayılı KVKK kapsamında korunur ve üçüncü kişilerle paylaşılmaz.'
];

const trDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR');

const q1Valid = day(20), q2Valid = day(20), q3Valid = day(28), q4Valid = day(-30), q5Valid = day(-15);

export const MOCK_QUOTES: Quote[] = [
  {
    id: 'quo_1', companyId: 'demo_comp_1', quoteNumber: 'TKL-2025-014',
    quoteType: 'periyodik',
    title: 'Anadolu Metal Sanayi A.Ş. — Periyodik Muayene Fiyat Teklifi',
    createdAt: day(-40), validUntil: q1Valid, status: 'onaylandi',
    discountRate: 5, discountType: 'percent', vatRate: 20,
    items: [
      qItem('qi_1', 'hemogram', 148, 180),
      qItem('qi_2', 'odyometri', 148, 120),
      qItem('qi_3', 'akciger_grafisi', 148, 250),
      qItem('qi_4', 'tetanoz', 40, 90),
      qItem('qi_5', 'krom', 60, 350),
      qItem('qi_6', 'kadmiyum', 60, 380)
    ],
    coverLetter: `Sayın Murat Kaya (İK Müdürü),

Anadolu Metal Sanayi A.Ş. kuruluşunuzun çalışanlarına yönelik periyodik muayene hizmetimiz için hazırlamış olduğumuz fiyat teklifimizi bilgilerinize sunarız.

Teklifimiz 6 tetkik/hizmet kalemini kapsamakta olup firmanızın 148 çalışanı baz alınarak hazırlanmıştır. Mobil sağlık tarama aracımız ve deneyimli sağlık ekibimizle hizmet, işyerinizde, iş akışınızı aksatmadan gerçekleştirilecektir.

Teklifimiz ${trDate(q1Valid)} tarihine kadar geçerlidir. Uygun bulmanız halinde operasyon planlaması için ekibimizle iletişime geçmeniz yeterlidir.

Saygılarımızla,
HanTech OSGB`,
    terms: stdTerms(trDate(q1Valid)),
    includeCover: true, includeTerms: true,
    notes: 'Kaynakçılara ağır metal paneli dahil edildi. 2 grup halinde sahada yapılacak.'
  },
  {
    id: 'quo_2', companyId: 'demo_comp_2', quoteNumber: 'TKL-2025-016',
    quoteType: 'ise_giris',
    title: 'TechLojistik Global Ltd. — İşe Giriş Muayenesi Fiyat Teklifi',
    createdAt: day(-10), validUntil: q2Valid, status: 'gonderildi',
    discountRate: 0, discountType: 'percent', vatRate: 20,
    items: [
      qItem('qi_7', 'hemogram', 62, 180),
      qItem('qi_8', 'goz', 62, 100),
      qItem('qi_9', 'ekg', 62, 150),
      qItem('qi_10', 'glikoz', 62, 60),
      qItem('qi_11', 'kolesterol', 62, 80)
    ],
    coverLetter: `Sayın Elif Demirtaş (Operasyon),

İşe Giriş Muayenesi hizmetimiz için hazırladığımız fiyat teklifimiz aşağıdadır.

Toplam 5 kalem — genel toplam ₺42.408,00 (KDV dahil). Teklifimiz ${trDate(q2Valid)} tarihine kadar geçerlidir.

Sorularınız için bizimle iletişime geçebilirsiniz.

Saygılarımızla,
HanTech OSGB`,
    terms: stdTerms(trDate(q2Valid)),
    includeCover: true, includeTerms: true
  },
  {
    id: 'quo_3', companyId: 'mock_comp_3', quoteNumber: 'TKL-2025-018',
    quoteType: 'periyodik',
    title: 'Ege Gıda Üretim A.Ş. — Portör Muayeneleri Fiyat Teklifi',
    createdAt: day(-2), validUntil: q3Valid, status: 'taslak',
    discountRate: 10, discountType: 'percent', vatRate: 20,
    items: [
      qItem('qi_12', 'hemogram', 96, 180),
      qItem('qi_13', 'burun_kulturu', 96, 140),
      qItem('qi_14', 'bogaz_kulturu', 96, 140),
      qItem('qi_15', 'gaita_kulturu', 96, 160),
      qItem('qi_16', 'diger', 96, 50, 'Portör Muayene Konsültasyonu')
    ],
    coverLetter: `Sayın Selin Aydın (İK Uzmanı),

Ege Gıda Üretim A.Ş. ekibinin sağlığı bizim için öncelikli — portör muayeneleri hizmetimiz için hazırladığımız teklifi memnuniyetle paylaşıyoruz.

5 tetkik/hizmet kalemini, 96 çalışanınız için kapsayan bu teklifte amacımız net: ekibinizin sağlık taramasını en hızlı ve en konforlu şekilde tamamlamak. Mobil ünitemizle kapınıza geliyoruz, siz işinize devam ediyorsunuz.

Teklifimiz ${trDate(q3Valid)} tarihine kadar geçerli. Bir kahve içimlik görüşmede tüm detayları konuşabiliriz.

Sağlıklı günler dileğiyle,
HanTech OSGB`,
    terms: stdTerms(trDate(q3Valid)),
    includeCover: true, includeTerms: true,
    notes: 'Portör paketi — hijyen eğitimi teklif dışı tutuldu, ayrıca fiyatlanacak.'
  },
  {
    id: 'quo_4', companyId: 'mock_comp_4', quoteNumber: 'TKL-2025-011',
    quoteType: 'periyodik',
    title: 'Yıldız İnşaat Taahhüt Ltd. — Periyodik Muayene Fiyat Teklifi',
    createdAt: day(-60), validUntil: q4Valid, status: 'reddedildi',
    discountRate: 0, discountType: 'percent', vatRate: 20,
    items: [
      qItem('qi_17', 'hemogram', 210, 190),
      qItem('qi_18', 'sft', 210, 130),
      qItem('qi_19', 'odyometri', 210, 130),
      qItem('qi_20', 'akciger_grafisi', 210, 260)
    ],
    coverLetter: `Sayın Ramazan Şen (Şantiye Şefi),

Yıldız İnşaat Taahhüt Ltd. için planladığımız periyodik muayene operasyonuna ilişkin fiyat teklifimizi sunarız.

Mobil tarama aracımızla şantiyenize geliyor, 4 tetkik/hizmet kalemini sahada tamamlıyor ve sonuçları dijital olarak raporluyoruz — çalışanlarınız işten ayrılmak zorunda kalmaz, operasyon tek günde tamamlanır.

Teklifimiz ${trDate(q4Valid)} tarihine kadar geçerlidir. Onayınız sonrasında tarama tarihini birlikte planlayabiliriz.

Saygılarımızla,
HanTech OSGB`,
    terms: stdTerms(trDate(q4Valid)),
    includeCover: true, includeTerms: true,
    notes: 'Fiyat yüksek bulundu — yeniden görüşülecek.'
  },
  {
    id: 'quo_5', companyId: 'mock_comp_3', quoteNumber: 'TKL-2025-009',
    quoteType: 'ise_giris',
    title: 'Ege Gıda Üretim A.Ş. — İşe Giriş Muayenesi Fiyat Teklifi',
    createdAt: day(-75), validUntil: q5Valid, status: 'gonderildi',
    discountRate: 0, discountType: 'percent', vatRate: 20,
    items: [
      qItem('qi_21', 'hemogram', 24, 180),
      qItem('qi_22', 'tam_idrar', 24, 70),
      qItem('qi_23', 'goz', 24, 100),
      qItem('qi_24', 'ekg', 24, 150)
    ],
    coverLetter: `Sayın Selin Aydın (İK Uzmanı),

Ege Gıda Üretim A.Ş. kuruluşunuzun yeni işe alınacak personeline yönelik işe giriş muayenesi hizmetimiz için hazırlamış olduğumuz fiyat teklifimizi bilgilerinize sunarız.

Teklifimiz 4 tetkik/hizmet kalemini kapsamaktadır. Teklifimiz ${trDate(q5Valid)} tarihine kadar geçerlidir.

Saygılarımızla,
HanTech OSGB`,
    terms: stdTerms(trDate(q5Valid)),
    includeCover: true, includeTerms: true,
    notes: 'Yanıt alınamadı — geçerlilik süresi doldu, takip araması planlanmalı.'
  }
];

// ══════════════ TARAMALAR ══════════════

export const MOCK_SCREENINGS: Screening[] = [
  {
    id: 'scr_1', companyId: 'demo_comp_1', title: 'Periyodik Muayene — 1. Grup (Kaynak)',
    date: day(-12), location: 'Sincan OSB Fabrika Sahası', status: 'tamamlandi',
    testIds: [testId('hemogram'), testId('odyometri'), testId('akciger_grafisi'), testId('krom'), testId('kadmiyum')],
    plannedCount: 74, completedCount: 74,
    teamMemberIds: ['team_1', 'team_3', 'team_5', 'team_6'],
    equipmentIds: ['eq_1', 'eq_2', 'eq_5'],
    quoteId: 'quo_1',
    notes: 'Sonuçlar sisteme yüklendi, hekim incelemesi devam ediyor.'
  },
  {
    id: 'scr_2', companyId: 'demo_comp_1', title: 'Periyodik Muayene — 2. Grup (Montaj+İdari)',
    date: day(5), location: 'Sincan OSB Fabrika Sahası', status: 'planlandi',
    testIds: [testId('hemogram'), testId('odyometri'), testId('akciger_grafisi'), testId('tetanoz')],
    plannedCount: 74, completedCount: 0,
    teamMemberIds: ['team_1', 'team_4', 'team_6'],
    equipmentIds: ['eq_1', 'eq_2'],
    quoteId: 'quo_1'
  },
  {
    id: 'scr_3', companyId: 'demo_comp_2', title: 'İşe Giriş Sağlık Taraması',
    date: day(0), location: 'Tuzla Depo Yerleşkesi', status: 'devam_ediyor',
    testIds: [testId('hemogram'), testId('goz'), testId('ekg')],
    plannedCount: 18, completedCount: 11,
    teamMemberIds: ['team_2', 'team_3'],
    equipmentIds: ['eq_4'],
    quoteId: 'quo_2'
  },
  {
    id: 'scr_4', companyId: 'mock_comp_4', title: 'Şantiye Periyodik Tarama',
    date: day(14), endDate: day(16), location: 'Başakşehir Şantiyesi', status: 'planlandi',
    testIds: [testId('hemogram'), testId('sft'), testId('odyometri'), testId('akciger_grafisi'), testId('tetanoz')],
    plannedCount: 210, completedCount: 0,
    teamMemberIds: ['team_1', 'team_2', 'team_3', 'team_4', 'team_6'],
    equipmentIds: ['eq_1', 'eq_3'],
    notes: '3 günlük operasyon — röntgen ünitesi bakımda, dış lab ile anlaşılacak.'
  },
  {
    id: 'scr_5', companyId: 'mock_comp_3', title: 'Portör Muayeneleri',
    date: day(9), location: 'Çiğli Üretim Tesisi', status: 'planlandi',
    testIds: [testId('burun_kulturu'), testId('bogaz_kulturu'), testId('gaita_kulturu'), testId('hemogram')],
    plannedCount: 96, completedCount: 0,
    teamMemberIds: ['team_2', 'team_3'],
    equipmentIds: [],
    quoteId: 'quo_3'
  }
];

// ══════════════ TAKVİM OLAYLARI ══════════════
// (Tarama tipindekiler Screening kayıtlarına bağlanır; geri kalanı bağımsız hatırlatmalar)

export const MOCK_CALENDAR_EVENTS: CalendarEvent[] = [
  {
    id: 'ev_1', title: 'Anadolu Metal — 2. Grup Tarama', date: day(5),
    type: 'tarama', companyId: 'demo_comp_1', screeningId: 'scr_2'
  },
  {
    id: 'ev_2', title: 'TechLojistik — İşe Giriş Taraması', date: day(0),
    type: 'tarama', companyId: 'demo_comp_2', screeningId: 'scr_3'
  },
  {
    id: 'ev_3', title: 'Ege Gıda — Portör Muayeneleri', date: day(9),
    type: 'tarama', companyId: 'mock_comp_3', screeningId: 'scr_5'
  },
  {
    id: 'ev_4', title: 'Yıldız İnşaat — Şantiye Taraması', date: day(14), endDate: day(16),
    type: 'tarama', companyId: 'mock_comp_4', screeningId: 'scr_4'
  },
  {
    id: 'ev_5', title: 'EKG Cihazı Kalibrasyon Randevusu', date: day(55),
    type: 'kalibrasyon', notes: 'Portatif EKG (EKG-2022-007) yetkili servise götürülecek.'
  },
  {
    id: 'ev_6', title: 'Ege Gıda Teklif Görüşmesi', date: day(3),
    type: 'toplanti', companyId: 'mock_comp_3', notes: 'TKL-2025-018 revizyonu ve hijyen eğitimi fiyatı konuşulacak.'
  },
  {
    id: 'ev_7', title: 'Aylık Ekip Toplantısı', date: day(30),
    type: 'toplanti', notes: 'Tarama planları ve ekipman durumu değerlendirmesi.'
  }
];
