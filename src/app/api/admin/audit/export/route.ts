import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { AuditService } from "@/lib/admin/services/audit-service";

/** GET /api/admin/audit/export — Export audit log as CSV */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "audit:read");
  if (denied) return denied;

  const url = new URL(request.url);
  const filters = {
    adminUserId: url.searchParams.get("adminUserId") ?? undefined,
    actionType: url.searchParams.get("actionType") ?? undefined,
    chatId: url.searchParams.get("chatId") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  };

  try {
    const csv = await AuditService.exportAuditLog(filters);
    const now = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-log-${now}.csv"`,
      },
    });
  } catch (err) {
    console.error("[admin/audit/export] failed:", err);
    return errorResponse("Failed to export audit log", 500);
  }
}
