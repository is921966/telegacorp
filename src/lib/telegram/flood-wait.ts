/** Max seconds we're willing to wait for a FLOOD_WAIT retry */
const MAX_WAIT_SECONDS = 60;

/**
 * Extract wait seconds from a GramJS FloodWaitError or raw RPCError.
 * GramJS: err.seconds  /  err.message = "A wait of N seconds is required ..."
 * Raw:    err.errorMessage = "FLOOD_WAIT_N"
 */
function extractFloodWaitSeconds(err: unknown): number | null {
  if (err == null || typeof err !== "object") return null;
  const e = err as Record<string, unknown>;

  // GramJS FloodWaitError has a `seconds` field
  if (typeof e.seconds === "number" && e.seconds > 0) return e.seconds;

  // GramJS error message: "A wait of N seconds is required ..."
  if (typeof e.message === "string") {
    const match = e.message.match(/wait of (\d+) seconds/i);
    if (match) return parseInt(match[1], 10);
  }

  // Raw RPC: "FLOOD_WAIT_N"
  if (typeof e.errorMessage === "string" && e.errorMessage.startsWith("FLOOD_WAIT_")) {
    return parseInt(e.errorMessage.replace("FLOOD_WAIT_", ""), 10) || null;
  }

  return null;
}

export async function callWithFloodWait<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const waitSeconds = extractFloodWaitSeconds(err);

      if (waitSeconds !== null) {
        // If the wait is too long, fail fast with a readable message
        if (waitSeconds > MAX_WAIT_SECONDS) {
          const minutes = Math.ceil(waitSeconds / 60);
          throw new Error(`Telegram rate limit: retry in ~${minutes} min`);
        }
        const jitter = Math.random() * 0.5 + 0.75;
        const delay = waitSeconds * jitter * 1000;
        console.warn(
          `FLOOD_WAIT: sleeping ${(delay / 1000).toFixed(1)}s (attempt ${attempt + 1}/${maxRetries})`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        const error = err as { code?: number };
        if (error.code === 429) {
          const backoff = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        } else {
          throw err;
        }
      }
    }
  }
  throw new Error("Max retries exceeded for flood wait");
}

export class RateLimiter {
  private callLog: Map<string, number[]> = new Map();

  async throttle(method: string, minInterval = 1000): Promise<void> {
    const now = Date.now();
    const log = this.callLog.get(method) || [];
    const recent = log.filter((t) => now - t < 60000);

    if (recent.length > 0) {
      const lastCall = recent[recent.length - 1];
      const elapsed = now - lastCall;
      if (elapsed < minInterval) {
        await new Promise((r) => setTimeout(r, minInterval - elapsed));
      }
    }

    recent.push(Date.now());
    this.callLog.set(method, recent);
  }
}

export const rateLimiter = new RateLimiter();
