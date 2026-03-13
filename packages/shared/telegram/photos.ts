import type { TelegramClient } from "telegram";
import { useAvatarsStore } from "../store/avatars";

/** Set of entity IDs currently being fetched (prevents duplicate requests) */
const pendingFetches = new Set<string>();

/**
 * Image compression adapter.
 * Web: uses Canvas API, Mobile: uses expo-image-manipulator or skips.
 */
let _compressAvatar: (dataUrl: string) => Promise<string> = (dataUrl) =>
  Promise.resolve(dataUrl);

export function setAvatarCompressor(
  compressor: (dataUrl: string) => Promise<string>
): void {
  _compressAvatar = compressor;
}

/**
 * Compress a data URL avatar to reduce storage size.
 * Uses platform-injected compressor if available.
 */
function compressAvatar(dataUrl: string): Promise<string> {
  return _compressAvatar(dataUrl);
}

/**
 * Download a profile photo for a given entity ID and cache it.
 * Returns a data URL string or null if no photo available.
 */
export async function downloadAvatar(
  client: TelegramClient,
  entityId: string
): Promise<string | null> {
  const store = useAvatarsStore.getState();

  // Return from persistent cache immediately
  const cached = store.avatars[entityId];
  if (cached !== undefined) {
    return cached || null;
  }

  // Prevent duplicate concurrent fetches
  if (pendingFetches.has(entityId)) {
    return null;
  }

  pendingFetches.add(entityId);

  try {
    const entity = await client.getEntity(entityId);
    const buffer = await client.downloadProfilePhoto(entity, {
      isBig: false,
    });

    if (buffer && buffer.length > 0) {
      // Convert Buffer to base64 data URL
      let base64: string;
      if (typeof buffer === "string") {
        base64 = buffer; // already base64 string
      } else {
        base64 = bufferToBase64(buffer);
      }
      const rawUrl = base64.startsWith("data:")
        ? base64
        : `data:image/jpeg;base64,${base64}`;
      // Compress to 80x80 JPEG to save localStorage space (~10x smaller)
      const dataUrl = await compressAvatar(rawUrl);
      useAvatarsStore.getState().setAvatar(entityId, dataUrl);
      return dataUrl;
    }

    // No photo — cache empty string to avoid re-fetching
    useAvatarsStore.getState().setAvatar(entityId, "");
    return null;
  } catch {
    // Entity not found or download failed — don't cache to allow retry
    return null;
  } finally {
    pendingFetches.delete(entityId);
  }
}

/**
 * Get a cached avatar URL synchronously (no API call).
 * Returns the data URL, empty string (no photo), or undefined (not cached yet).
 */
export function getCachedAvatar(entityId: string): string | undefined {
  return useAvatarsStore.getState().avatars[entityId];
}

/**
 * Load avatars for multiple entity IDs in parallel with concurrency limit.
 * Calls onUpdate whenever a new photo is ready.
 */
export async function loadAvatarsBatch(
  client: TelegramClient,
  entityIds: string[],
  onUpdate: () => void,
  concurrency = 5
): Promise<void> {
  const { avatars } = useAvatarsStore.getState();
  // Filter to only IDs that aren't cached yet
  const uncached = entityIds.filter((id) => avatars[id] === undefined);
  if (uncached.length === 0) return;

  // Process in batches
  for (let i = 0; i < uncached.length; i += concurrency) {
    const batch = uncached.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map(async (id) => {
        const result = await downloadAvatar(client, id);
        if (result) {
          onUpdate();
        }
      })
    );
  }
}

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
