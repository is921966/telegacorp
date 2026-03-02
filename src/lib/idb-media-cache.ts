/**
 * IndexedDB-backed media cache with LRU eviction.
 * Two stores:
 *   - "media": thumbnails/photos as data URL strings (~50KB each, 2000 max)
 *   - "video-blobs": full video files as Blob objects (~10MB each, 50 max)
 */

const DB_NAME = "tg-media-cache";
const DB_VERSION = 2;
const STORE_NAME = "media";
const VIDEO_STORE_NAME = "video-blobs";
const MAX_ENTRIES = 2000;
const MAX_VIDEO_ENTRIES = 50;

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
      if (!db.objectStoreNames.contains(VIDEO_STORE_NAME)) {
        const vStore = db.createObjectStore(VIDEO_STORE_NAME, { keyPath: "key" });
        vStore.createIndex("accessedAt", "accessedAt", { unique: false });
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

// ---------------------------------------------------------------------------
// Thumbnail / photo cache (data URL strings)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Video blob cache (stores actual Blob objects, not base64)
// ---------------------------------------------------------------------------

export interface VideoCacheEntry {
  blob: Blob;
  fileName: string;
  mimeType: string;
}

/** Store a video Blob in IDB with LRU eviction. */
export async function putVideoToIDB(
  key: string,
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(VIDEO_STORE_NAME, "readwrite");
    const store = tx.objectStore(VIDEO_STORE_NAME);
    store.put({ key, blob, fileName, mimeType, accessedAt: Date.now() });

    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_VIDEO_ENTRIES) {
        const toEvict = countReq.result - MAX_VIDEO_ENTRIES;
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

/** Retrieve a video Blob from IDB. Returns null if not cached. */
export async function getVideoFromIDB(key: string): Promise<VideoCacheEntry | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(VIDEO_STORE_NAME, "readwrite");
      const store = tx.objectStore(VIDEO_STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result;
        if (!result || !(result.blob instanceof Blob)) {
          resolve(null);
          return;
        }
        // Update access time for LRU
        result.accessedAt = Date.now();
        store.put(result);
        resolve({
          blob: result.blob,
          fileName: result.fileName || "video",
          mimeType: result.mimeType || "video/mp4",
        });
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
