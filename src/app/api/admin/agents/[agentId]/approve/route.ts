import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
  logAuditEvent,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

type Params = { params: Promise<{ agentId: string }> };

/** POST /api/admin/agents/:agentId/approve — Approve agent for deployment */
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "governance:manage");
  if (denied) return denied;

  const { agentId } = await params;

  try {
    const supabase = createServerSupabase();

    // Only approve agents in "proposed" or "testing" status
    const { data: agent } = await supabase
      .from("agents")
      .select("status")
      .eq("id", agentId)
      .single();

    if (!agent) return errorResponse("Agent not found", 404);

    const currentStatus = (agent as unknown as { status: string }).status;
    if (!["proposed", "testing"].includes(currentStatus)) {
      return errorResponse(
        `Cannot approve agent in "${currentStatus}" status`,
        400
      );
    }

    const { error } = await supabase
      .from("agents")
      .update({
        status: "approved",
        approved_by_telegram_id: ctx.telegramId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", agentId);

    if (error) throw new Error(error.message);

    await logAuditEvent({
      adminTelegramId: ctx.telegramId,
      actionType: "approve_agent",
      payload: { agentId },
      resultStatus: "success",
    });

    return NextResponse.json({ agentId, approved: true });
  } catch (err) {
    console.error(`[admin/agents/${agentId}/approve] failed:`, err);
    return errorResponse("Failed to approve agent", 500);
  }
}
