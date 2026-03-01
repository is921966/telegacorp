/**
 * IndexedDB-backed media cache with LRU eviction.
 * Stores message media (photos, stickers, video thumbs) as data URLs.
 * Limit: ~100MB estimated via entry count (avg ~50KB per entry = ~2000 entries).
 */

const DB_NAME = "tg-media-cache";
const DB_VERSION = 1;
const STORE_NAME = "media";
const MAX_ENTRIES = 2000;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("accessedAt", "accessedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/** Get a cached media data URL by key (chatId:messageId). */
export async function getMediaFromIDB(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result;
        if (!result) {
          resolve(null);
          return;
        }
        // Update access time for LRU
        result.accessedAt = Date.now();
        store.put(result);
        resolve(result.dataUrl || null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Store a media data URL in IndexedDB. */
export async function putMediaToIDB(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ key, dataUrl, accessedAt: Date.now() });

    // Evict oldest entries if over limit
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_ENTRIES) {
        const toEvict = countReq.result - MAX_ENTRIES;
        const idx = store.index("accessedAt");
        const cursor = idx.openCursor();
        let evicted = 0;
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c && evicted < toEvict) {
            c.delete();
            evicted++;
            c.continue();
          }
        };
      }
    };
  } catch {
    // Non-critical
  }
}
