import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storageService, DEMO_ACCOUNTS } from './storageService';
import { DEFAULT_TESTS } from '../constants';
import { User } from '../types';

const createLocalStorageStub = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null
  };
};

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageStub());
});

describe('storageService', () => {
  it('boş depoda varsayılan test havuzunu döner', () => {
    expect(storageService.getTests()).toEqual(DEFAULT_TESTS);
  });

  it('testleri kaydedip geri okur', () => {
    const tests = [{ id: 'x', key: 'x', name: 'X', unit: 'u', type: 'numeric' as const }];
    storageService.saveTests(tests);
    expect(storageService.getTests()).toEqual(tests);
  });

  it('kayıtları kaydedip geri okur', () => {
    const records = [{ id: 'r1', companyId: 'c1', patientName: 'Test', date: '01.01.2024', fileName: 'f.pdf', results: {}, status: {} }];
    storageService.saveRecords(records);
    expect(storageService.getRecords()).toEqual(records);
  });

  it('kullanıcı listesi boşsa demo hesapları eker', () => {
    const users = storageService.getUsers();
    expect(users).toHaveLength(DEMO_ACCOUNTS.length);
    expect(users.map(u => u.username)).toContain('admin');
  });

  it('eksik demo hesabını mevcut listeye ekler', () => {
    const custom: User[] = [{ id: 'u1', username: 'ozel', password: 'h', fullName: 'Özel', role: 'user' }];
    storageService.saveUsers(custom);
    const users = storageService.getUsers();
    expect(users).toHaveLength(1 + DEMO_ACCOUNTS.length);
    expect(users.some(u => u.username === 'ozel')).toBe(true);
  });

  it('bozuk JSON durumunda demo hesaplara döner', () => {
    localStorage.setItem('mediscan_users', '{bozuk-json');
    expect(storageService.getUsers()).toEqual(DEMO_ACCOUNTS);
  });

  it('login → getCurrentUser → logout akışı çalışır', () => {
    const user: User = DEMO_ACCOUNTS[0];
    expect(storageService.getCurrentUser()).toBeNull();
    storageService.login(user);
    expect(storageService.getCurrentUser()).toEqual(user);
    storageService.logout();
    expect(storageService.getCurrentUser()).toBeNull();
  });

  it('addLog en yeni kaydı başa ekler', () => {
    const user = DEMO_ACCOUNTS[0];
    storageService.addLog(user, 'LOGIN', 'ilk');
    storageService.addLog(user, 'EXPORT', 'ikinci');
    const logs = storageService.getLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0].action).toBe('EXPORT');
    expect(logs[0].username).toBe('admin');
  });
});
