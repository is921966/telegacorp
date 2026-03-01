import { supabase } from "./client";

export async function cacheMessages(
  userId: string,
  chatId: number,
  messages: Array<{
    id: number;
    senderId?: number;
    text?: string;
    date: Date;
    mediaType?: string;
    mediaPath?: string;
    replyToId?: number;
    isOutgoing: boolean;
    rawData?: Record<string, unknown>;
  }>
): Promise<void> {
  if (messages.length === 0) return;

  const rows = messages.map((msg) => ({
    id: msg.id,
    chat_id: chatId,
    user_id: userId,
    sender_id: msg.senderId ?? null,
    message_text: msg.text ?? null,
    date: msg.date.toISOString(),
    media_type: msg.mediaType ?? null,
    media_path: msg.mediaPath ?? null,
    reply_to_id: msg.replyToId ?? null,
    is_outgoing: msg.isOutgoing,
    raw_data: msg.rawData ?? null,
  }));

  const { error } = await supabase
    .from("cached_messages")
    .upsert(rows, { onConflict: "id,chat_id,user_id" });

  if (error) throw error;
}

export async function getCachedMessages(
  userId: string,
  chatId: number,
  limit = 50,
  beforeDate?: Date
) {
  let query = supabase
    .from("cached_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("chat_id", chatId)
    .order("date", { ascending: false })
    .limit(limit);

  if (beforeDate) {
    query = query.lt("date", beforeDate.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function searchCachedMessages(
  userId: string,
  query: string,
  chatId?: number,
  limit = 50
) {
  let dbQuery = supabase
    .from("cached_messages")
    .select("*")
    .eq("user_id", userId)
    .textSearch("message_text", query, { config: "russian" })
    .order("date", { ascending: false })
    .limit(limit);

  if (chatId) {
    dbQuery = dbQuery.eq("chat_id", chatId);
  }

  const { data, error } = await dbQuery;
  if (error) throw error;
  return data;
}
