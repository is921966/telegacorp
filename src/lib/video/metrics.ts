/**
 * Video Observability (TZ Section 11)
 *
 * Client-side metrics and logging for video uploads and playback.
 *
 * Metrics:
 *   Upload: time from file selection to publish, retries per chunk,
 *           resume rate, average speed
 *   Playback: startup time, rebuffers/min, stall-free ratio, loop usage
 *
 * Logs:
 *   Correlation: message_id, local_upload_id, file_unique_id
 *   Error types: timeout, network_lost, server_error, auth_error
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VideoErrorType = "timeout" | "network_lost" | "server_error" | "auth_error" | "transcode_error" | "unknown";

export interface UploadLogEntry {
  timestamp: number;
  localUploadId: string;
  messageId?: number;
  chatId: string;
  phase: string;
  event: string;
  errorType?: VideoErrorType;
  details?: string;
  durationMs?: number;
  bytesTransferred?: number;
  chunkRetries?: number;
}

export interface PlaybackLogEntry {
  timestamp: number;
  messageId: number;
  chatId: string;
  event: "start" | "rebuffer" | "seek" | "stall" | "resume" | "end" | "loop_toggle" | "error";
  details?: string;
  currentTime?: number;
  bufferedSeconds?: number;
  startupTimeMs?: number;
}

export interface PlaybackSession {
  messageId: number;
  chatId: string;
  startTimestamp: number;
  startupTimeMs: number;
  rebufferCount: number;
  totalPlayTimeMs: number;
  totalStallTimeMs: number;
  loopEnabled: boolean;
  loopCount: number;
  endedNaturally: boolean;
}

// ---------------------------------------------------------------------------
// Log storage (in-memory ring buffer)
// ---------------------------------------------------------------------------

const MAX_UPLOAD_LOGS = 500;
const MAX_PLAYBACK_LOGS = 500;

const uploadLogs: UploadLogEntry[] = [];
const playbackLogs: PlaybackLogEntry[] = [];
const playbackSessions = new Map<string, PlaybackSession>();

// ---------------------------------------------------------------------------
// Upload logging
// ---------------------------------------------------------------------------

export function logUploadEvent(entry: Omit<UploadLogEntry, "timestamp">): void {
  const full: UploadLogEntry = { ...entry, timestamp: Date.now() };
  uploadLogs.push(full);
  if (uploadLogs.length > MAX_UPLOAD_LOGS) {
    uploadLogs.splice(0, uploadLogs.length - MAX_UPLOAD_LOGS);
  }

  // Console log for debugging
  if (entry.errorType) {
    console.warn(
      "[VideoUpload]",
      entry.event,
      entry.errorType,
      entry.details || "",
      { localUploadId: entry.localUploadId, phase: entry.phase }
    );
  }
}

export function classifyError(err: unknown): VideoErrorType {
  const msg = String((err as Error)?.message || err).toLowerCase();

  if (msg.includes("timeout")) return "timeout";
  if (msg.includes("network") || msg.includes("offline") || msg.includes("fetch")) return "network_lost";
  if (msg.includes("auth") || msg.includes("session")) return "auth_error";
  if (msg.includes("rpc") || msg.includes("server") || msg.includes("500")) return "server_error";
  if (msg.includes("transcode") || msg.includes("ffmpeg")) return "transcode_error";

  return "unknown";
}

// ---------------------------------------------------------------------------
// Playback logging
// ---------------------------------------------------------------------------

export function logPlaybackEvent(entry: Omit<PlaybackLogEntry, "timestamp">): void {
  const full: PlaybackLogEntry = { ...entry, timestamp: Date.now() };
  playbackLogs.push(full);
  if (playbackLogs.length > MAX_PLAYBACK_LOGS) {
    playbackLogs.splice(0, playbackLogs.length - MAX_PLAYBACK_LOGS);
  }
}

/** Start tracking a playback session */
export function startPlaybackSession(
  messageId: number,
  chatId: string,
  startupTimeMs: number
): string {
  const key = chatId + ":" + String(messageId);
  playbackSessions.set(key, {
    messageId,
    chatId,
    startTimestamp: Date.now(),
    startupTimeMs,
    rebufferCount: 0,
    totalPlayTimeMs: 0,
    totalStallTimeMs: 0,
    loopEnabled: false,
    loopCount: 0,
    endedNaturally: false,
  });

  logPlaybackEvent({
    messageId,
    chatId,
    event: "start",
    startupTimeMs,
  });

  return key;
}

/** Record a rebuffer event */
export function recordRebuffer(sessionKey: string): void {
  const session = playbackSessions.get(sessionKey);
  if (!session) return;
  session.rebufferCount++;

  logPlaybackEvent({
    messageId: session.messageId,
    chatId: session.chatId,
    event: "rebuffer",
  });
}

/** End a playback session and return summary */
export function endPlaybackSession(sessionKey: string, natural: boolean): PlaybackSession | null {
  const session = playbackSessions.get(sessionKey);
  if (!session) return null;

  session.endedNaturally = natural;
  session.totalPlayTimeMs = Date.now() - session.startTimestamp;

  logPlaybackEvent({
    messageId: session.messageId,
    chatId: session.chatId,
    event: "end",
    details: natural ? "natural" : "user_stopped",
  });

  playbackSessions.delete(sessionKey);
  return { ...session };
}

// ---------------------------------------------------------------------------
// Metric summaries
// ---------------------------------------------------------------------------

/** Get recent upload logs (for debugging / admin panel) */
export function getUploadLogs(limit = 100): UploadLogEntry[] {
  return uploadLogs.slice(-limit);
}

/** Get recent playback logs */
export function getPlaybackLogs(limit = 100): PlaybackLogEntry[] {
  return playbackLogs.slice(-limit);
}

/** Calculate upload metrics summary from recent logs */
export function getUploadMetricsSummary(): {
  avgUploadTimeMs: number;
  avgRetriesPerUpload: number;
  resumeRate: number;
  avgSpeedBytesPerSec: number;
  errorRate: number;
} {
  const completedUploads = uploadLogs.filter((l) => l.event === "upload_complete");
  const errorUploads = uploadLogs.filter((l) => l.event === "upload_error");

  if (completedUploads.length === 0) {
    return {
      avgUploadTimeMs: 0,
      avgRetriesPerUpload: 0,
      resumeRate: 0,
      avgSpeedBytesPerSec: 0,
      errorRate: 0,
    };
  }

  const avgTime = completedUploads.reduce(
    (sum, l) => sum + (l.durationMs || 0), 0
  ) / completedUploads.length;

  const avgRetries = completedUploads.reduce(
    (sum, l) => sum + (l.chunkRetries || 0), 0
  ) / completedUploads.length;

  const avgSpeed = completedUploads.reduce(
    (sum, l) => sum + ((l.bytesTransferred || 0) / ((l.durationMs || 1) / 1000)), 0
  ) / completedUploads.length;

  const total = completedUploads.length + errorUploads.length;
  const errorRate = total > 0 ? errorUploads.length / total : 0;

  return {
    avgUploadTimeMs: avgTime,
    avgRetriesPerUpload: avgRetries,
    resumeRate: 0, // TODO: track resume events
    avgSpeedBytesPerSec: avgSpeed,
    errorRate,
  };
}
