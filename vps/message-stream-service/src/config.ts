/**
 * Configuration for Message Stream Service.
 * All values sourced from environment variables.
 */
export const config = {
  redis: {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
    streamKey: "corp:messages",
    maxLen: 100_000, // Approximate max entries in stream
    ttlDays: 90,
  },
  telegram: {
    apiId: parseInt(process.env.TELEGRAM_API_ID ?? "0", 10),
    apiHash: process.env.TELEGRAM_API_HASH ?? "",
    session: process.env.TELEGRAM_SESSION ?? "",
  },
  vercel: {
    apiUrl: process.env.VERCEL_API_URL ?? "",
    serviceToken: process.env.SERVICE_API_TOKEN ?? "",
  },
  supabase: {
    url: process.env.SUPABASE_URL ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  },
  /** Polling interval (ms) for checking monitored chats list */
  monitoredChatsRefreshMs: 60_000,
};

export function validateConfig(): void {
  const required = [
    ["TELEGRAM_API_ID", config.telegram.apiId],
    ["TELEGRAM_API_HASH", config.telegram.apiHash],
    ["TELEGRAM_SESSION", config.telegram.session],
    ["VERCEL_API_URL", config.vercel.apiUrl],
    ["SERVICE_API_TOKEN", config.vercel.serviceToken],
  ] as const;

  for (const [name, value] of required) {
    if (!value) {
      throw new Error(`Missing required env var: ${name}`);
    }
  }
}
