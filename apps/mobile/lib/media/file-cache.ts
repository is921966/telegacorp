/**
 * File-system based media cache for React Native.
 * Uses expo-file-system v55 class-based API (File, Directory, Paths).
 * Implements MediaCacheAdapter from @corp/shared for integration.
 */

import { File, Directory, Paths } from "expo-file-system";
import { setMediaCacheAdapter, type MediaCacheAdapter } from "@corp/shared";

const CACHE_DIR_NAME = "media-cache";

/**
 * Get or create the media cache directory.
 */
function getCacheDir(): Directory {
  return new Directory(Paths.cache, CACHE_DIR_NAME);
}

/**
 * Ensure cache directory exists.
 */
function ensureCacheDir(): void {
  const dir = getCacheDir();
  if (!dir.exists) {
    dir.create();
  }
}

/**
 * Generate a safe filename from a cache key.
 */
function keyToSafeFilename(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/**
 * Mobile media cache adapter — stores data URLs in text files.
 */
const mobileCacheAdapter: MediaCacheAdapter = {
  async getMediaFromIDB(key: string): Promise<string | null> {
    try {
      const file = new File(getCacheDir(), keyToSafeFilename(key));
      if (!file.exists) return null;
      return file.text();
    } catch {
      return null;
    }
  },

  async putMediaToIDB(key: string, dataUrl: string): Promise<void> {
    try {
      ensureCacheDir();
      const file = new File(getCacheDir(), keyToSafeFilename(key));
      file.write(dataUrl);
    } catch (err) {
      console.warn("[MediaCache] putMedia error:", err);
    }
  },

  async getVideoFromIDB(): Promise<{ blob: Blob; fileName: string; mimeType: string } | null> {
    // Video caching on mobile uses file URIs, not blobs
    return null;
  },

  async putVideoToIDB(): Promise<void> {
    // Video caching handled separately
  },
};

/**
 * Initialize the mobile media cache adapter.
 * Call this at app startup after platform init.
 */
export function initMobileMediaCache(): void {
  setMediaCacheAdapter(mobileCacheAdapter);
}

/**
 * Get a cached media file URI (for Image source).
 * Returns null if not cached.
 */
export function getCachedMediaUri(key: string): string | null {
  try {
    const file = new File(getCacheDir(), keyToSafeFilename(key));
    if (file.exists) return file.uri;
    return null;
  } catch {
    return null;
  }
}

/**
 * Save raw base64 bytes to the media cache and return the file URI.
 */
export function cacheMediaBase64(key: string, base64Data: string): string {
  ensureCacheDir();
  const file = new File(getCacheDir(), keyToSafeFilename(key));
  file.write(base64Data);
  return file.uri;
}

/**
 * Clear all cached media (for storage management).
 */
export function clearMediaCache(): void {
  try {
    const dir = getCacheDir();
    if (dir.exists) {
      dir.delete();
    }
  } catch (err) {
    console.warn("[MediaCache] clearCache error:", err);
  }
}
