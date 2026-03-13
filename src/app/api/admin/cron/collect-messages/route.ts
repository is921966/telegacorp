import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuditService } from "@/lib/admin/services/audit-service";

/**
 * GET /api/admin/cron/collect-messages
 * Cron job: collects messages from managed chats into message_archive.
 * Protected by CRON_SECRET header.
 * Schedule: every 15 minutes.
 * Uses super_admin user session when available, falls back to bot.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();

    // Get a super_admin telegram_id for user session (optional — falls back to bot)
    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("telegram_id")
      .eq("role", "super_admin")
      .limit(1)
      .single();

    const userId = adminRole?.telegram_id ?? undefined;

    const result = await AuditService.collectMessages(userId);

    const mode = userId ? "user session" : "bot";
    console.log(
      `[cron/collect-messages] Done (${mode}): ${result.chatsProcessed} chats, ` +
        `${result.messagesCollected} messages, ${result.errors.length} errors`
    );

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    console.error("[cron/collect-messages] failed:", err);
    return NextResponse.json(
      { error: "Cron job failed", message: String(err) },
      { status: 500 }
    );
  }
}
