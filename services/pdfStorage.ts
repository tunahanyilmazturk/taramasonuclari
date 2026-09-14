/**
 * IndexedDB tabanlı PDF saklama servisi.
 * localStorage 5-10MB limitini aşan PDF dosyaları için IndexedDB kullanılır.
 * Kayıt ID'si anahtar olarak kullanılır — her kayıtla ilişkili orijinal PDF saklanır.
 */

const DB_NAME = 'mediscan_pdfs';
const STORE_NAME = 'pdfs';
const DB_VERSION = 1;

const openDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

/** PDF blob'unu kayıt ID'si ile IndexedDB'ye kaydeder */
export const savePdf = async (recordId: string, file: File): Promise<void> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, recordId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn('PDF saklama başarısız:', e);
  }
};

/** Kayıt ID'siyle saklanan PDF'i Blob olarak getirir */
export const getPdf = async (recordId: string): Promise<Blob | null> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(STORE_NAME).get(recordId);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return null;
  }
};

/** Kayıt ID'siyle saklanan PDF'i siler */
export const deletePdf = async (recordId: string): Promise<void> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(recordId);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // sessiz geç
  }
};

/** PDF'i yeni sekmede açar — Blob URL oluşturup window.open yapar */
export const openPdfInNewTab = async (recordId: string, fileName?: string): Promise<boolean> => {
  const blob = await getPdf(recordId);
  if (!blob) return false;
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    // Popup engellenmişse — link oluştur ve tıkla
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.download = fileName || `${recordId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  // URL'i bir süre sonra serbest bırak
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return true;
};
