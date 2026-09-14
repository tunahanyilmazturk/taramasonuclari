/**
 * IndexedDB tabanlı logo/imza saklama servisi.
 * Kurum logosu ve imza görüntüsü için kullanılır.
 * localStorage base64 limitlerini aşmamak için blob olarak IndexedDB'de tutulur.
 */

const DB_NAME = 'mediscan_assets';
const STORE_NAME = 'images';
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

/** Görsel blob'unu anahtar ile IndexedDB'ye kaydeder */
export const saveImage = async (key: string, file: File | Blob): Promise<void> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(file, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch (e) {
    console.warn('Görsel saklama başarısız:', e);
  }
};

/** Anahtarla saklanan görseli Blob olarak getirir */
export const getImage = async (key: string): Promise<Blob | null> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readonly');
    return new Promise((resolve, reject) => {
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  } catch {
    return null;
  }
};

/** Anahtarla saklanan görseli Object URL olarak getirir (img src için) */
export const getImageUrl = async (key: string): Promise<string | null> => {
  const blob = await getImage(key);
  if (!blob) return null;
  return URL.createObjectURL(blob);
};

/** Anahtarla saklanan görseli siler */
export const deleteImage = async (key: string): Promise<void> => {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  } catch {
    // sessiz geç
  }
};

/** Görseli dosyadan okuyup yeniden boyutlandırarak kaydeder (maks boyut kısıtlı) */
export const saveResizedImage = async (key: string, file: File, maxSize = 400): Promise<void> => {
  const blob = await resizeToBlob(file, maxSize);
  if (blob) await saveImage(key, blob);
};

/** File -> HTMLImageElement */
const loadImage = (file: File): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
  img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
  img.src = url;
});

/** Async resize — blob üretir */
export const resizeToBlob = async (file: File, maxSize = 400): Promise<Blob | null> => {
  const img = await loadImage(file);
  let { width, height } = img;
  if (width > maxSize || height > maxSize) {
    if (width > height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
};
