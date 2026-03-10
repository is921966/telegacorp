import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const apiId = Number(process.env.NEXT_PUBLIC_TELEGRAM_API_ID);
const apiHash = (process.env.NEXT_PUBLIC_TELEGRAM_API_HASH || "").trim();

if (typeof window !== "undefined") {
  console.log("[TG Client] API_ID:", apiId, "API_HASH length:", apiHash.length);
}

let clientInstance: TelegramClient | null = null;
let connectPromise: Promise<TelegramClient> | null = null;

/**
 * Clear stale GramJS TL schema cache from localStorage.
 * GramJS caches the TL API schema in "GramJs:apiCache" without version checks.
 * If the cached schema is from a different GramJS version, constructor IDs may differ,
 * causing API_ID_INVALID or other RPC errors.
 */
function clearStaleApiCache(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem("GramJs:apiCache");
  } catch {
    // Ignore: localStorage may be blocked by browser settings
  }
}

export function getTelegramClient(sessionString = ""): TelegramClient {
  if (clientInstance) return clientInstance;

  // Ensure no stale TL schema cache interferes with serialization
  clearStaleApiCache();

  const session = new StringSession(sessionString);
  clientInstance = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
    useWSS: true,
    deviceModel: "Telegram Corp Web",
    systemVersion: "1.0",
    appVersion: "1.0",
  });

  return clientInstance;
}

export function getExistingClient(): TelegramClient | null {
  return clientInstance;
}

export async function connectClient(
  sessionString = ""
): Promise<TelegramClient> {
  // Deduplicate concurrent connection attempts (race between TelegramSessionProvider
  // and useTelegramClient that can confuse GramJS with parallel connect() calls)
  if (connectPromise) return connectPromise;

  const client = getTelegramClient(sessionString);

  if (client.connected) return client;

  connectPromise = (async () => {
    try {
      await client.connect();
      // Verify client wasn't reset during async connect (StrictMode double-effect race)
      if (clientInstance !== client) {
        try { await client.disconnect(); } catch {}
        throw new Error("Connection invalidated by concurrent reset");
      }
      return client;
    } catch (err) {
      console.warn("[TG] connect failed, resetting client:", err);
      // Only null the singleton if it's still OUR client (a concurrent reset
      // may have already replaced it with a newer instance)
      if (clientInstance === client) clientInstance = null;

      // Retry once for transient MTProto handshake errors (nonce mismatch, etc.)
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("nonce") || msg.includes("Step")) {
        console.log("[TG] Retrying connection after handshake error...");
        const freshClient = getTelegramClient(sessionString);
        try {
          await freshClient.connect();
          return freshClient;
        } catch (retryErr) {
          console.error("[TG] Retry also failed:", retryErr);
          if (clientInstance === freshClient) clientInstance = null;
          throw retryErr;
        }
      }

      throw err;
    } finally {
      connectPromise = null;
    }
  })();

  return connectPromise;
}

/**
 * Get the existing client, auto-reconnecting if the WebSocket dropped.
 * Returns null (instead of throwing) if no client exists or reconnection fails.
 * Use this in hooks that make API calls and need a guaranteed-connected client.
 */
export async function getConnectedClient(): Promise<TelegramClient | null> {
  if (!clientInstance) return null;

  if (clientInstance.connected) return clientInstance;

  // WebSocket dropped — try to reconnect silently
  try {
    return await connectClient();
  } catch {
    return null;
  }
}

export async function disconnectClient(): Promise<void> {
  if (clientInstance) {
    await clientInstance.disconnect();
    clientInstance = null;
  }
}

/**
 * Reset the client singleton (disconnect + null).
 * Use before starting a fresh auth flow to clear stale/broken sessions.
 * Also invalidates any in-flight connectPromise so the next connectClient()
 * creates a fresh connection instead of reusing a stale one.
 */
export async function resetClient(): Promise<void> {
  connectPromise = null;
  if (clientInstance) {
    try {
      if (clientInstance.connected) {
        await clientInstance.disconnect();
      }
    } catch {
      // Ignore disconnect errors on broken clients
    }
    clientInstance = null;
  }
}

export function saveSession(): string {
  if (!clientInstance) return "";
  return clientInstance.session.save() as unknown as string;
}
