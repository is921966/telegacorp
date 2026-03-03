/**
 * Upload Manager (TZ Section 8)
 *
 * Handles chunked upload to Telegram via MTProto:
 * - upload.saveFilePart / upload.saveBigFilePart
 * - Resume support with local manifest (IndexedDB)
 * - Retry with exponential backoff + jitter
 * - Progress reporting per chunk
 * - Cancellation via AbortSignal
 *
 * Parameters (TZ 8.2 — bad network):
 * - Parallelism: 1
 * - Chunk size: 128 KB (64-256 KB range)
 * - Chunk timeout: 30 sec
 * - Retries: up to 10 per chunk
 * - Backoff: exponential, 1s start, 30s ceiling, 20% jitter
 */

import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { getUploadParams, recordChunkMeasurement } from "@/lib/network-profiler";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadManifest {
  /** Local unique upload ID */
  localUploadId: string;
  /** Telegram file_id assigned by the API */
  fileId: bigint;
  /** Total file size in bytes */
  totalSize: number;
  /** Total number of parts */
  totalParts: number;
  /** Chunk size used (must be consistent across resume) */
  chunkSize: number;
  /** Set of confirmed part indices (0-based) */
  confirmedParts: Set<number>;
  /** Whether this is a "big file" (>10MB uses saveBigFilePart) */
  isBigFile: boolean;
  /** Timestamp of last activity */
  lastUpdated: number;
}

export interface UploadResult {
  /** Telegram InputFile for use in media messages */
  inputFile: Api.InputFile | Api.InputFileBig;
  /** Total size uploaded */
  totalSize: number;
  /** Number of parts */
  totalParts: number;
  /** Total chunk retries */
  totalRetries: number;
  /** Whether any parts were resumed */
  wasResumed: boolean;
  /** Upload duration in ms */
  durationMs: number;
  /** Average upload speed bytes/sec */
  avgSpeed: number;
}

type ProgressCallback = (uploaded: number, total: number) => void;

// ---------------------------------------------------------------------------
// IndexedDB manifest persistence for resume (TZ 8.1)
// ---------------------------------------------------------------------------

const MANIFEST_DB = "tg-upload-manifests";
const MANIFEST_STORE = "manifests";
const MANIFEST_DATA_STORE = "data"; // stores the actual file data for resume

let manifestDbPromise: Promise<IDBDatabase> | null = null;

function openManifestDB(): Promise<IDBDatabase> {
  if (manifestDbPromise) return manifestDbPromise;

  manifestDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = indexedDB.open(MANIFEST_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MANIFEST_STORE)) {
        db.createObjectStore(MANIFEST_STORE, { keyPath: "localUploadId" });
      }
      if (!db.objectStoreNames.contains(MANIFEST_DATA_STORE)) {
        db.createObjectStore(MANIFEST_DATA_STORE, { keyPath: "localUploadId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      manifestDbPromise = null;
      reject(req.error);
    };
  });

  return manifestDbPromise;
}

async function saveManifest(manifest: UploadManifest): Promise<void> {
  try {
    const db = await openManifestDB();
    const tx = db.transaction(MANIFEST_STORE, "readwrite");
    const store = tx.objectStore(MANIFEST_STORE);
    store.put({
      localUploadId: manifest.localUploadId,
      fileId: manifest.fileId.toString(),
      totalSize: manifest.totalSize,
      totalParts: manifest.totalParts,
      chunkSize: manifest.chunkSize,
      confirmedParts: Array.from(manifest.confirmedParts),
      isBigFile: manifest.isBigFile,
      lastUpdated: Date.now(),
    });
  } catch {
    // Non-critical: resume just won't work
  }
}

async function loadManifest(localUploadId: string): Promise<UploadManifest | null> {
  try {
    const db = await openManifestDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MANIFEST_STORE, "readonly");
      const store = tx.objectStore(MANIFEST_STORE);
      const req = store.get(localUploadId);
      req.onsuccess = () => {
        const data = req.result;
        if (!data) { resolve(null); return; }
        resolve({
          localUploadId: data.localUploadId,
          fileId: BigInt(data.fileId),
          totalSize: data.totalSize,
          totalParts: data.totalParts,
          chunkSize: data.chunkSize,
          confirmedParts: new Set(data.confirmedParts || []),
          isBigFile: data.isBigFile,
          lastUpdated: data.lastUpdated,
        });
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function deleteManifest(localUploadId: string): Promise<void> {
  try {
    const db = await openManifestDB();
    const tx = db.transaction([MANIFEST_STORE, MANIFEST_DATA_STORE], "readwrite");
    tx.objectStore(MANIFEST_STORE).delete(localUploadId);
    tx.objectStore(MANIFEST_DATA_STORE).delete(localUploadId);
  } catch {
    // Non-critical
  }
}

async function saveUploadData(localUploadId: string, data: Uint8Array): Promise<void> {
  try {
    const db = await openManifestDB();
    const tx = db.transaction(MANIFEST_DATA_STORE, "readwrite");
    tx.objectStore(MANIFEST_DATA_STORE).put({
      localUploadId,
      data: data.buffer,
    });
  } catch {
    // Non-critical
  }
}

async function loadUploadData(localUploadId: string): Promise<Uint8Array | null> {
  try {
    const db = await openManifestDB();
    return new Promise((resolve) => {
      const tx = db.transaction(MANIFEST_DATA_STORE, "readonly");
      const req = tx.objectStore(MANIFEST_DATA_STORE).get(localUploadId);
      req.onsuccess = () => {
        const result = req.result;
        if (!result?.data) { resolve(null); return; }
        resolve(new Uint8Array(result.data));
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Core upload logic
// ---------------------------------------------------------------------------

/**
 * Upload a file to Telegram in chunks with resume support (TZ Section 8).
 *
 * @param client - GramJS TelegramClient
 * @param data - File data as Uint8Array
 * @param fileName - File name
 * @param localUploadId - Unique ID for resume tracking
 * @param onProgress - Progress callback (uploaded bytes, total bytes)
 * @param signal - AbortSignal for cancellation
 * @returns UploadResult with InputFile for message publishing
 */
export async function uploadFile(
  client: TelegramClient,
  data: Uint8Array,
  fileName: string,
  localUploadId: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<UploadResult> {
  const startTime = Date.now();
  const totalSize = data.length;
  const params = getUploadParams();

  // TZ 8.1: big file threshold is 10 MB
  const isBigFile = totalSize > 10 * 1024 * 1024;
  const chunkSize = params.chunkSize;
  const totalParts = Math.ceil(totalSize / chunkSize);

  // Try to resume from existing manifest
  let manifest = await loadManifest(localUploadId);
  let wasResumed = false;

  if (
    manifest &&
    manifest.totalSize === totalSize &&
    manifest.chunkSize === chunkSize &&
    manifest.isBigFile === isBigFile
  ) {
    wasResumed = manifest.confirmedParts.size > 0;
  } else {
    // Create new manifest with random fileId
    const fileId = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    manifest = {
      localUploadId,
      fileId,
      totalSize,
      totalParts,
      chunkSize,
      confirmedParts: new Set(),
      isBigFile,
      lastUpdated: Date.now(),
    };
  }

  // Persist data for possible resume after app restart
  await saveUploadData(localUploadId, data);
  await saveManifest(manifest);

  let totalRetries = 0;
  let totalUploaded = manifest.confirmedParts.size * chunkSize;

  // Report initial progress (from resume)
  if (totalUploaded > 0 && onProgress) {
    onProgress(Math.min(totalUploaded, totalSize), totalSize);
  }

  // Upload each part sequentially (TZ 8.2: parallelism = 1)
  for (let partIndex = 0; partIndex < totalParts; partIndex++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    // Skip already confirmed parts (resume)
    if (manifest.confirmedParts.has(partIndex)) continue;

    const offset = partIndex * chunkSize;
    const end = Math.min(offset + chunkSize, totalSize);
    const chunk = data.slice(offset, end);

    // Upload chunk with retries (TZ 8.2)
    const retries = await uploadChunkWithRetry(
      client,
      manifest.fileId,
      partIndex,
      totalParts,
      chunk,
      isBigFile,
      params,
      signal
    );

    totalRetries += retries;

    // Mark part as confirmed
    manifest.confirmedParts.add(partIndex);
    manifest.lastUpdated = Date.now();
    await saveManifest(manifest);

    totalUploaded = Math.min(totalUploaded + chunk.length, totalSize);
    onProgress?.(totalUploaded, totalSize);
  }

  // Build InputFile result
  // Note: GramJS BigInteger type doesn't match native bigint — cast via `as any`
  const inputFile = isBigFile
    ? new Api.InputFileBig({
        id: manifest.fileId as any,
        parts: totalParts,
        name: fileName,
      })
    : new Api.InputFile({
        id: manifest.fileId as any,
        parts: totalParts,
        name: fileName,
        md5Checksum: "", // Not required for regular uploads
      });

  // Clean up manifest on success
  await deleteManifest(localUploadId);

  const durationMs = Date.now() - startTime;
  const avgSpeed = durationMs > 0 ? (totalSize / (durationMs / 1000)) : 0;

  return {
    inputFile,
    totalSize,
    totalParts,
    totalRetries,
    wasResumed,
    durationMs,
    avgSpeed,
  };
}

/**
 * Upload a single chunk with exponential backoff retry (TZ Section 8.2).
 * Returns the number of retries needed.
 */
async function uploadChunkWithRetry(
  client: TelegramClient,
  fileId: bigint,
  partIndex: number,
  totalParts: number,
  chunk: Uint8Array,
  isBigFile: boolean,
  params: ReturnType<typeof getUploadParams>,
  signal?: AbortSignal
): Promise<number> {
  let retries = 0;

  for (let attempt = 0; attempt <= params.maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const chunkStart = Date.now();

    try {
      // Use a timeout wrapper
      const result = await withTimeout(
        params.chunkTimeout,
        () => {
          if (isBigFile) {
            return client.invoke(
              new Api.upload.SaveBigFilePart({
                fileId: fileId as any,
                filePart: partIndex,
                fileTotalParts: totalParts,
                bytes: Buffer.from(chunk),
              })
            );
          } else {
            return client.invoke(
              new Api.upload.SaveFilePart({
                fileId: fileId as any,
                filePart: partIndex,
                bytes: Buffer.from(chunk),
              })
            );
          }
        },
        signal
      );

      const chunkDuration = Date.now() - chunkStart;

      // Record measurement for network profiler
      recordChunkMeasurement(chunk.length, chunkDuration, true, "upload");

      if (!result) {
        throw new Error("Chunk upload returned false");
      }

      return retries;
    } catch (err) {
      const chunkDuration = Date.now() - chunkStart;
      recordChunkMeasurement(chunk.length, chunkDuration, false, "upload");

      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      // Check if this is a non-retryable error
      const errMsg = String((err as Error)?.message || err);
      if (errMsg.includes("AbortError")) throw err;
      if (errMsg.includes("AUTH_KEY")) throw err; // Auth errors are fatal

      retries++;

      if (attempt >= params.maxRetries) {
        throw new Error(
          "Chunk " + String(partIndex) + " failed after " + String(params.maxRetries) + " retries: " + errMsg
        );
      }

      // Exponential backoff with jitter (TZ 8.2)
      const baseDelay = Math.min(
        params.backoffStart * Math.pow(2, attempt),
        params.backoffCeiling
      );
      const jitter = 1 + (Math.random() * 2 - 1) * params.backoffJitter;
      const delay = Math.round(baseDelay * jitter);

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return retries;
}

/**
 * Wrap a promise with a timeout.
 */
function withTimeout<T>(
  timeoutMs: number,
  fn: () => Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("Chunk upload timeout (" + String(timeoutMs) + "ms)"));
      }
    }, timeoutMs);

    const abortHandler = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      }
    };
    signal?.addEventListener("abort", abortHandler);

    fn()
      .then((result) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abortHandler);
          resolve(result);
        }
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          signal?.removeEventListener("abort", abortHandler);
          reject(err);
        }
      });
  });
}

/**
 * Clean up stale upload manifests (older than 24 hours).
 * Called on app startup.
 */
export async function cleanupStaleManifests(): Promise<void> {
  try {
    const db = await openManifestDB();
    const tx = db.transaction(MANIFEST_STORE, "readwrite");
    const store = tx.objectStore(MANIFEST_STORE);
    const all = store.openCursor();
    const staleThreshold = Date.now() - 24 * 60 * 60 * 1000;

    all.onsuccess = () => {
      const cursor = all.result;
      if (cursor) {
        if (cursor.value.lastUpdated < staleThreshold) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch {
    // Non-critical
  }
}
