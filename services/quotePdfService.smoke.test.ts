import { describe, it, expect, vi, beforeEach } from 'vitest';

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

describe('pdfmake + Türkçe font', () => {
  it('Türkçe karakterli gerçek PDF buffer üretir', async () => {
    // Servis importu vfs'i kaydeder
    await import('./quotePdfService');
    const pdfMake = (await import('pdfmake/build/pdfmake')).default;

    const doc = pdfMake.createPdf({
      content: [{ text: 'Şık Türkçe İçerik — ğüşıöç ĞÜŞİÖÇ İMÅ' }]
    });

    const buf = await new Promise<Uint8Array>((resolve, reject) => {
      try {
        const maybePromise = (doc as { getBuffer: (cb?: (b: Uint8Array) => void) => unknown })
          .getBuffer((b: Uint8Array) => resolve(b));
        if (maybePromise && typeof (maybePromise as Promise<Uint8Array>).then === 'function') {
          (maybePromise as Promise<Uint8Array>).then(resolve, reject);
        }
      } catch (e) { reject(e); }
    });

    expect(buf.byteLength).toBeGreaterThan(1000);
    expect(String.fromCharCode(buf[0], buf[1], buf[2], buf[3])).toBe('%PDF');
  }, 20000);
});
