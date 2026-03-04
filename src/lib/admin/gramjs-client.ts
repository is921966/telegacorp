import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { callWithFloodWait, RateLimiter } from "@/lib/telegram/flood-wait";
import { createServerSupabase } from "@/lib/supabase/server";
import { decryptSession } from "@/lib/crypto";

// ---- Config ----

const apiId = Number(process.env.NEXT_PUBLIC_TELEGRAM_API_ID);
const apiHash = (process.env.NEXT_PUBLIC_TELEGRAM_API_HASH || "").trim();

const botRateLimiter = new RateLimiter();
const userRateLimiter = new RateLimiter();

// ---- Bot Client ----

/**
 * Creates a bot TelegramClient, executes `fn`, then disconnects.
 * Uses ADMIN_BOT_TOKEN — the bot must be added as admin to target chats.
 *
 * TCP connection (server-side, no WebSocket).
 */
export async function withBotClient<T>(
  fn: (client: TelegramClient) => Promise<T>
): Promise<T> {
  const botToken = process.env.ADMIN_BOT_TOKEN;
  if (!botToken) {
    throw new Error("Missing ADMIN_BOT_TOKEN");
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 3,
    useWSS: false, // TCP on server
  });

  try {
    await client.start({ botAuthToken: botToken });
    return await fn(client);
  } finally {
    await client.disconnect().catch(() => {});
  }
}

// ---- User Client ----

/**
 * Creates a user TelegramClient from encrypted session in Supabase,
 * executes `fn`, then disconnects.
 *
 * Used for operations that require a user account
 * (CreateChannel, GetAdminLog, etc.).
 */
export async function withUserClient<T>(
  userId: string,
  fn: (client: TelegramClient) => Promise<T>
): Promise<T> {
  const encryptionKey = process.env.SESSION_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("Missing SESSION_ENCRYPTION_KEY");
  }

  // Fetch encrypted session from Supabase
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("telegram_sessions")
    .select("session_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error || !data) {
    throw new Error(`No active Telegram session for user ${userId}`);
  }

  // Decrypt session string
  const sessionString = await decryptSession(data.session_data, encryptionKey);

  const client = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    {
      connectionRetries: 3,
      useWSS: false, // TCP on server
    }
  );

  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.disconnect().catch(() => {});
  }
}

// ---- Rate-limited wrappers ----

/**
 * Execute a bot API call with rate limiting and flood-wait handling.
 */
export async function botApiCall<T>(
  method: string,
  fn: (client: TelegramClient) => Promise<T>,
  minInterval = 1500
): Promise<T> {
  await botRateLimiter.throttle(method, minInterval);
  return withBotClient((client) => callWithFloodWait(() => fn(client)));
}

/**
 * Execute a user API call with rate limiting and flood-wait handling.
 */
export async function userApiCall<T>(
  userId: string,
  method: string,
  fn: (client: TelegramClient) => Promise<T>,
  minInterval = 1500
): Promise<T> {
  await userRateLimiter.throttle(method, minInterval);
  return withUserClient(userId, (client) =>
    callWithFloodWait(() => fn(client))
  );
}
