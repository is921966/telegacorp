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
 * GET /api/admin/archive/export — Export messages as CSV.
 * Access: compliance_officer, super_admin.
 */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "archive:read");
  if (denied) return denied;

  const url = new URL(request.url);
  const chatId = url.searchParams.get("chatId");
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");

  if (!chatId) {
    return errorResponse("chatId is required for export", 400);
  }

  try {
    const supabase = createServerSupabase();

    let query = supabase
      .from("message_archive")
      .select("*")
      .eq("chat_id", parseInt(chatId, 10))
      .order("date", { ascending: true })
      .limit(10000);

    if (dateFrom) {
      query = query.gte("date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("date", dateTo);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Archive export failed: ${error.message}`);

    const rows = (data ?? []) as unknown as MessageRow[];

    // Build CSV
    const headers = [
      "message_id",
      "sender_id",
      "sender_name",
      "date",
      "text",
      "media_type",
      "media_file_name",
      "reply_to_msg_id",
      "forward_from",
      "is_edited",
    ];

    const csvLines = [headers.join(",")];
    for (const row of rows) {
      csvLines.push(
        [
          row.message_id,
          row.sender_id ?? "",
          escapeCsv(row.sender_name),
          row.date,
          escapeCsv(row.text),
          row.media_type ?? "",
          escapeCsv(row.media_file_name),
          row.reply_to_msg_id ?? "",
          escapeCsv(row.forward_from),
          row.is_edited,
        ].join(",")
      );
    }

    const now = new Date().toISOString().slice(0, 10);
    return new NextResponse(csvLines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="archive-${chatId}-${now}.csv"`,
      },
    });
  } catch (err) {
    console.error("[admin/archive/export] failed:", err);
    return errorResponse("Failed to export archive", 500);
  }
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
