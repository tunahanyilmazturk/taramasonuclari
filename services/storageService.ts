import { Company, TestDefinition, PatientRecord, User, AuditLog, LogCategory, LogSeverity, ReportSettings, Screening, Quote, CalendarEvent, Equipment, TeamMember, OrgInfo, AppearanceSettings, Role, APP_MODULES, ModulePermissions } from '../types';
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
  SCREENING_DRAFT: 'mediscan_screening_draft',
  ROLES: 'mediscan_roles'
};

const readJson = <T>(key: string, fallback: T): T => {
  const data = localStorage.getItem(key);
  if (!data) return fallback;
  try {
    return JSON.parse(data) as T;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
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
    role: 'super_admin',
    email: 'admin@hantech.com',
    phone: '',
    jobTitle: 'Sistem Yöneticisi',
    active: true
  },
  {
    id: 'doktor_002',
    username: 'doktor',
    password: DEFAULT_ADMIN_HASH, // Stored as SHA-256 Hash for '123'
    fullName: 'Dr. Mehmet Özkan (İşyeri Hekimi)',
    role: 'user',
    roleId: 'role_doktor',
    email: 'doktor@hantech.com',
    phone: '',
    jobTitle: 'İşyeri Hekimi',
    active: true
  },
  {
    id: 'personel_003',
    username: 'personel',
    password: DEFAULT_ADMIN_HASH, // Stored as SHA-256 Hash for '123'
    fullName: 'Ayşe Demir (Sağlık Personeli)',
    role: 'user',
    roleId: 'role_personel',
    email: 'personel@hantech.com',
    phone: '',
    jobTitle: 'Sağlık Personeli',
    active: true
  }
];

// Varsayılan roller — tüm modüllere view izni, sadece sonuçlara edit
const defaultPermissions = (): ModulePermissions =>
  APP_MODULES.reduce((acc, m) => {
    acc[m] = 'view';
    return acc;
  }, {} as ModulePermissions);

const doktorPermissions = (): ModulePermissions => {
  const p = defaultPermissions();
  p.dashboard = 'edit';
  p.screenings = 'edit';
  p.calendar = 'view';
  p.quotes = 'view';
  p.reports = 'view';
  p.equipment = 'view';
  p.team = 'view';
  p.companies = 'view';
  p.config = 'view';
  return p;
};

const personelPermissions = (): ModulePermissions => {
  const p = defaultPermissions();
  p.dashboard = 'view';
  p.screenings = 'view';
  p.calendar = 'view';
  p.quotes = 'none';
  p.equipment = 'none';
  p.team = 'none';
  p.companies = 'none';
  p.config = 'none';
  p.reports = 'none';
  p.home = 'view';
  return p;
};

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'role_doktor',
    name: 'Doktor',
    description: 'Sonuçları düzenleyebilir, tarama planlayabilir',
    color: 'purple',
    permissions: doktorPermissions(),
    isSystem: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'role_personel',
    name: 'Sağlık Personeli',
    description: 'Sadece görüntüleme — sonuçları ve takvimi görebilir',
    color: 'blue',
    permissions: personelPermissions(),
    isSystem: true,
    createdAt: new Date().toISOString()
  }
];

export const storageService = {
  saveTests: (tests: TestDefinition[]) => {
    localStorage.setItem(KEYS.TESTS, JSON.stringify(tests));
  },
  getTests: (): TestDefinition[] => {
    return readJson(KEYS.TESTS, DEFAULT_TESTS);
  },

  saveCompanies: (companies: Company[]) => {
    localStorage.setItem(KEYS.COMPANIES, JSON.stringify(companies));
  },
  getCompanies: (): Company[] => {
    return readJson<Company[]>(KEYS.COMPANIES, []);
  },

  saveRecords: (records: PatientRecord[]) => {
    localStorage.setItem(KEYS.RECORDS, JSON.stringify(records));
  },
  getRecords: (): PatientRecord[] => {
    return readJson<PatientRecord[]>(KEYS.RECORDS, []);
  },

  // --- GLOBAL RAPOR AYARLARI (tüm firmalar için ortak antet/imza) ---
  saveReportSettings: (settings: ReportSettings) => {
    localStorage.setItem(KEYS.REPORT_SETTINGS, JSON.stringify(settings));
  },
  getReportSettings: (): ReportSettings => {
    return { ...DEFAULT_REPORT_SETTINGS, ...readJson<Partial<ReportSettings>>(KEYS.REPORT_SETTINGS, {}) };
  },

  // --- KURUM BİLGİLERİ (uygulamayı kullanan OSGB'nin antet/kimlik bilgileri) ---
  saveOrgInfo: (info: OrgInfo) => {
    localStorage.setItem(KEYS.ORG_INFO, JSON.stringify(info));
  },
  getOrgInfo: (): OrgInfo => {
    return { ...DEFAULT_ORG_INFO, ...readJson<Partial<OrgInfo>>(KEYS.ORG_INFO, {}) };
  },

  // --- GÖRÜNÜM AYARLARI ---
  saveAppearance: (a: AppearanceSettings) => {
    localStorage.setItem(KEYS.APPEARANCE, JSON.stringify(a));
  },
  getAppearance: (): AppearanceSettings => {
    return { ...DEFAULT_APPEARANCE, ...readJson<Partial<AppearanceSettings>>(KEYS.APPEARANCE, {}) };
  },

  // --- MOBİL TARAMA MODÜLLERİ ---
  saveScreenings: (items: Screening[]) => localStorage.setItem(KEYS.SCREENINGS, JSON.stringify(items)),
  getScreenings: (): Screening[] => {
    return readJson<Screening[]>(KEYS.SCREENINGS, []);
  },

  saveQuotes: (items: Quote[]) => localStorage.setItem(KEYS.QUOTES, JSON.stringify(items)),
  getQuotes: (): Quote[] => {
    return readJson<Quote[]>(KEYS.QUOTES, []);
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
    return readJson<CalendarEvent[]>(KEYS.EVENTS, []);
  },

  saveEquipment: (items: Equipment[]) => localStorage.setItem(KEYS.EQUIPMENT, JSON.stringify(items)),
  getEquipment: (): Equipment[] => {
    return readJson<Equipment[]>(KEYS.EQUIPMENT, []);
  },

  saveTeam: (items: TeamMember[]) => localStorage.setItem(KEYS.TEAM, JSON.stringify(items)),
  getTeam: (): TeamMember[] => {
    return readJson<TeamMember[]>(KEYS.TEAM, []);
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
      const parsedValue: unknown = JSON.parse(data);
      if (!Array.isArray(parsedValue)) throw new Error('Kullanıcı verisi dizi değil');
      const parsed = parsedValue as User[];
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

  // --- ROLE METHODS ---
  getRoles: (): Role[] => {
    const data = localStorage.getItem(KEYS.ROLES);
    if (!data) {
      localStorage.setItem(KEYS.ROLES, JSON.stringify(DEFAULT_ROLES));
      return DEFAULT_ROLES;
    }
    try {
      const parsedValue: unknown = JSON.parse(data);
      if (!Array.isArray(parsedValue)) throw new Error('Rol verisi dizi değil');
      const parsed = parsedValue as Role[];
      // Sistem rolleri (role_doktor, role_personel) her zaman mevcut olmalı — silinmişse geri ekle
      const missing = DEFAULT_ROLES.filter(r => r.isSystem && !parsed.some(p => p.id === r.id));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        localStorage.setItem(KEYS.ROLES, JSON.stringify(merged));
        return merged;
      }
      return parsed;
    } catch {
      localStorage.setItem(KEYS.ROLES, JSON.stringify(DEFAULT_ROLES));
      return DEFAULT_ROLES;
    }
  },

  saveRoles: (roles: Role[]) => {
    localStorage.setItem(KEYS.ROLES, JSON.stringify(roles));
  },

  // Session Management
  login: (user: User) => {
    localStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
  },
  logout: () => {
    localStorage.removeItem(KEYS.CURRENT_USER);
  },
  getCurrentUser: (): User | null => {
    return readJson<User | null>(KEYS.CURRENT_USER, null);
  },

  // --- AUDIT LOGGING ---
  addLog: (user: User, action: string, details: string, opts?: { category?: LogCategory; severity?: LogSeverity }) => {
    const newLog: AuditLog = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      userId: user.id,
      username: user.username,
      action,
      details,
      timestamp: new Date().toISOString(),
      category: opts?.category,
      severity: opts?.severity
    };

    const logs = storageService.getLogs();
    // Keep only last 1000 logs to prevent storage overflow
    const updatedLogs = [newLog, ...logs].slice(0, 1000);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(updatedLogs));
  },

  getLogs: (): AuditLog[] => {
    return readJson<AuditLog[]>(KEYS.LOGS, []);
  },
  
  clearLogs: () => {
      localStorage.removeItem(KEYS.LOGS);
  }
};
