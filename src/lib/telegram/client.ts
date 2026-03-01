import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

const apiId = Number(process.env.NEXT_PUBLIC_TELEGRAM_API_ID);
const apiHash = (process.env.NEXT_PUBLIC_TELEGRAM_API_HASH || "").trim();

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
      return client;
    } catch (err) {
      console.warn("[TG] connect failed, resetting client:", err);
      clientInstance = null;
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
 */
export async function resetClient(): Promise<void> {
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
