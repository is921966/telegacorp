import { supabase } from "./client";
import { encryptSession, decryptSession } from "@/lib/crypto";

export async function saveTelegramSession(
  userId: string,
  sessionString: string,
  encryptionKey: string,
  dcId?: number,
  phoneHash?: string
): Promise<void> {
  const encrypted = await encryptSession(sessionString, encryptionKey);

  const { error } = await supabase.from("telegram_sessions").upsert(
    {
      user_id: userId,
      session_data: encrypted,
      dc_id: dcId ?? null,
      phone_hash: phoneHash ?? null,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) throw error;
}

export async function loadTelegramSession(
  userId: string,
  encryptionKey: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("telegram_sessions")
    .select("session_data")
    .eq("user_id", userId)
    .eq("is_active", true)
    .single();

  if (error || !data) return null;

  try {
    return await decryptSession(data.session_data, encryptionKey);
  } catch {
    return null;
  }
}

export async function deleteTelegramSession(userId: string): Promise<void> {
  const { error } = await supabase
    .from("telegram_sessions")
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
