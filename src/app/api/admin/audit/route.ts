import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { AuditService } from "@/lib/admin/services/audit-service";
import { parseQuery, auditQuerySchema } from "@/lib/admin/validation";

/** GET /api/admin/audit — Search audit log */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "audit:read");
  if (denied) return denied;

  const parsed = parseQuery(new URL(request.url), auditQuerySchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await AuditService.searchAuditLog(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/audit] search failed:", err);
    return errorResponse("Failed to search audit log", 500);
  }
}
