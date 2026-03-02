import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { getMediaFromIDB, putMediaToIDB } from "@/lib/idb-media-cache";
import { isSlowConnection } from "@/lib/network";

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
          return thumbUrl;
        }

        // Fallback: download smallest PhotoSize (type "s" or "m")
        const buffer = await client.downloadMedia(msg.media, {
          thumb: 0, // smallest thumb index
        }) as Buffer | Uint8Array | string | undefined;
        if (buffer && (typeof buffer === "string" || (buffer as Uint8Array).length > 0)) {
          const thumbUrl = bufferToDataUrl(buffer as Buffer, "image/jpeg");
          thumbCache.set(key, thumbUrl);
          return thumbUrl;
        }
      }
    }

    // For videos — download thumb (already fast, reuse existing logic)
    if (msg.media instanceof Api.MessageMediaDocument) {
      const doc = (msg.media as Api.MessageMediaDocument).document;
      if (doc instanceof Api.Document && doc.mimeType?.startsWith("video/")) {
        const buffer = await client.downloadMedia(msg.media, {
          thumb: 0,
        }) as Buffer | Uint8Array | string | undefined;
        if (buffer && (typeof buffer === "string" || (buffer as Uint8Array).length > 0)) {
          const thumbUrl = bufferToDataUrl(buffer as Buffer, "image/jpeg");
          thumbCache.set(key, thumbUrl);
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
            buffer = await client.downloadMedia(msg.media, {
              thumb: 0,
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

/**
 * Download a document/file on demand and return a Blob URL for viewing/saving.
 * Unlike downloadMessageMedia, this downloads the FULL file (not just thumbnail).
 */
export async function downloadDocumentFile(
  client: TelegramClient,
  chatId: string,
  messageId: number,
  onProgress?: (received: number, total: number) => void
): Promise<{ url: string; fileName: string; mimeType: string } | null> {
  try {
    return await enqueueDownload(async () => {
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

      const buffer = await client.downloadMedia(msg.media, {
        progressCallback: onProgress
          ? (progress: number) => onProgress(Math.round(progress * 100), 100)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : undefined as any,
      });

      if (!buffer) return null;

      let blob: Blob;
      if (typeof buffer === "string") {
        const binary = atob(buffer.replace(/^data:[^;]+;base64,/, ""));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blob = new Blob([bytes], { type: mime });
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        blob = new Blob([buffer as any], { type: mime });
      }

      return { url: URL.createObjectURL(blob), fileName, mimeType: mime };
    });
  } catch (err) {
    console.error("Document download failed:", chatId, messageId, err);
    return null;
  }
}
