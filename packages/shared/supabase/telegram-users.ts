import { supabase } from "./client";
import type { TelegramUser } from "../types/telegram";

/**
 * Upsert Telegram user profile on login.
 * Called after getMe() to maintain a directory of known users.
 */
export async function upsertTelegramUser(user: TelegramUser): Promise<void> {
  const { error } = await supabase.from("telegram_users").upsert(
    {
      telegram_id: user.id,
      first_name: user.firstName,
      last_name: user.lastName ?? null,
      username: user.username ?? null,
      phone: user.phone ?? null,
      photo_url: user.photoUrl ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "telegram_id" }
  );

  if (error) {
    console.error("[TelegramUsers] Failed to upsert:", error);
  }
}
