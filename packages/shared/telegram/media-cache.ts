import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { getMediaFromIDB, putMediaToIDB, getVideoFromIDB, putVideoToIDB } from "../adapters/media-cache";
import { isSlowConnection } from "../adapters/network";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Max concurrent media downloads — reduced on slow connection */
const MAX_CONCURRENT_FAST = 6;
const MAX_CONCURRENT_SLOW = 2;

// ---------------------------------------------------------------------------
// Caches
// ---------------------------------------------------------------------------

/** In-memory hot cache for instant access (session-only) */
const memoryCache = new Map<string, string>();

/** Separate cache for low-quality thumbnails (not persisted to IDB) */
const thumbCache = new Map<string, string>();

/** Cap thumbCache to prevent unbounded memory growth */
const MAX_THUMB_CACHE = 5000;
function capThumbCache() {
  if (thumbCache.size <= MAX_THUMB_CACHE) return;
  // Delete oldest 1000 entries (Map iterates in insertion order)
  const iter = thumbCache.keys();
  for (let i = 0; i < 1000; i++) {
    const next = iter.next();
    if (next.done) break;
    thumbCache.delete(next.value);
  }
}

/** In-memory cache for video blob URLs (session-only, max 10 for memory) */
const videoBlobUrlCache = new Map<string, { url: string; fileName: string; mimeType: string }>();
const MAX_VIDEO_MEMORY_ENTRIES = 10;

// ---------------------------------------------------------------------------
// Download semaphore — limits parallel downloads
// ---------------------------------------------------------------------------

let activeDownloads = 0;
const downloadQueue: Array<{ run: () => void }> = [];

function getMaxConcurrent(): number {
  return isSlowConnection() ? MAX_CONCURRENT_SLOW : MAX_CONCURRENT_FAST;
}

function enqueueDownload<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeDownloads++;
      fn()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          activeDownloads--;
          drainQueue();
        });
    };

    if (activeDownloads < getMaxConcurrent()) {
      run();
    } else {
      downloadQueue.push({ run });
    }
  });
}

function drainQueue() {
  while (downloadQueue.length > 0 && activeDownloads < getMaxConcurrent()) {
    const next = downloadQueue.shift();
    next?.run();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set of keys currently being fetched (dedup guard) */
const pendingDownloads = new Set<string>();

/** Convert a Buffer/Uint8Array to base64 data URL */
function bufferToDataUrl(buffer: Buffer | Uint8Array | string, mime: string): string {
  if (typeof buffer === "string") {
    return buffer.startsWith("data:") ? buffer : `data:${mime};base64,${buffer}`;
  }
  let binary = "";
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

// ---------------------------------------------------------------------------
// 1. Progressive thumbnail — tiny blurred preview (~1-3 KB)
// ---------------------------------------------------------------------------

/**
 * Download the smallest available thumbnail for a photo message.
 * Returns a tiny data URL suitable for a blurred placeholder.
 * This is very fast (~1-3 KB) and runs outside the semaphore.
 */
export async function downloadThumb(
  client: TelegramClient,
  chatId: string,
  messageId: number
): Promise<string | null> {
  const key = `${chatId}:${messageId}`;

  // Already have thumb
  const cached = thumbCache.get(key);
  if (cached) return cached;

  // If full quality already cached, skip thumb
  if (memoryCache.has(key)) return memoryCache.get(key) || null;

  // Tier 2: IDB persistent cache (survives page reload)
  const idbCached = await getMediaFromIDB(key);
  if (idbCached) {
    thumbCache.set(key, idbCached);
    capThumbCache();
    return idbCached;
  }

  try {
    const msgs = await client.getMessages(chatId, { ids: [messageId] });
    const msg = msgs[0];
    if (!msg || !(msg instanceof Api.Message) || !msg.media) return null;

    // Extract inline stripped thumb bytes from photo sizes
    if (msg.media instanceof Api.MessageMediaPhoto) {
      const photo = (msg.media as Api.MessageMediaPhoto).photo;
      if (photo instanceof Api.Photo && photo.sizes) {
        // Look for PhotoStrippedSize (type "i") — embedded ~100-300 bytes
        const stripped = photo.sizes.find(
          (s) => s instanceof Api.PhotoStrippedSize
        ) as Api.PhotoStrippedSize | undefined;

        if (stripped && stripped.bytes) {
          // PhotoStrippedSize bytes are JPEG-like with a special header
          // GramJS provides them as raw bytes we can wrap as JPEG
          const thumbUrl = bufferToDataUrl(stripped.bytes as Buffer, "image/jpeg");
          thumbCache.set(key, thumbUrl);
          capThumbCache();
          putMediaToIDB(key, thumbUrl).catch(() => {});
          return thumbUrl;
        }

        // Fallback: download smallest PhotoSize (type "s" or "m")
        const buffer = await client.downloadMedia(msg.media, {
          thumb: 0, // smallest thumb index
        }) as Buffer | Uint8Array | string | undefined;
        if (buffer && (typeof buffer === "string" || (buffer as Uint8Array).length > 0)) {
          const thumbUrl = bufferToDataUrl(buffer as Buffer, "image/jpeg");
          thumbCache.set(key, thumbUrl);
          capThumbCache();
          putMediaToIDB(key, thumbUrl).catch(() => {});
          return thumbUrl;
        }
      }
    }

    // For videos — download the highest-quality non-stripped thumbnail
    // so the preview appears sharp (not blurred) immediately.
    // IMPORTANT: pass the actual PhotoSize object to GramJS, not just an index —
    // passing an index can result in downloading the wrong (tiny) thumbnail.
    if (msg.media instanceof Api.MessageMediaDocument) {
      const doc = (msg.media as Api.MessageMediaDocument).document;
      if (doc instanceof Api.Document && doc.mimeType?.startsWith("video/")) {
        let bestThumb: (typeof doc.thumbs extends (infer T)[] | undefined ? T : never) | undefined;
        if (doc.thumbs && doc.thumbs.length > 0) {
          for (let i = doc.thumbs.length - 1; i >= 0; i--) {
            if (!(doc.thumbs[i] instanceof Api.PhotoStrippedSize)) {
              bestThumb = doc.thumbs[i];
              break;
            }
          }
        }
        const buffer = await client.downloadMedia(msg.media, {
          thumb: bestThumb || 0,
        }) as Buffer | Uint8Array | string | undefined;
        if (buffer && (typeof buffer === "string" || (buffer as Uint8Array).length > 0)) {
          const thumbUrl = bufferToDataUrl(buffer as Buffer, "image/jpeg");
          thumbCache.set(key, thumbUrl);
          capThumbCache();
          putMediaToIDB(key, thumbUrl).catch(() => {});
          return thumbUrl;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Full-quality media download (with semaphore + adaptive quality)
// ---------------------------------------------------------------------------

/**
 * Download media for a message and return a data URL.
 * Two-tier cache: in-memory (fast) → IndexedDB (persistent, ~100MB LRU).
 * Uses download semaphore and adaptive quality.
 */
export async function downloadMessageMedia(
  client: TelegramClient,
  chatId: string,
  messageId: number
): Promise<string | null> {
  const key = `${chatId}:${messageId}`;

  // Tier 1: in-memory hot cache
  const memCached = memoryCache.get(key);
  if (memCached !== undefined) return memCached || null;

  // Tier 2: IndexedDB persistent cache
  const idbCached = await getMediaFromIDB(key);
  if (idbCached !== null) {
    memoryCache.set(key, idbCached);
    return idbCached || null;
  }

  if (pendingDownloads.has(key)) return null;
  pendingDownloads.add(key);

  try {
    return await enqueueDownload(async () => {
      const msgs = await client.getMessages(chatId, { ids: [messageId] });
      const msg = msgs[0];
      if (!msg || !(msg instanceof Api.Message) || !msg.media) {
        memoryCache.set(key, "");
        await putMediaToIDB(key, "");
        return null;
      }

      let buffer: Buffer | Uint8Array | string | undefined;
      let mime = "image/jpeg";

      if (msg.media instanceof Api.MessageMediaPhoto) {
        const slow = isSlowConnection();
        if (slow) {
          // On slow connection: download medium-size thumb instead of full photo
          buffer = await client.downloadMedia(msg.media, {
            thumb: 1, // medium quality
          }) as Buffer | Uint8Array | string | undefined;
        } else {
          buffer = await client.downloadMedia(msg.media, {}) as Buffer | Uint8Array | string | undefined;
        }
        mime = "image/jpeg";
      } else if (msg.media instanceof Api.MessageMediaDocument) {
        const doc = (msg.media as Api.MessageMediaDocument).document;
        if (doc instanceof Api.Document) {
          mime = doc.mimeType || "application/octet-stream";

          const isSticker = doc.attributes?.some(
            (a) => a instanceof Api.DocumentAttributeSticker
          );
          const isVideo = doc.mimeType?.startsWith("video/");

          if (isVideo) {
            // Pick the largest non-stripped thumbnail for clear preview.
            // Pass the actual PhotoSize object to GramJS (not index).
            let vidBestThumb: (typeof doc.thumbs extends (infer T)[] | undefined ? T : never) | undefined;
            if (doc.thumbs && doc.thumbs.length > 0) {
              for (let i = doc.thumbs.length - 1; i >= 0; i--) {
                if (!(doc.thumbs[i] instanceof Api.PhotoStrippedSize)) {
                  vidBestThumb = doc.thumbs[i];
                  break;
                }
              }
            }
            buffer = await client.downloadMedia(msg.media, {
              thumb: vidBestThumb || 0,
            }) as Buffer | Uint8Array | string | undefined;
            mime = "image/jpeg";
          } else if (isSticker) {
            if (doc.mimeType === "application/x-tgsticker") {
              memoryCache.set(key, "");
              await putMediaToIDB(key, "");
              return null;
            }
            buffer = await client.downloadMedia(msg.media, {}) as Buffer | Uint8Array | string | undefined;
          } else {
            memoryCache.set(key, "");
            await putMediaToIDB(key, "");
            return null;
          }
        }
      } else {
        memoryCache.set(key, "");
        await putMediaToIDB(key, "");
        return null;
      }

      if (!buffer || (typeof buffer !== "string" && (buffer as Uint8Array).length === 0)) {
        memoryCache.set(key, "");
        await putMediaToIDB(key, "");
        return null;
      }

      const dataUrl = bufferToDataUrl(buffer as Buffer, mime);

      memoryCache.set(key, dataUrl);
      await putMediaToIDB(key, dataUrl);
      return dataUrl;
    });
  } catch (err) {
    console.error("Failed to download media:", key, err);
    return null;
  } finally {
    pendingDownloads.delete(key);
  }
}

// ---------------------------------------------------------------------------
// 3. Sync cache lookup
// ---------------------------------------------------------------------------

/**
 * Get cached media URL synchronously from hot cache.
 * For async lookup (includes IndexedDB), use downloadMessageMedia.
 */
export function getCachedMedia(chatId: string, messageId: number): string | undefined {
  return memoryCache.get(`${chatId}:${messageId}`) || undefined;
}

/** Get cached thumbnail synchronously */
export function getCachedThumb(chatId: string, messageId: number): string | undefined {
  return thumbCache.get(`${chatId}:${messageId}`) || undefined;
}

// ---------------------------------------------------------------------------
// 4. Full document download (on-demand, for files/video playback)
// ---------------------------------------------------------------------------

/** Evict oldest entry from videoBlobUrlCache when over limit */
function evictVideoMemoryCache() {
  if (videoBlobUrlCache.size <= MAX_VIDEO_MEMORY_ENTRIES) return;
  const firstKey = videoBlobUrlCache.keys().next().value;
  if (firstKey) {
    const entry = videoBlobUrlCache.get(firstKey);
    if (entry) URL.revokeObjectURL(entry.url);
    videoBlobUrlCache.delete(firstKey);
  }
}

/**
 * Download a document/file on demand and return a Blob URL for viewing/saving.
 * Videos use iterDownload for per-chunk progress and lower peak memory.
 * Videos are cached in IDB (as Blob) and in-memory (as blob URL).
 */
export async function downloadDocumentFile(
  client: TelegramClient,
  chatId: string,
  messageId: number,
  onProgress?: (received: number, total: number) => void
): Promise<{ url: string; fileName: string; mimeType: string } | null> {
  const key = `${chatId}:${messageId}`;

  // Tier 1: in-memory video blob URL cache
  const memCached = videoBlobUrlCache.get(key);
  if (memCached) return memCached;

  // Tier 2: IDB video blob cache
  const idbCached = await getVideoFromIDB(key);
  if (idbCached) {
    const url = URL.createObjectURL(idbCached.blob);
    const entry = { url, fileName: idbCached.fileName, mimeType: idbCached.mimeType };
    videoBlobUrlCache.set(key, entry);
    evictVideoMemoryCache();
    return entry;
  }

  try {
    return await enqueueDownload(async () => {
      // Re-check caches after waiting in queue
      const memCached2 = videoBlobUrlCache.get(key);
      if (memCached2) return memCached2;

      const msgs = await client.getMessages(chatId, { ids: [messageId] });
      const msg = msgs[0];
      if (!msg || !(msg instanceof Api.Message) || !msg.media) return null;

      let mime = "application/octet-stream";
      let fileName = "file";

      if (msg.media instanceof Api.MessageMediaDocument) {
        const doc = (msg.media as Api.MessageMediaDocument).document;
        if (doc instanceof Api.Document) {
          mime = doc.mimeType || mime;
          const nameAttr = doc.attributes?.find(
            (a) => a instanceof Api.DocumentAttributeFilename
          ) as Api.DocumentAttributeFilename | undefined;
          if (nameAttr) fileName = nameAttr.fileName;
        }
      } else if (msg.media instanceof Api.MessageMediaPhoto) {
        mime = "image/jpeg";
        fileName = `photo_${messageId}.jpg`;
      }

      const isVideo = mime.startsWith("video/");
      let blob: Blob;

      if (isVideo && msg.media instanceof Api.MessageMediaDocument) {
        // Use iterDownload for chunk-by-chunk progress and lower peak RAM
        const { downloadVideoAsBlob } = await import("./media");
        const result = await downloadVideoAsBlob(client, msg.media, onProgress);
        if (!result) return null;
        blob = result.blob;
        mime = result.mimeType;
      } else {
        // Non-video: use existing downloadMedia path
        const buffer = await client.downloadMedia(msg.media, {
          progressCallback: onProgress
            ? (progress: number) => onProgress(Math.round(progress * 100), 100)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : undefined as any,
        });
        if (!buffer) return null;

        if (typeof buffer === "string") {
          const binary = atob(buffer.replace(/^data:[^;]+;base64,/, ""));
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          blob = new Blob([bytes], { type: mime });
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          blob = new Blob([buffer as any], { type: mime });
        }
      }

      const url = URL.createObjectURL(blob);
      const entry = { url, fileName, mimeType: mime };

      // Cache video blobs in IDB and memory
      if (isVideo) {
        videoBlobUrlCache.set(key, entry);
        evictVideoMemoryCache();
        putVideoToIDB(key, blob, fileName, mime).catch(() => {});
      }

      return entry;
    });
  } catch (err) {
    console.error("Document download failed:", chatId, messageId, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 5. Video preloading (background, on viewport visibility)
// ---------------------------------------------------------------------------

const preloadingSet = new Set<string>();

/**
 * Preload a video when its thumbnail becomes visible.
 * Downloads full video in chunks, caches in IDB for instant future access.
 * Returns blob URL for auto-play.
 *
 * Note: MediaSource progressive streaming is not feasible for Telegram videos
 * because most have the moov atom at end-of-file (no faststart), which means
 * codec info is unavailable until the entire file is downloaded.
 */
export async function preloadVideoStart(
  client: TelegramClient,
  chatId: string,
  messageId: number
): Promise<string | null> {
  if (isSlowConnection()) return null;

  const key = `${chatId}:${messageId}`;
  const existing = videoBlobUrlCache.get(key);
  if (existing) return existing.url;
  if (preloadingSet.has(key)) return null;

  const idbCached = await getVideoFromIDB(key);
  if (idbCached) {
    const url = URL.createObjectURL(idbCached.blob);
    videoBlobUrlCache.set(key, {
      url,
      fileName: idbCached.fileName,
      mimeType: idbCached.mimeType,
    });
    evictVideoMemoryCache();
    return url;
  }

  preloadingSet.add(key);
  try {
    const msgs = await client.getMessages(chatId, { ids: [messageId] });
    const msg = msgs[0];
    if (!msg || !(msg instanceof Api.Message) || !msg.media) return null;
    if (!(msg.media instanceof Api.MessageMediaDocument)) return null;

    const doc = (msg.media as Api.MessageMediaDocument).document;
    if (!(doc instanceof Api.Document)) return null;
    if (!doc.mimeType?.startsWith("video/")) return null;

    const PRELOAD_BUDGET = 50 * 1024 * 1024;
    const totalSize = Number(doc.size ?? Infinity);
    if (totalSize > PRELOAD_BUDGET) return null;

    const chunks: Uint8Array[] = [];
    let bytesReceived = 0;
    const iter = client.iterDownload({
      file: msg.media,
      requestSize: 512 * 1024,
    });
    for await (const chunk of iter) {
      chunks.push(new Uint8Array(chunk));
      bytesReceived += chunk.length;
      if (bytesReceived >= PRELOAD_BUDGET) break;
    }
    if (bytesReceived >= totalSize) {
      const blob = new Blob(chunks as BlobPart[], { type: doc.mimeType });
      const fileName =
        (
          doc.attributes?.find(
            (a) => a instanceof Api.DocumentAttributeFilename
          ) as Api.DocumentAttributeFilename | undefined
        )?.fileName || "video";
      await putVideoToIDB(key, blob, fileName, doc.mimeType);
      const url = URL.createObjectURL(blob);
      videoBlobUrlCache.set(key, { url, fileName, mimeType: doc.mimeType });
      evictVideoMemoryCache();
      return url;
    }

    return null;
  } catch (err) {
    console.error("[preloadVideo] error:", key, err);
    return null;
  } finally {
    preloadingSet.delete(key);
  }
}

/**
 * Get cached video blob URL (from memory or IDB).
 * Returns URL immediately if cached, otherwise null.
 * Used for auto-play: if preloadVideoStart has cached a small video,
 * this returns its blob URL without triggering a new download.
 */
export async function getCachedVideoUrl(
  chatId: string,
  messageId: number
): Promise<string | null> {
  const key = `${chatId}:${messageId}`;

  // Tier 1: in-memory
  const mem = videoBlobUrlCache.get(key);
  if (mem) return mem.url;

  // Tier 2: IDB
  const idb = await getVideoFromIDB(key);
  if (idb) {
    const url = URL.createObjectURL(idb.blob);
    videoBlobUrlCache.set(key, { url, fileName: idb.fileName, mimeType: idb.mimeType });
    evictVideoMemoryCache();
    return url;
  }

  return null;
}
