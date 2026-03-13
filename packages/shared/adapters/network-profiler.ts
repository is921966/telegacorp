/**
 * Network profiler adapter — platform-specific implementations must be injected.
 *
 * Web: src/lib/network-profiler.ts (full profiler with sliding window)
 * Mobile: simplified version
 */

export interface UploadParams {
  chunkSize: number;
  maxRetries: number;
  chunkTimeout: number;
  backoffStart: number;
  backoffCeiling: number;
  backoffJitter: number;
}

export interface NetworkProfilerAdapter {
  getUploadParams: () => UploadParams;
  recordChunkMeasurement: (
    bytes: number,
    durationMs: number,
    success: boolean,
    direction: "upload" | "download"
  ) => void;
}

/** Default params (TZ 8.2 conservative defaults) */
const defaultAdapter: NetworkProfilerAdapter = {
  getUploadParams: () => ({
    chunkSize: 128 * 1024,
    maxRetries: 10,
    chunkTimeout: 30_000,
    backoffStart: 1000,
    backoffCeiling: 30_000,
    backoffJitter: 0.2,
  }),
  recordChunkMeasurement: () => {},
};

let _adapter: NetworkProfilerAdapter = defaultAdapter;

export function setNetworkProfilerAdapter(adapter: NetworkProfilerAdapter): void {
  _adapter = adapter;
}

export function getUploadParams(): UploadParams {
  return _adapter.getUploadParams();
}

export function recordChunkMeasurement(
  bytes: number,
  durationMs: number,
  success: boolean,
  direction: "upload" | "download"
): void {
  _adapter.recordChunkMeasurement(bytes, durationMs, success, direction);
}
