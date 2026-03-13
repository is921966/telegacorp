/**
 * Media cache adapter — platform-specific implementations must be injected.
 *
 * Web: IndexedDB (idb-media-cache.ts)
 * Mobile: expo-file-system + AsyncStorage
 */

export interface MediaCacheAdapter {
  getMediaFromIDB: (key: string) => Promise<string | null>;
  putMediaToIDB: (key: string, dataUrl: string) => Promise<void>;
  getVideoFromIDB: (key: string) => Promise<{ blob: Blob; fileName: string; mimeType: string } | null>;
  putVideoToIDB: (key: string, blob: Blob, fileName: string, mimeType: string) => Promise<void>;
}

/** No-op adapter (used if platform doesn't inject one) */
const noopAdapter: MediaCacheAdapter = {
  getMediaFromIDB: async () => null,
  putMediaToIDB: async () => {},
  getVideoFromIDB: async () => null,
  putVideoToIDB: async () => {},
};

let _adapter: MediaCacheAdapter = noopAdapter;

export function setMediaCacheAdapter(adapter: MediaCacheAdapter): void {
  _adapter = adapter;
}

export function getMediaFromIDB(key: string): Promise<string | null> {
  return _adapter.getMediaFromIDB(key);
}

export function putMediaToIDB(key: string, dataUrl: string): Promise<void> {
  return _adapter.putMediaToIDB(key, dataUrl);
}

export function getVideoFromIDB(
  key: string
): Promise<{ blob: Blob; fileName: string; mimeType: string } | null> {
  return _adapter.getVideoFromIDB(key);
}

export function putVideoToIDB(
  key: string,
  blob: Blob,
  fileName: string,
  mimeType: string
): Promise<void> {
  return _adapter.putVideoToIDB(key, blob, fileName, mimeType);
}
