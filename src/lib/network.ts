/**
 * Network quality detection using the Network Information API.
 * Falls back gracefully when API is unavailable.
 */

type ConnectionQuality = "fast" | "slow" | "offline";

type NetworkInfoConnection = {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

let cachedQuality: ConnectionQuality = "fast";
const listeners = new Set<(quality: ConnectionQuality) => void>();

function getConnection(): NetworkInfoConnection | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as unknown as { connection?: NetworkInfoConnection }).connection;
}

function detectQuality(): ConnectionQuality {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";

  const conn = getConnection();
  if (!conn) return cachedQuality;

  // Data saver mode — always treat as slow
  if (conn.saveData) return "slow";

  const effectiveType = conn.effectiveType;
  if (effectiveType === "slow-2g" || effectiveType === "2g") return "slow";
  if (effectiveType === "3g") {
    // 3g can be OK or slow depending on actual speed
    if (conn.downlink !== undefined && conn.downlink < 1) return "slow";
    if (conn.rtt !== undefined && conn.rtt > 500) return "slow";
    return "slow"; // Default 3g to slow
  }

  // 4g with poor actual metrics
  if (conn.rtt !== undefined && conn.rtt > 1000) return "slow";
  if (conn.downlink !== undefined && conn.downlink < 0.5) return "slow";

  return "fast";
}

function notifyListeners() {
  const newQuality = detectQuality();
  if (newQuality !== cachedQuality) {
    cachedQuality = newQuality;
    for (const listener of listeners) {
      listener(cachedQuality);
    }
  }
}

// Initialize and listen to changes
if (typeof window !== "undefined") {
  cachedQuality = detectQuality();

  const conn = getConnection();
  if (conn?.addEventListener) {
    conn.addEventListener("change", notifyListeners);
  }

  window.addEventListener("online", notifyListeners);
  window.addEventListener("offline", notifyListeners);
}

/** Get current connection quality (sync) */
export function getConnectionQuality(): ConnectionQuality {
  return cachedQuality;
}

/** Subscribe to connection quality changes */
export function onConnectionChange(listener: (quality: ConnectionQuality) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Check if current connection is slow (convenience helper) */
export function isSlowConnection(): boolean {
  return detectQuality() === "slow";
}
