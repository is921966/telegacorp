import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { AuditService } from "@/lib/admin/services/audit-service";

/**
 * GET /api/admin/cron/collect-events
 * Cron job: collects Telegram admin event logs from managed chats.
 * Telegram keeps admin logs only for 48 hours — run hourly.
 * Protected by CRON_SECRET header.
 * Uses the first super_admin's user ID for GramJS user session.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();

    // Get a super_admin userId for the GramJS user session
    const { data: adminRole } = await supabase
      .from("admin_roles")
      .select("user_id")
      .eq("role", "super_admin")
      .limit(1)
      .single();

    if (!adminRole) {
      return NextResponse.json(
        { error: "No super_admin found to run event collection" },
        { status: 500 }
      );
    }

    const userId = (adminRole as unknown as { user_id: string }).user_id;

    // Get managed chat IDs from chat_archive_state (is_enabled)
    const { data: states } = await supabase
      .from("chat_archive_state")
      .select("chat_id")
      .eq("is_enabled", true);

    if (!states || states.length === 0) {
      return NextResponse.json({ ok: true, collected: 0, message: "No chats to collect from" });
    }

    const chatIds = (states as unknown as { chat_id: number }[]).map((s) =>
      String(s.chat_id)
    );

    const result = await AuditService.collectChatEventLogs(userId, chatIds);

    console.log(
      `[cron/collect-events] Done: ${result.collected} events, ${result.errors.length} errors`
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/collect-events] failed:", err);
    return NextResponse.json(
      { error: "Cron job failed", message: String(err) },
      { status: 500 }
    );
  }
}
