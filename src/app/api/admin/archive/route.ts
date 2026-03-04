import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MessageRow = Database["public"]["Tables"]["message_archive"]["Row"];

/**
 * GET /api/admin/archive — Search message archive.
 * Supports full-text search (Russian) and filters.
 * Access: compliance_officer, super_admin.
 */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "archive:read");
  if (denied) return denied;

  const url = new URL(request.url);
  const searchText = url.searchParams.get("q") ?? "";
  const chatId = url.searchParams.get("chatId");
  const senderId = url.searchParams.get("senderId");
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");
  const mediaType = url.searchParams.get("mediaType");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  try {
    const supabase = createServerSupabase();

    let query = supabase
      .from("message_archive")
      .select("*", { count: "exact" })
      .order("date", { ascending: false });

    // Full-text search on Russian text
    if (searchText) {
      query = query.textSearch("text", searchText, {
        type: "websearch",
        config: "russian",
      });
    }

    if (chatId) {
      query = query.eq("chat_id", parseInt(chatId, 10));
    }
    if (senderId) {
      query = query.eq("sender_id", parseInt(senderId, 10));
    }
    if (dateFrom) {
      query = query.gte("date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("date", dateTo);
    }
    if (mediaType) {
      if (mediaType === "none") {
        query = query.is("media_type", null);
      } else {
        query = query.eq("media_type", mediaType);
      }
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Archive search failed: ${error.message}`);

    const messages = ((data ?? []) as unknown as MessageRow[]).map((row) => ({
      id: row.id,
      chatId: row.chat_id,
      messageId: row.message_id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      text: row.text,
      date: row.date,
      mediaType: row.media_type,
      mediaFileName: row.media_file_name,
      mediaFileSize: row.media_file_size,
      replyToMsgId: row.reply_to_msg_id,
      forwardFrom: row.forward_from,
      isEdited: row.is_edited,
    }));

    return NextResponse.json({
      messages,
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[admin/archive] search failed:", err);
    return errorResponse("Failed to search archive", 500);
  }
}
