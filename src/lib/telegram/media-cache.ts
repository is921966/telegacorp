import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { getMediaFromIDB, putMediaToIDB } from "@/lib/idb-media-cache";

/** In-memory hot cache for instant access (session-only) */
const memoryCache = new Map<string, string>();

/** Set of keys currently being fetched */
const pendingDownloads = new Set<string>();

/** Convert a Buffer/Uint8Array to base64 string */
function bufferToBase64(buffer: Buffer | Uint8Array): string {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(buffer)) {
    return buffer.toString("base64");
  }
  // For Uint8Array in browser
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Download media for a message and return a data URL.
 * Two-tier cache: in-memory (fast) → IndexedDB (persistent, ~100MB LRU).
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
      buffer = await client.downloadMedia(msg.media, {}) as Buffer | Uint8Array | string | undefined;
      mime = "image/jpeg";
    } else if (msg.media instanceof Api.MessageMediaDocument) {
      const doc = (msg.media as Api.MessageMediaDocument).document;
      if (doc instanceof Api.Document) {
        mime = doc.mimeType || "application/octet-stream";

        // For stickers, download full file (they're small)
        const isSticker = doc.attributes?.some(
          (a) => a instanceof Api.DocumentAttributeSticker
        );
        // For videos, download thumbnail only
        const isVideo = doc.mimeType?.startsWith("video/");

        if (isVideo) {
          // Download thumbnail for video preview
          buffer = await client.downloadMedia(msg.media, {
            thumb: 0, // smallest thumb
          }) as Buffer | Uint8Array | string | undefined;
          mime = "image/jpeg";
        } else if (isSticker) {
          buffer = await client.downloadMedia(msg.media, {}) as Buffer | Uint8Array | string | undefined;
          // Stickers can be webp or tgs (animated)
          if (doc.mimeType === "application/x-tgsticker") {
            // Animated stickers — not supported as image, skip
            memoryCache.set(key, "");
            await putMediaToIDB(key, "");
            return null;
          }
        } else {
          // Regular documents — don't auto-download
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

    if (!buffer || (typeof buffer !== "string" && buffer.length === 0)) {
      memoryCache.set(key, "");
      await putMediaToIDB(key, "");
      return null;
    }

    let base64: string;
    if (typeof buffer === "string") {
      base64 = buffer;
    } else {
      base64 = bufferToBase64(buffer);
    }

    const dataUrl = base64.startsWith("data:")
      ? base64
      : `data:${mime};base64,${base64}`;

    // Store in both tiers
    memoryCache.set(key, dataUrl);
    await putMediaToIDB(key, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error("Failed to download media:", key, err);
    return null;
  } finally {
    pendingDownloads.delete(key);
  }
}

/**
 * Get cached media URL synchronously from hot cache.
 * For async lookup (includes IndexedDB), use downloadMessageMedia.
 */
export function getCachedMedia(chatId: string, messageId: number): string | undefined {
  return memoryCache.get(`${chatId}:${messageId}`) || undefined;
}

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
      // base64 string
      const binary = atob(buffer.replace(/^data:[^;]+;base64,/, ""));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      blob = new Blob([bytes], { type: mime });
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      blob = new Blob([buffer as any], { type: mime });
    }

    return { url: URL.createObjectURL(blob), fileName, mimeType: mime };
  } catch (err) {
    console.error("Document download failed:", chatId, messageId, err);
    return null;
  }
}
