import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
  logAuditEvent,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

type Params = { params: Promise<{ patternId: string }> };

/** POST /api/admin/patterns/:patternId/approve — Approve or reject a pattern */
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "governance:manage");
  if (denied) return denied;

  const { patternId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = (body as Record<string, unknown>).action as string;

  if (!["approve", "reject"].includes(action)) {
    return errorResponse('action must be "approve" or "reject"', 400);
  }

  try {
    const supabase = createServerSupabase();
    const newStatus = action === "approve" ? "approved" : "rejected";

    const { error } = await supabase
      .from("automation_patterns")
      .update({
        status: newStatus,
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", patternId);

    if (error) throw new Error(error.message);

    await logAuditEvent({
      adminUserId: ctx.userId,
      actionType: `${action}_pattern`,
      payload: { patternId },
      resultStatus: "success",
    });

    return NextResponse.json({ patternId, status: newStatus });
  } catch (err) {
    console.error(`[admin/patterns/${patternId}/approve] failed:`, err);
    return errorResponse("Failed to approve/reject pattern", 500);
  }
}
