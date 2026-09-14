
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

/** Ek-2 İşe Giriş/Periyodik Muayene Formu — çıkarılan yapılandırılmış alanlar */
export interface Ek2Details {
  name?: string;         // Adı ve Soyadı
  birthInfo?: string;    // Doğum Yeri ve Tarihi
  gender?: string;       // Cinsiyeti
  phone?: string;        // Tel No / E-Posta
  job?: string;          // Yaptığı İş / Çalıştığı Bölüm
  bloodType?: string;    // Kan Grubu
  height?: string;       // Boy (cm)
  weight?: string;       // Kilo (kg)
  bmi?: string;          // Vücut Kitle İndeksi
  conclusion?: string;   // KANAAT VE SONUÇ metni
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
  /** Ek-2 belgesinden çıkarılan yapılandırılmış hasta bilgileri (hasta kartı için) */
  ek2Details?: Ek2Details;
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
  logoKey?: string;     // IndexedDB'de saklanan logo blob anahtarı
  signatureKey?: string; // imza görüntüsü blob anahtarı
  primaryColor?: string; // marka ana rengi (hex)
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
  screeningType?: 'ise_giris' | 'periyodik'; // tarama türü
  date: string;          // ISO yyyy-mm-dd
  endDate?: string;
  startTime?: string;    // HH:mm
  endTime?: string;      // HH:mm
  location?: string;
  status: ScreeningStatus;
  testIds: string[];     // planlanan testler
  testItems?: ScreeningTestItem[]; // test kalemleri (fiyat + miktar)
  plannedCount: number;  // planlanan çalışan sayısı
  completedCount: number;// işlemi tamamlanan
  teamMemberIds: string[];
  equipmentIds: string[];
  quoteId?: string;      // kaynak teklif
  notes?: string;
  coverLetter?: string;  // tarama ön yazısı
  terms?: string[];      // tarama şartları ve koşulları
  // Maliyet & fiyatlandırma
  perPersonPrice?: number;  // kişi başı fiyat (TL)
  extraCosts?: number;       // ek maliyetler (seyahat, konaklama vb.)
  discount?: number;          // indirim (TL)
  vatRate?: number;          // KDV oranı (%)
  costNotes?: string;        // maliyet notları
}

/** Tarama test kalemi — teklif kalemi gibi fiyat + miktar */
export interface ScreeningTestItem {
  testId: string;
  name: string;
  quantity: number;    // kişi / adet
  unitPrice: number;   // birim fiyat (TL)
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

// --- İZİN/ROL SİSTEMİ ---
// Uygulama modülleri — yetki matrisinde her modül için görüntüleme/düzenleme izni verilir
export const APP_MODULES = [
  'home', 'dashboard', 'screenings', 'quotes', 'calendar',
  'equipment', 'team', 'companies', 'config', 'reports'
] as const;
export type AppModule = (typeof APP_MODULES)[number];

export const MODULE_LABELS: Record<AppModule, string> = {
  home: 'Ana Sayfa',
  dashboard: 'Sonuçlar',
  screenings: 'Taramalar',
  quotes: 'Teklifler',
  calendar: 'Takvim',
  equipment: 'Ekipman',
  team: 'Ekip',
  companies: 'Firmalar',
  config: 'Test Havuzu',
  reports: 'Raporlar'
};

// Bir modül için izin seviyesi
export type PermissionLevel = 'none' | 'view' | 'edit';

export type ModulePermissions = Record<AppModule, PermissionLevel>;

export interface Role {
  id: string;
  name: string;
  description?: string;
  color?: string; // hex veya tailwind renk adı
  permissions: ModulePermissions;
  isSystem?: boolean; // sistem rolü (silinemez)
  createdAt: string;
}

export interface User {
  id: string;
  username: string;
  password: string; // In a real app, this should be hashed. For localStorage, we'll store simple strings.
  fullName: string;
  role: UserRole;
  roleId?: string; // Yeni: özel rol ataması (role === 'user' iken kullanılır)
  email?: string;
  phone?: string;
  jobTitle?: string;
  active?: boolean; // hesap aktif/pasif
  lastLogin?: string;
}

// --- SECURITY TYPES ---
export type LogCategory = 'auth' | 'data' | 'system' | 'user' | 'ai';
export type LogSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface AuditLog {
  id: string;
  userId: string;
  username: string;
  action: string; // e.g., "LOGIN", "DELETE_RECORD", "EXPORT_DATA"
  details: string;
  timestamp: string;
  category?: LogCategory;
  severity?: LogSeverity;
  ip?: string;
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
  roles?: Role[]; // roller (yedeklemeye dahil)
  appearance?: AppearanceSettings; // görünüm ayarları (yedeklemeye dahil)
}

/** Görünüm ayarları — tarayıcı-bazlı tema tercihleri */
export type ThemeMode = 'light' | 'dark' | 'system';
export type FontScale = 'sm' | 'md' | 'lg';

export interface AppearanceSettings {
  theme: ThemeMode;
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
// Ayarlar sayfası sekme kimlikleri — #/settings/<tab> rotaları için
export const SETTINGS_TAB_IDS = ['profile', 'system', 'org', 'appearance', 'ai', 'users', 'security', 'logs'] as const;
export type SettingsTab = typeof SETTINGS_TAB_IDS[number];
