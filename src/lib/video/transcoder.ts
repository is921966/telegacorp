/**
 * Video Transcoder — LQ (TZ Section 6)
 *
 * Uses FFmpeg.wasm for client-side transcoding to:
 * - Container: MP4
 * - Video: H.264 Baseline profile
 * - Audio: AAC (if present)
 * - Resolution: <=360p (long side), preserve aspect ratio, no upscale
 * - Bitrate: 350-600 kbps VBR
 * - FPS: <=24
 * - movflags: +faststart (for streaming support)
 *
 * Supports progress reporting and cancellation.
 */

import type { FFmpeg } from "@ffmpeg/ffmpeg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscodeResult {
  /** Transcoded MP4 as Uint8Array */
  data: Uint8Array;
  /** Duration in seconds (from ffprobe) */
  duration: number;
  /** Width after transcode */
  width: number;
  /** Height after transcode */
  height: number;
  /** Transcoded file size in bytes */
  size: number;
  /** Whether audio track is present */
  hasAudio: boolean;
  /** Time spent transcoding in ms */
  transcodeDurationMs: number;
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  fps: number;
  bitrate: number; // kbps
  codec: string;
}

export type TranscodeProgress = (progress: number) => void; // 0-100

// ---------------------------------------------------------------------------
// FFmpeg singleton
// ---------------------------------------------------------------------------

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const ffmpeg = new FFmpeg();

    // Load with single-threaded core (no SharedArrayBuffer needed)
    await ffmpeg.load({
      coreURL: "/ffmpeg/ffmpeg-core.js",
      wasmURL: "/ffmpeg/ffmpeg-core.wasm",
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await ffmpegLoading;
  } catch (err) {
    ffmpegLoading = null;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

/**
 * Extract video metadata using ffprobe.
 * Falls back to HTML5 video element if ffprobe unavailable.
 */
export async function extractMetadata(file: File): Promise<VideoMetadata> {
  // Try native video element first (faster, no FFmpeg needed)
  try {
    return await extractMetadataNative(file);
  } catch {
    // Fall through to FFmpeg probe
  }

  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const inputName = "probe_input" + getExtension(file.name);
  await ffmpeg.writeFile(inputName, await fetchFile(file));

  // Run ffprobe to get metadata
  await ffmpeg.ffprobe([
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    inputName,
    "-o", "probe_output.txt",
  ]);

  const probeData = await ffmpeg.readFile("probe_output.txt");
  const probeText = typeof probeData === "string"
    ? probeData
    : new TextDecoder().decode(probeData);

  // Clean up
  await ffmpeg.deleteFile(inputName).catch(() => {});
  await ffmpeg.deleteFile("probe_output.txt").catch(() => {});

  try {
    const info = JSON.parse(probeText);
    const videoStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === "video");
    const audioStream = info.streams?.find((s: { codec_type: string }) => s.codec_type === "audio");

    return {
      duration: parseFloat(info.format?.duration || "0"),
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      hasAudio: !!audioStream,
      fps: parseFps(videoStream?.r_frame_rate || "30/1"),
      bitrate: Math.round((parseFloat(info.format?.bit_rate || "0")) / 1000),
      codec: videoStream?.codec_name || "unknown",
    };
  } catch {
    return {
      duration: 0, width: 0, height: 0,
      hasAudio: false, fps: 30, bitrate: 0, codec: "unknown",
    };
  }
}

/** Extract metadata using native HTML5 video element (no FFmpeg) */
function extractMetadataNative(file: File): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Metadata extraction timeout"));
    }, 10_000);

    function cleanup() {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      video.remove();
    }

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        duration: video.duration || 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0,
        hasAudio: true, // Can't detect from video element alone
        fps: 30, // Default estimate
        bitrate: Math.round((file.size * 8) / ((video.duration || 1) * 1000)),
        codec: "unknown",
      };
      cleanup();
      resolve(metadata);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video metadata"));
    };
  });
}

// ---------------------------------------------------------------------------
// Transcoding
// ---------------------------------------------------------------------------

/**
 * Transcode video to LQ (TZ Section 6.1).
 *
 * @param file - Input video File
 * @param onProgress - Progress callback (0-100)
 * @param signal - AbortSignal for cancellation
 * @returns TranscodeResult with the transcoded MP4 data
 */
export async function transcodeLQ(
  file: File,
  onProgress?: TranscodeProgress,
  signal?: AbortSignal
): Promise<TranscodeResult> {
  const startTime = Date.now();

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // 1. Get metadata to determine transcode parameters
  const meta = await extractMetadata(file);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // Check TZ limits
  if (meta.duration > 30 * 60) {
    throw new Error("Video exceeds 30 minute limit");
  }

  // 2. Calculate target resolution (TZ 6.1)
  const { targetWidth, targetHeight } = calculateTargetResolution(
    meta.width,
    meta.height
  );

  // 3. Calculate target FPS (TZ 6.1: <=24)
  const targetFps = Math.min(meta.fps, 24);

  // 4. Check if transcoding is needed
  const needsTranscode = shouldTranscode(meta, targetWidth, targetHeight, targetFps);

  if (!needsTranscode && file.size <= 500 * 1024 * 1024) {
    // Video already meets LQ requirements -- return as-is
    const data = new Uint8Array(await file.arrayBuffer());
    return {
      data,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      size: data.length,
      hasAudio: meta.hasAudio,
      transcodeDurationMs: Date.now() - startTime,
    };
  }

  // 5. Load FFmpeg and transcode
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // Set up progress listener
  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(Math.round(progress * 100), 99));
  };
  ffmpeg.on("progress", progressHandler);

  // Set up abort handler
  const abortHandler = () => ffmpeg.terminate();
  signal?.addEventListener("abort", abortHandler);

  try {
    const inputName = "input" + getExtension(file.name);
    const outputName = "output.mp4";

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Build FFmpeg args (TZ 6.1)
    const args = buildTranscodeArgs(
      inputName,
      outputName,
      targetWidth,
      targetHeight,
      targetFps,
      meta.hasAudio
    );

    const exitCode = await ffmpeg.exec(args, 0, { signal });
    if (exitCode !== 0) {
      throw new Error("FFmpeg transcode failed with exit code " + String(exitCode));
    }

    const data = await ffmpeg.readFile(outputName);
    if (typeof data === "string") {
      throw new Error("Unexpected string output from FFmpeg");
    }

    // Clean up FFmpeg FS
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});

    onProgress?.(100);

    // Check output size limit (TZ 3.2: 500 MB max)
    if (data.length > 500 * 1024 * 1024) {
      throw new Error("Transcoded video exceeds 500 MB limit");
    }

    return {
      data: data as Uint8Array,
      duration: meta.duration,
      width: targetWidth || meta.width,
      height: targetHeight || meta.height,
      size: data.length,
      hasAudio: meta.hasAudio,
      transcodeDurationMs: Date.now() - startTime,
    };
  } finally {
    ffmpeg.off("progress", progressHandler);
    signal?.removeEventListener("abort", abortHandler);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateTargetResolution(
  width: number,
  height: number
): { targetWidth: number; targetHeight: number } {
  // TZ 6.1: if source >=720p, scale to 360p long side; if <720p, no upscale
  const longSide = Math.max(width, height);

  if (longSide < 720) {
    // Don't upscale -- keep original, but ensure even dimensions
    return {
      targetWidth: width % 2 === 0 ? width : width - 1,
      targetHeight: height % 2 === 0 ? height : height - 1,
    };
  }

  // Scale to 360p long side, preserve aspect ratio
  const scale = 360 / longSide;
  let tw = Math.round(width * scale);
  let th = Math.round(height * scale);

  // H.264 requires even dimensions
  tw = tw % 2 === 0 ? tw : tw - 1;
  th = th % 2 === 0 ? th : th - 1;

  return { targetWidth: tw, targetHeight: th };
}

function shouldTranscode(
  meta: VideoMetadata,
  targetWidth: number,
  targetHeight: number,
  targetFps: number
): boolean {
  // Needs transcode if:
  // 1. Resolution exceeds target
  if (meta.width !== targetWidth || meta.height !== targetHeight) return true;
  // 2. FPS exceeds target
  if (meta.fps > targetFps + 1) return true;
  // 3. Bitrate is too high (>600 kbps video)
  if (meta.bitrate > 800) return true; // Allow some margin
  // 4. Not H.264 codec
  if (meta.codec !== "h264" && meta.codec !== "unknown") return true;

  return false;
}

function buildTranscodeArgs(
  input: string,
  output: string,
  width: number,
  height: number,
  fps: number,
  hasAudio: boolean
): string[] {
  const args: string[] = [
    "-i", input,
    // Video codec: H.264 Baseline
    "-c:v", "libx264",
    "-profile:v", "baseline",
    "-level", "3.0",
    // Target bitrate: 350-600 kbps VBR (TZ 6.1)
    "-b:v", "450k",
    "-maxrate", "600k",
    "-bufsize", "1200k",
    // Resolution
    "-vf", "scale=" + String(width) + ":" + String(height),
    // FPS (TZ 6.1: <=24)
    "-r", String(fps),
    // Encoding speed -- favor speed over compression
    "-preset", "ultrafast",
    // GOP size: 2x FPS for streaming
    "-g", String(fps * 2),
    "-keyint_min", String(fps),
  ];

  if (hasAudio) {
    args.push(
      // Audio: AAC (TZ 6.1)
      "-c:a", "aac",
      "-b:a", "64k",
      "-ar", "44100",
      "-ac", "1", // Mono to save bandwidth
    );
  } else {
    args.push("-an"); // No audio
  }

  args.push(
    // MP4 container with faststart for streaming (TZ 9.1: supports_streaming)
    "-movflags", "+faststart+frag_keyframe+empty_moov",
    "-f", "mp4",
    output,
  );

  return args;
}

function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.substring(idx) : ".mp4";
}

function parseFps(fpsStr: string): number {
  const parts = fpsStr.split("/");
  if (parts.length === 2) {
    const num = parseInt(parts[0]);
    const den = parseInt(parts[1]);
    return den > 0 ? num / den : 30;
  }
  return parseFloat(fpsStr) || 30;
}

/**
 * Clean up FFmpeg instance to free memory.
 * Called when upload queue is empty.
 */
export function terminateFFmpeg(): void {
  if (ffmpegInstance) {
    ffmpegInstance.terminate();
    ffmpegInstance = null;
    ffmpegLoading = null;
  }
}
