import { NextResponse, type NextRequest } from "next/server";
import { AuditService } from "@/lib/admin/services/audit-service";

/**
 * GET /api/admin/cron/check-drift
 * Cron job: checks all active templates for configuration drift.
 * Protected by CRON_SECRET header.
 * Schedule: every 6 hours.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await AuditService.checkAllDrift();

    console.log(
      `[cron/check-drift] Done: ${result.templatesChecked} templates, ` +
        `${result.totalChats} chats checked, ${result.driftsFound} drifts found, ` +
        `${result.errors.length} errors`
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/check-drift] failed:", err);
    return NextResponse.json(
      { error: "Cron job failed", message: String(err) },
      { status: 500 }
    );
  }
}
