import { NextResponse, type NextRequest } from "next/server";
import { AuditService } from "@/lib/admin/services/audit-service";

/**
 * GET /api/admin/cron/collect-messages
 * Cron job: collects messages from managed chats into message_archive.
 * Protected by CRON_SECRET header.
 * Schedule: every 15 minutes.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await AuditService.collectMessages();

    console.log(
      `[cron/collect-messages] Done: ${result.chatsProcessed} chats, ` +
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
