import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
  logAuditEvent,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseBody, updatePatternSchema } from "@/lib/admin/validation";

type Params = { params: Promise<{ patternId: string }> };

/** GET /api/admin/patterns/:patternId — Pattern details */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "patterns:manage");
  if (denied) return denied;

  const { patternId } = await params;

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("automation_patterns")
      .select("*")
      .eq("id", patternId)
      .single();

    if (error || !data) return errorResponse("Pattern not found", 404);
    return NextResponse.json({ pattern: data });
  } catch (err) {
    console.error(`[admin/patterns/${patternId}] get failed:`, err);
    return errorResponse("Failed to get pattern", 500);
  }
}

/** PATCH /api/admin/patterns/:patternId — Update pattern */
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "patterns:manage");
  if (denied) return denied;

  const { patternId } = await params;
  const parsed = await parseBody(request, updatePatternSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabase();
    const updateData: Record<string, unknown> = {};

    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
      if (["approved", "rejected"].includes(parsed.data.status)) {
        updateData.reviewed_by_telegram_id = ctx.telegramId;
        updateData.reviewed_at = new Date().toISOString();
      }
    }
    if (parsed.data.frequency !== undefined) updateData.frequency = parsed.data.frequency;
    if (parsed.data.estimated_roi_monthly !== undefined) {
      updateData.estimated_roi_monthly = parsed.data.estimated_roi_monthly;
    }

    const { data, error } = await supabase
      .from("automation_patterns")
      .update(updateData)
      .eq("id", patternId)
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? "Update failed");

    await logAuditEvent({
      adminTelegramId: ctx.telegramId,
      actionType: "update_pattern",
      payload: { patternId, changes: parsed.data },
      resultStatus: "success",
    });

    return NextResponse.json({ pattern: data });
  } catch (err) {
    console.error(`[admin/patterns/${patternId}] update failed:`, err);
    return errorResponse("Failed to update pattern", 500);
  }
}
