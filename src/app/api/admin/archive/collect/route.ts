import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/admin/archive/collect — Save messages collected by the client-side user session.
 *
 * The Telegram Bot API cannot use messages.GetHistory,
 * so the browser client (which has a user session) fetches history
 * and posts it here for server-side persistence.
 *
 * Access: super_admin (archive:read implied by wildcard).
 */
export async function POST(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "archive:read");
  if (denied) return denied;

  try {
    const body = await request.json();
    const chatId = Number(body.chatId);
    const messages = body.messages as Array<{
      messageId: number;
      senderId: number | null;
      senderName: string | null;
      text: string | null;
      date: string;
      mediaType: string | null;
      mediaFileName: string | null;
      mediaFileSize: number | null;
      replyToMsgId: number | null;
      forwardFrom: string | null;
      isEdited: boolean;
    }>;

    if (!chatId || !Array.isArray(messages) || messages.length === 0) {
      return errorResponse("chatId and messages[] are required", 400);
    }

    const supabase = createServerSupabase();

    const rows = messages.map((m) => ({
      chat_id: chatId,
      message_id: m.messageId,
      sender_id: m.senderId,
      sender_name: m.senderName,
      text: m.text,
      date: m.date,
      media_type: m.mediaType,
      media_file_path: null,
      media_file_name: m.mediaFileName,
      media_file_size: m.mediaFileSize,
      reply_to_msg_id: m.replyToMsgId,
      forward_from: m.forwardFrom,
      is_edited: m.isEdited,
      raw_data: null,
    }));

    const { error: insertError } = await supabase
      .from("message_archive")
      .upsert(rows, { onConflict: "chat_id,message_id" });

    if (insertError) {
      console.error("[archive/collect] Insert error:", insertError);
      return errorResponse("Failed to save messages", 500);
    }

    // Update archive state
    const maxMsgId = Math.max(...messages.map((m) => m.messageId));
    await supabase
      .from("chat_archive_state")
      .upsert(
        {
          chat_id: chatId,
          last_collected_msg_id: maxMsgId,
          last_collected_at: new Date().toISOString(),
          total_messages: messages.length,
          is_enabled: true,
        },
        { onConflict: "chat_id" }
      );

    return NextResponse.json({ ok: true, saved: messages.length });
  } catch (err) {
    console.error("[archive/collect] Failed:", err);
    return errorResponse("Failed to collect messages", 500);
  }
}
