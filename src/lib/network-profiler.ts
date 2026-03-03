/**
 * Network Profiler (TZ Section 5: Network Profiler)
 *
 * Measures actual network degradation using chunk upload/download timings.
 * Detects network profile (A/B/C) and provides parameters for Upload Manager
 * and Playback modules.
 *
 * Profile A (very bad): DL 256kbps, UL 128kbps, RTT 800ms, 10% loss
 * Profile B (bad):      DL 512kbps, UL 256kbps, RTT 500ms, 5% loss
 * Profile C (unstable): DL 2Mbps,   UL 512kbps, RTT 250ms, 2% loss
 * Fast:                 Better than C
 */

export type NetworkProfile = "A" | "B" | "C" | "fast";

export interface NetworkStats {
  /** Estimated download speed in bytes/sec */
  downloadSpeed: number;
  /** Estimated upload speed in bytes/sec */
  uploadSpeed: number;
  /** Estimated RTT in ms */
  rtt: number;
  /** Recent chunk failure rate (0-1) */
  failureRate: number;
  /** Detected network profile */
  profile: NetworkProfile;
  /** Whether we're in "bad network" mode */
  isBadNetwork: boolean;
  /** Timestamp of last measurement */
  lastUpdated: number;
}

// ---------------------------------------------------------------------------
// Configuration — TZ Section 8.2
// ---------------------------------------------------------------------------

export interface UploadParams {
  /** Parallelism: always 1 for bad network (TZ 8.2) */
  parallelism: 1;
  /** Chunk size in bytes */
  chunkSize: number;
  /** Min chunk size in bytes */
  minChunkSize: number;
  /** Max chunk size in bytes */
  maxChunkSize: number;
  /** Chunk ack timeout in ms (TZ: 30s) */
  chunkTimeout: number;
  /** Max retries per chunk (TZ: 10) */
  maxRetries: number;
  /** Backoff start in ms (TZ: 1s) */
  backoffStart: number;
  /** Backoff ceiling in ms (TZ: 30s) */
  backoffCeiling: number;
  /** Backoff jitter factor (TZ: 20%) */
  backoffJitter: number;
}

export interface PlaybackParams {
  /** Seconds to buffer before starting playback (TZ: 3s) */
  startupBufferSeconds: number;
  /** Rebuffer threshold in seconds (TZ: 1s) */
  rebufferThresholdSeconds: number;
  /** Seconds to prefetch ahead (TZ: 10s A/B, 20s C) */
  prefetchAheadSeconds: number;
  /** Allow seeking beyond buffered range */
  allowForwardSeek: boolean;
  /** Min seconds between seek operations (TZ: 2s for B/C) */
  seekCooldownSeconds: number;
}

// ---------------------------------------------------------------------------
// Measurement tracking
// ---------------------------------------------------------------------------

interface ChunkMeasurement {
  /** Chunk size in bytes */
  size: number;
  /** Duration in ms */
  durationMs: number;
  /** Whether the chunk succeeded */
  success: boolean;
  /** Direction: upload or download */
  direction: "upload" | "download";
  /** Timestamp */
  timestamp: number;
}

const MEASUREMENTS_WINDOW = 30; // Keep last 30 measurements
const measurements: ChunkMeasurement[] = [];

// Listeners for profile changes
type ProfileListener = (stats: NetworkStats) => void;
const profileListeners = new Set<ProfileListener>();

// Current cached stats
let currentStats: NetworkStats = {
  downloadSpeed: Infinity,
  uploadSpeed: Infinity,
  rtt: 0,
  failureRate: 0,
  profile: "fast",
  isBadNetwork: false,
  lastUpdated: Date.now(),
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a chunk transfer measurement.
 * Called by Upload Manager and Download Manager after each chunk.
 */
export function recordChunkMeasurement(
  size: number,
  durationMs: number,
  success: boolean,
  direction: "upload" | "download"
): void {
  measurements.push({
    size,
    durationMs,
    success,
    direction,
    timestamp: Date.now(),
  });

  // Trim old measurements
  if (measurements.length > MEASUREMENTS_WINDOW) {
    measurements.splice(0, measurements.length - MEASUREMENTS_WINDOW);
  }

  // Recalculate stats
  recalculateStats();
}

/** Get current network stats */
export function getNetworkStats(): NetworkStats {
  return { ...currentStats };
}

/** Get current network profile */
export function getNetworkProfile(): NetworkProfile {
  return currentStats.profile;
}

/** Check if we're in bad network mode */
export function isBadNetwork(): boolean {
  return currentStats.isBadNetwork;
}

/** Get upload parameters tuned for current network (TZ Section 8.2) */
export function getUploadParams(): UploadParams {
  const profile = currentStats.profile;

  // TZ 8.2: fixed parameters for bad network
  let chunkSize = 128 * 1024; // Start 128 KB

  // Adaptive chunk size within TZ bounds
  if (profile === "A") {
    chunkSize = 64 * 1024; // Min for very bad
  } else if (profile === "B") {
    chunkSize = 128 * 1024;
  } else if (profile === "C") {
    chunkSize = 256 * 1024; // Max for unstable
  } else {
    chunkSize = 256 * 1024; // Fast — use max allowed
  }

  return {
    parallelism: 1, // TZ 8.2: always 1
    chunkSize,
    minChunkSize: 64 * 1024,   // TZ: min 64 KB
    maxChunkSize: 256 * 1024,  // TZ: max 256 KB
    chunkTimeout: 30_000,      // TZ: 30 sec
    maxRetries: 10,            // TZ: up to 10
    backoffStart: 1000,        // TZ: 1 sec
    backoffCeiling: 30_000,    // TZ: 30 sec
    backoffJitter: 0.2,        // TZ: 20%
  };
}

/** Get playback parameters tuned for current network (TZ Section 10) */
export function getPlaybackParams(): PlaybackParams {
  const profile = currentStats.profile;

  return {
    startupBufferSeconds: 3,  // TZ 10.1
    rebufferThresholdSeconds: 1, // TZ 10.1
    prefetchAheadSeconds:
      profile === "A" || profile === "B" ? 10 : 20, // TZ 10.1
    allowForwardSeek: profile !== "A", // TZ 10.2: A = buffered only
    seekCooldownSeconds: profile === "A" ? Infinity : 2, // TZ 10.2: B/C = 1 per 2s
  };
}

/** Subscribe to network profile changes */
export function onProfileChange(listener: ProfileListener): () => void {
  profileListeners.add(listener);
  return () => profileListeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Internal calculations
// ---------------------------------------------------------------------------

function recalculateStats(): void {
  const now = Date.now();
  const recentWindow = 60_000; // Last 60 seconds

  const recent = measurements.filter(
    (m) => now - m.timestamp < recentWindow
  );
  if (recent.length === 0) return;

  // Calculate speeds
  const uploads = recent.filter((m) => m.direction === "upload" && m.success);
  const downloads = recent.filter((m) => m.direction === "download" && m.success);

  const uploadSpeed = uploads.length > 0
    ? uploads.reduce((sum, m) => sum + m.size / (m.durationMs / 1000), 0) / uploads.length
    : currentStats.uploadSpeed;

  const downloadSpeed = downloads.length > 0
    ? downloads.reduce((sum, m) => sum + m.size / (m.durationMs / 1000), 0) / downloads.length
    : currentStats.downloadSpeed;

  // Estimate RTT from smallest successful chunks
  const smallChunks = recent
    .filter((m) => m.success && m.size <= 64 * 1024)
    .sort((a, b) => a.durationMs - b.durationMs);
  const rtt = smallChunks.length > 0
    ? smallChunks[0].durationMs
    : currentStats.rtt;

  // Failure rate
  const failureRate = recent.length > 0
    ? recent.filter((m) => !m.success).length / recent.length
    : 0;

  // Determine profile
  const profile = detectProfile(downloadSpeed, uploadSpeed, rtt, failureRate);
  const isBadNetworkMode = profile === "A" || profile === "B";

  const oldProfile = currentStats.profile;

  currentStats = {
    downloadSpeed,
    uploadSpeed,
    rtt,
    failureRate,
    profile,
    isBadNetwork: isBadNetworkMode,
    lastUpdated: now,
  };

  // Notify listeners on profile change
  if (profile !== oldProfile) {
    for (const listener of profileListeners) {
      listener(currentStats);
    }
  }
}

function detectProfile(
  dlSpeed: number,
  ulSpeed: number,
  rtt: number,
  failureRate: number
): NetworkProfile {
  // Convert speeds to kbps for comparison with TZ profiles
  const dlKbps = (dlSpeed * 8) / 1000;
  const ulKbps = (ulSpeed * 8) / 1000;

  // Profile A: DL ≤256kbps OR UL ≤128kbps OR RTT>800ms OR loss>10%
  if (dlKbps <= 256 || ulKbps <= 128 || rtt > 800 || failureRate > 0.1) {
    return "A";
  }

  // Profile B: DL ≤512kbps OR UL ≤256kbps OR RTT>500ms OR loss>5%
  if (dlKbps <= 512 || ulKbps <= 256 || rtt > 500 || failureRate > 0.05) {
    return "B";
  }

  // Profile C: DL ≤2Mbps OR UL ≤512kbps OR RTT>250ms OR loss>2%
  if (dlKbps <= 2000 || ulKbps <= 512 || rtt > 250 || failureRate > 0.02) {
    return "C";
  }

  return "fast";
}

// ---------------------------------------------------------------------------
// Integrate with existing Network Information API detection
// ---------------------------------------------------------------------------

/** Seed the profiler with Network Information API data on startup */
export function seedFromNavigatorConnection(): void {
  if (typeof navigator === "undefined") return;

  const conn = (navigator as unknown as {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
  }).connection;

  if (!conn) return;

  // Seed initial estimates from browser's Network Information API
  if (conn.downlink !== undefined) {
    // downlink is in Mbps, convert to bytes/sec
    currentStats.downloadSpeed = (conn.downlink * 1000 * 1000) / 8;
  }
  if (conn.rtt !== undefined) {
    currentStats.rtt = conn.rtt;
  }

  // Rough upload estimate: typically 1/4 of download
  if (conn.downlink !== undefined) {
    currentStats.uploadSpeed = currentStats.downloadSpeed / 4;
  }

  // Detect initial profile
  const profile = detectProfile(
    currentStats.downloadSpeed,
    currentStats.uploadSpeed,
    currentStats.rtt,
    0
  );
  currentStats.profile = profile;
  currentStats.isBadNetwork = profile === "A" || profile === "B";
}

// Auto-seed on load
if (typeof window !== "undefined") {
  seedFromNavigatorConnection();
}
