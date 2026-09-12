import { Company, TestDefinition, PatientRecord, User, AuditLog, ReportSettings, Screening, Quote, CalendarEvent, Equipment, TeamMember, OrgInfo, AppearanceSettings } from '../types';
import { DEFAULT_TESTS } from '../constants';
import { DEFAULT_ADMIN_HASH } from '../utils/security';

const KEYS = {
  TESTS: 'mediscan_tests',
  COMPANIES: 'mediscan_companies',
  RECORDS: 'mediscan_records',
  USERS: 'mediscan_users',
  LOGS: 'mediscan_audit_logs',
  CURRENT_USER: 'mediscan_current_session',
  REPORT_SETTINGS: 'mediscan_report_settings',
  SCREENINGS: 'mediscan_screenings',
  QUOTES: 'mediscan_quotes',
  EVENTS: 'mediscan_calendar_events',
  EQUIPMENT: 'mediscan_equipment',
  TEAM: 'mediscan_team',
  ORG_INFO: 'mediscan_org_info',
  APPEARANCE: 'mediscan_appearance',
  QUOTE_DRAFT: 'mediscan_quote_draft',
  SCREENING_DRAFT: 'mediscan_screening_draft'
};

export const DEFAULT_REPORT_SETTINGS: ReportSettings = {
  title: 'SAĞLIK TARAMASI RAPORU',
  doctorName: '',
  doctorTitle: 'İşyeri Hekimi',
  labTechName: '',
  labTechTitle: 'Laboratuvar Sorumlusu'
};

export const DEFAULT_ORG_INFO: OrgInfo = {
  name: 'HanTech OSGB',
  tagline: 'Mobil Sağlık Taraması Yönetim Platformu',
  phone: '',
  email: '',
  web: '',
  address: '',
  taxOffice: '',
  taxNumber: '',
  signerName: '',
  signerTitle: 'Yetkili'
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'light',
  accent: 'blue',
  fontScale: 'md',
  compact: false,
  reduceMotion: false,
  sidebarCollapsed: false
};

export const DEMO_ACCOUNTS: User[] = [
  {
    id: 'admin_001',
    username: 'admin',
    password: DEFAULT_ADMIN_HASH, // Stored as SHA-256 Hash for '123'
    fullName: 'Sistem Yöneticisi',
    role: 'super_admin'
  },
  {
    id: 'doktor_002',
    username: 'doktor',
    password: DEFAULT_ADMIN_HASH, // Stored as SHA-256 Hash for '123'
    fullName: 'Dr. Mehmet Özkan (İşyeri Hekimi)',
    role: 'super_admin'
  },
  {
    id: 'personel_003',
    username: 'personel',
    password: DEFAULT_ADMIN_HASH, // Stored as SHA-256 Hash for '123'
    fullName: 'Ayşe Demir (Sağlık Personeli)',
    role: 'user'
  }
];

export const storageService = {
  saveTests: (tests: TestDefinition[]) => {
    localStorage.setItem(KEYS.TESTS, JSON.stringify(tests));
  },
  getTests: (): TestDefinition[] => {
    const data = localStorage.getItem(KEYS.TESTS);
    return data ? JSON.parse(data) : DEFAULT_TESTS;
  },

  saveCompanies: (companies: Company[]) => {
    localStorage.setItem(KEYS.COMPANIES, JSON.stringify(companies));
  },
  getCompanies: (): Company[] => {
    const data = localStorage.getItem(KEYS.COMPANIES);
    return data ? JSON.parse(data) : [];
  },

  saveRecords: (records: PatientRecord[]) => {
    localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
  },
  getRecords: (): PatientRecord[] => {
    const data = localStorage.getItem(KEYS.RECORDS);
    return data ? JSON.parse(data) : [];
  },

  // --- GLOBAL RAPOR AYARLARI (tüm firmalar için ortak antet/imza) ---
  saveReportSettings: (settings: ReportSettings) => {
    localStorage.setItem(KEYS.REPORT_SETTINGS, JSON.stringify(settings));
  },
  getReportSettings: (): ReportSettings => {
    const data = localStorage.getItem(KEYS.REPORT_SETTINGS);
    return data ? { ...DEFAULT_REPORT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_REPORT_SETTINGS };
  },

  // --- KURUM BİLGİLERİ (uygulamayı kullanan OSGB'nin antet/kimlik bilgileri) ---
  saveOrgInfo: (info: OrgInfo) => {
    localStorage.setItem(KEYS.ORG_INFO, JSON.stringify(info));
  },
  getOrgInfo: (): OrgInfo => {
    const data = localStorage.getItem(KEYS.ORG_INFO);
    return data ? { ...DEFAULT_ORG_INFO, ...JSON.parse(data) } : { ...DEFAULT_ORG_INFO };
  },

  // --- GÖRÜNÜM AYARLARI ---
  saveAppearance: (a: AppearanceSettings) => {
    localStorage.setItem(KEYS.APPEARANCE, JSON.stringify(a));
  },
  getAppearance: (): AppearanceSettings => {
    const data = localStorage.getItem(KEYS.APPEARANCE);
    return data ? { ...DEFAULT_APPEARANCE, ...JSON.parse(data) } : { ...DEFAULT_APPEARANCE };
  },

  // --- MOBİL TARAMA MODÜLLERİ ---
  saveScreenings: (items: Screening[]) => localStorage.setItem(KEYS.SCREENINGS, JSON.stringify(items)),
  getScreenings: (): Screening[] => {
    const data = localStorage.getItem(KEYS.SCREENINGS);
    return data ? JSON.parse(data) : [];
  },

  saveQuotes: (items: Quote[]) => localStorage.setItem(KEYS.QUOTES, JSON.stringify(items)),
  getQuotes: (): Quote[] => {
    const data = localStorage.getItem(KEYS.QUOTES);
    return data ? JSON.parse(data) : [];
  },

  // --- FORM TASLAKLARI (sayfa yenilense bile sihirbaz/form içeriği korunur) ---
  saveQuoteDraft: <T>(draft: T) => localStorage.setItem(KEYS.QUOTE_DRAFT, JSON.stringify(draft)),
  getQuoteDraft: <T>(): T | null => {
    const data = localStorage.getItem(KEYS.QUOTE_DRAFT);
    try { return data ? JSON.parse(data) as T : null; } catch { return null; }
  },
  clearQuoteDraft: () => localStorage.removeItem(KEYS.QUOTE_DRAFT),

  saveScreeningDraft: <T>(draft: T) => localStorage.setItem(KEYS.SCREENING_DRAFT, JSON.stringify(draft)),
  getScreeningDraft: <T>(): T | null => {
    const data = localStorage.getItem(KEYS.SCREENING_DRAFT);
    try { return data ? JSON.parse(data) as T : null; } catch { return null; }
  },
  clearScreeningDraft: () => localStorage.removeItem(KEYS.SCREENING_DRAFT),

  saveEvents: (items: CalendarEvent[]) => localStorage.setItem(KEYS.EVENTS, JSON.stringify(items)),
  getEvents: (): CalendarEvent[] => {
    const data = localStorage.getItem(KEYS.EVENTS);
    return data ? JSON.parse(data) : [];
  },

  saveEquipment: (items: Equipment[]) => localStorage.setItem(KEYS.EQUIPMENT, JSON.stringify(items)),
  getEquipment: (): Equipment[] => {
    const data = localStorage.getItem(KEYS.EQUIPMENT);
    return data ? JSON.parse(data) : [];
  },

  saveTeam: (items: TeamMember[]) => localStorage.setItem(KEYS.TEAM, JSON.stringify(items)),
  getTeam: (): TeamMember[] => {
    const data = localStorage.getItem(KEYS.TEAM);
    return data ? JSON.parse(data) : [];
  },

  // --- USER AUTH METHODS ---
  getUsers: (): User[] => {
    const data = localStorage.getItem(KEYS.USERS);
    if (!data) {
      // Initialize with all demo accounts
      localStorage.setItem(KEYS.USERS, JSON.stringify(DEMO_ACCOUNTS));
      return DEMO_ACCOUNTS;
    }
    try {
      const parsed: User[] = JSON.parse(data);
      // Ensure all demo accounts exist so demo buttons always succeed
      let updated = false;
      DEMO_ACCOUNTS.forEach(demoAcc => {
        if (!parsed.some(u => u.username === demoAcc.username)) {
          parsed.push(demoAcc);
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem(KEYS.USERS, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      localStorage.setItem(KEYS.USERS, JSON.stringify(DEMO_ACCOUNTS));
      return DEMO_ACCOUNTS;
    }
  },

  saveUsers: (users: User[]) => {
    localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  },

  // Session Management
  login: (user: User) => {
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
  },
  logout: () => {
    localStorage.removeItem(KEYS.CURRENT_USER);
  },
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  },

  // --- AUDIT LOGGING ---
  addLog: (user: User, action: string, details: string) => {
    const newLog: AuditLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      userId: user.id,
      username: user.username,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    
    const logs = storageService.getLogs();
    // Keep only last 1000 logs to prevent storage overflow
    const updatedLogs = [newLog, ...logs].slice(0, 1000);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(updatedLogs));
  },

  getLogs: (): AuditLog[] => {
    const data = localStorage.getItem(KEYS.LOGS);
    return data ? JSON.parse(data) : [];
  },
  
  clearLogs: () => {
      localStorage.removeItem(KEYS.LOGS);
  }
};