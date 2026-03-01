import type { TelegramClient } from "telegram";
import { Api } from "telegram";

/** In-memory cache for downloaded media data URLs */
const mediaCache = new Map<string, string>();

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
 * Results are cached in memory.
 */
export async function downloadMessageMedia(
  client: TelegramClient,
  chatId: string,
  messageId: number
): Promise<string | null> {
  const key = `${chatId}:${messageId}`;

  const cached = mediaCache.get(key);
  if (cached !== undefined) return cached || null;

  if (pendingDownloads.has(key)) return null;
  pendingDownloads.add(key);

  try {
    const msgs = await client.getMessages(chatId, { ids: [messageId] });
    const msg = msgs[0];
    if (!msg || !(msg instanceof Api.Message) || !msg.media) {
      mediaCache.set(key, "");
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
            mediaCache.set(key, "");
            return null;
          }
        } else {
          // Regular documents — don't auto-download
          mediaCache.set(key, "");
          return null;
        }
      }
    } else {
      mediaCache.set(key, "");
      return null;
    }

    if (!buffer || (typeof buffer !== "string" && buffer.length === 0)) {
      mediaCache.set(key, "");
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
    mediaCache.set(key, dataUrl);
    return dataUrl;
  } catch (err) {
    console.error("Failed to download media:", key, err);
    return null;
  } finally {
    pendingDownloads.delete(key);
  }
}

/**
 * Get cached media URL synchronously. Returns undefined if not cached.
 */
export function getCachedMedia(chatId: string, messageId: number): string | undefined {
  return mediaCache.get(`${chatId}:${messageId}`) || undefined;
}
