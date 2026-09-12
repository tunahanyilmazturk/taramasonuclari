
export interface ReferenceRange {
  min: number;
  max: number;
}

export type TestType = 'numeric' | 'text';

export interface TestDefinition {
  id: string;
  name: string; // e.g., "Hemoglobin", "WBC", "Akciğer Grafisi"
  key: string; // Normalized key for matching
  unit: string;
  type: TestType; // New field to distinguish test types
  range?: ReferenceRange; // Optional, only for numeric
  subTests?: TestDefinition[]; // For panel tests like Hemogram
  unitPrice?: number; // Liste fiyatı (₺) — tekliflerde varsayılan birim fiyat olarak kullanılır
  category?: string;  // Havuz grubu — teklifte kategori bazlı seçim için
}

export enum ResultStatus {
  NORMAL = 'Normal',
  HIGH = 'Yüksek',
  LOW = 'Düşük',
  UNKNOWN = 'Belirsiz' // For text-based results or missing ranges
}

export interface ExtractedResult {
  testName: string;
  value: number | string;
  unit: string;
}

/** PDF çıkarım raporu — hangi testler bulundu, hangileri bulunamadı */
export interface ExtractionReport {
  patientName: string;
  registrationNumber: string;
  jobTitle: string;
  date: string;
  extractedResults: ExtractedResult[];
  /** Bulunan test adları */
  foundTests: string[];
  /** Bulunamayan test adları */
  missingTests: string[];
  /** Toplam test sayısı */
  totalTests: number;
  /** Bulunan test sayısı */
  foundCount: number;
}

export interface PatientRecord {
  id: string;
  companyId: string; 
  patientName: string;
  registrationNumber?: string; // Sicil No / Protokol No
  jobTitle?: string; // NEW: Görevi / Bölümü
  date: string;
  results: Record<string, ExtractedResult>; 
  status: Record<string, ResultStatus>; 
  fileName: string;
  doctorNotes?: string; // New field for manual doctor comments
  isReviewed?: boolean; // NEW: Approval workflow status
}

export interface ReportSettings {
  title?: string;
  doctorName?: string;
  doctorTitle?: string;
  labTechName?: string;
  labTechTitle?: string;
}

/** Uygulamayı kullanan kurumun (OSGB) kimlik bilgileri — antet, imza ve dokümanlarda kullanılır */
export interface OrgInfo {
  name: string;         // ticari unvan (ör. "HanTech OSGB")
  tagline?: string;     // kısa açıklama (ör. "Mobil Sağlık Hizmetleri")
  phone?: string;
  email?: string;
  web?: string;
  address?: string;
  taxOffice?: string;   // vergi dairesi
  taxNumber?: string;   // vergi no
  signerName?: string;  // imza yetkilisi
  signerTitle?: string; // imza yetkilisi unvanı
}

/** İSG tehlike sınıfı (6331 sayılı kanun) */
export type HazardClass = 'az_tehlikeli' | 'tehlikeli' | 'cok_tehlikeli';

export interface Company {
  id: string;
  name: string;
  tests: TestDefinition[];
  reportSettings?: ReportSettings; // Customizable report headers/signatures
  // --- Firma profili ---
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  sector?: string;
  hazardClass?: HazardClass;
  employeeCount?: number;
  notes?: string;
}

// ─── MOBİL SAĞLIK TARAMA MODÜLÜ TİPLERİ ───

/** Tarama operasyonu durumu */
export type ScreeningStatus = 'planlandi' | 'devam_ediyor' | 'tamamlandi' | 'iptal';

/** Mobil sağlık taraması operasyonu */
export interface Screening {
  id: string;
  companyId: string;
  title: string;
  date: string;          // ISO yyyy-mm-dd
  endDate?: string;
  location: string;
  status: ScreeningStatus;
  testIds: string[];     // planlanan testler
  plannedCount: number;  // planlanan çalışan sayısı
  completedCount: number;// işlemi tamamlanan
  teamMemberIds: string[];
  equipmentIds: string[];
  quoteId?: string;      // kaynak teklif
  notes?: string;
}

/** Teklif durum akışı: Taslak → Gönderildi → Onaylandı/Reddedildi */
export type QuoteStatus = 'taslak' | 'gonderildi' | 'onaylandi' | 'reddedildi';

export interface QuoteItem {
  id: string;
  name: string;        // teklif anındaki hizmet adı (snapshot)
  testId?: string;     // test havuzu bağlantısı
  quantity: number;    // kişi / adet
  unitPrice: number;   // birim fiyat (₺)
}

export type QuoteType = 'ise_giris' | 'periyodik';

export interface Quote {
  id: string;
  companyId: string;
  quoteNumber: string; // TKL-2025-001
  title?: string;      // teklif başlığı (otomatik üretilir, düzenlenebilir)
  quoteType?: QuoteType; // tarama türü
  coverLetter?: string; // ön yazı metni
  terms?: string[];     // şartlar ve koşullar maddeleri
  includeCover?: boolean; // dokümana ön yazı dahil mi (varsayılan true)
  includeTerms?: boolean; // dokümana şartlar dahil mi (varsayılan true)
  createdAt: string;
  validUntil: string;
  status: QuoteStatus;
  items: QuoteItem[];
  discountRate: number; // indirim değeri — discountType'a göre % veya ₺
  discountType?: 'percent' | 'amount'; // indirim türü (varsayılan: percent)
  vatRate: number;      // %
  notes?: string;
}

export type CalendarEventType = 'tarama' | 'toplanti' | 'kalibrasyon' | 'diger';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: CalendarEventType;
  companyId?: string;
  screeningId?: string;
  notes?: string;
}

export type EquipmentCategory = 'arac' | 'cihaz' | 'sarf';
export type EquipmentStatus = 'musait' | 'zimmetli' | 'bakimda' | 'arizali';

export interface Equipment {
  id: string;
  name: string;
  category: EquipmentCategory;
  serialNumber?: string;
  status: EquipmentStatus;
  lastCalibrationDate?: string;
  nextCalibrationDate?: string;
  assignedScreeningId?: string;
  notes?: string;
}

export type TeamRole = 'is_yeri_hekimi' | 'hemsire' | 'saglik_memuru' | 'teknisyen' | 'sofor';
export type TeamMemberStatus = 'aktif' | 'izinli' | 'pasif';

export interface TeamCertificate {
  name: string;
  expiryDate?: string;
}

export interface TeamMember {
  id: string;
  fullName: string;
  role: TeamRole;
  phone: string;
  email?: string;
  status: TeamMemberStatus;
  certificates: TeamCertificate[];
}

// --- AUTH TYPES ---
export type UserRole = 'super_admin' | 'user';

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this should be hashed. For localStorage, we'll store simple strings.
  fullName: string;
  role: UserRole;
}

// --- SECURITY TYPES ---
export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string; // e.g., "LOGIN", "DELETE_RECORD", "EXPORT_DATA"
  details: string;
  timestamp: string;
}

export interface AppState {
  companies: Company[];
  tests: TestDefinition[]; 
  records: PatientRecord[];
  users?: User[]; // Added users to backup state
  logs?: AuditLog[]; // Added logs to backup state
  // Mobil tarama modülleri (yedeklemeye dahil)
  screenings?: Screening[];
  quotes?: Quote[];
  events?: CalendarEvent[];
  equipment?: Equipment[];
  team?: TeamMember[];
  orgInfo?: OrgInfo; // kurum kimlik bilgileri (yedeklemeye dahil)
}

/** Görünüm ayarları — tarayıcı-bazlı tema tercihleri */
export type AccentColor = 'blue' | 'emerald' | 'violet' | 'rose' | 'amber';
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontScale = 'sm' | 'md' | 'lg';

export interface AppearanceSettings {
  theme: ThemeMode;
  accent: AccentColor;
  fontScale: FontScale;       // html font-size: 14/16/17.5px
  compact: boolean;           // yoğun görünüm (dar boşluklar)
  reduceMotion: boolean;      // animasyonları azalt
  sidebarCollapsed: boolean;  // sidebar varsayılan olarak daraltılmış başlasın
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}