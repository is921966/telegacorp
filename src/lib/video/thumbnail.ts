/**
 * Thumbnail Generator (TZ Section 7)
 *
 * - Generates thumbnail immediately after video selection
 * - Frame: 1-2 second or sharpest from first 3 seconds
 * - Format: JPEG
 * - Max: 640px long side, <=80 KB
 *
 * Uses native Canvas API -- no FFmpeg needed for thumbnails.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThumbnailResult {
  /** JPEG blob */
  blob: Blob;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Size in bytes */
  size: number;
}

// ---------------------------------------------------------------------------
// Constants (TZ Section 7.1, 3.2)
// ---------------------------------------------------------------------------

const MAX_LONG_SIDE = 640;
const MAX_SIZE_BYTES = 80 * 1024; // 80 KB
const SEEK_TIMES = [1.0, 1.5, 2.0]; // seconds to try
const THUMBNAIL_QUALITY_START = 0.85;
const THUMBNAIL_QUALITY_MIN = 0.3;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a thumbnail from a video file (TZ Section 7.1).
 * Tries multiple seek positions and picks the best frame.
 *
 * @param file - Video file
 * @param signal - AbortSignal for cancellation
 * @returns ThumbnailResult with JPEG blob
 */
export async function generateThumbnail(
  file: File,
  signal?: AbortSignal
): Promise<ThumbnailResult> {
  const url = URL.createObjectURL(file);

  try {
    const video = await loadVideo(url, signal);

    // Determine seek positions within video duration
    const duration = video.duration || 3;
    const seekPositions = SEEK_TIMES
      .map((t) => Math.min(t, duration * 0.9))
      .filter((t, i, arr) => arr.indexOf(t) === i); // dedupe

    // Try each seek position, collect candidates
    let bestBlob: Blob | null = null;
    let bestWidth = 0;
    let bestHeight = 0;

    for (const seekTime of seekPositions) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

      try {
        await seekTo(video, seekTime);
        const { blob, width, height } = await captureFrame(video);

        // Pick the largest blob (sharpest image heuristic)
        if (!bestBlob || blob.size > bestBlob.size) {
          bestBlob = blob;
          bestWidth = width;
          bestHeight = height;
        }
      } catch {
        // Skip failed frames, try next position
        continue;
      }
    }

    if (!bestBlob) {
      // Last resort: capture current frame (might be black/0s)
      try {
        await seekTo(video, 0.1);
      } catch {
        // ignore
      }
      const fallback = await captureFrame(video);
      bestBlob = fallback.blob;
      bestWidth = fallback.width;
      bestHeight = fallback.height;
    }

    video.remove();

    return {
      blob: bestBlob,
      width: bestWidth,
      height: bestHeight,
      size: bestBlob.size,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Generate a thumbnail from raw video data (Uint8Array).
 * Used when video has already been transcoded.
 */
export async function generateThumbnailFromData(
  data: Uint8Array,
  mimeType: string = "video/mp4",
  signal?: AbortSignal
): Promise<ThumbnailResult> {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: mimeType });
  const file = new File([blob], "video.mp4", { type: mimeType });
  return generateThumbnail(file, signal);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function loadVideo(url: string, signal?: AbortSignal): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.src = url;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Video load timeout (15s)"));
    }, 15_000);

    const abortHandler = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abortHandler);

    function cleanup() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abortHandler);
      video.onloadeddata = null;
      video.onerror = null;
    }

    video.onloadeddata = () => {
      cleanup();
      resolve(video);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video for thumbnail"));
    };
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Seek timeout"));
    }, 5_000);

    function cleanup() {
      clearTimeout(timeout);
      video.onseeked = null;
    }

    video.onseeked = () => {
      cleanup();
      resolve();
    };

    video.currentTime = time;
  });
}

async function captureFrame(
  video: HTMLVideoElement
): Promise<{ blob: Blob; width: number; height: number }> {
  const srcW = video.videoWidth;
  const srcH = video.videoHeight;

  if (!srcW || !srcH) {
    throw new Error("Video has no dimensions");
  }

  // Calculate target dimensions (TZ 7.1: max 640px long side)
  const longSide = Math.max(srcW, srcH);
  const scale = longSide > MAX_LONG_SIDE ? MAX_LONG_SIDE / longSide : 1;
  const width = Math.round(srcW * scale);
  const height = Math.round(srcH * scale);

  // Draw to canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(video, 0, 0, width, height);

  // Convert to JPEG, iteratively reduce quality to meet size limit
  let quality = THUMBNAIL_QUALITY_START;
  let blob: Blob | null = null;

  while (quality >= THUMBNAIL_QUALITY_MIN) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", quality);
    });

    if (blob && blob.size <= MAX_SIZE_BYTES) break;
    quality -= 0.1;
  }

  // Final fallback: lower resolution
  if (!blob || blob.size > MAX_SIZE_BYTES) {
    const smallCanvas = document.createElement("canvas");
    const smallScale = 0.5;
    smallCanvas.width = Math.round(width * smallScale);
    smallCanvas.height = Math.round(height * smallScale);
    const smallCtx = smallCanvas.getContext("2d");
    if (smallCtx) {
      smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
      blob = await new Promise<Blob | null>((resolve) => {
        smallCanvas.toBlob(resolve, "image/jpeg", 0.6);
      });
    }
    smallCanvas.remove();
  }

  canvas.remove();

  if (!blob) throw new Error("Failed to generate thumbnail blob");

  return { blob, width, height };
}
