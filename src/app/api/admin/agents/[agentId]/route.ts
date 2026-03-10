import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
  logAuditEvent,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseBody, updateAgentSchema } from "@/lib/admin/validation";

type Params = { params: Promise<{ agentId: string }> };

/** GET /api/admin/agents/:agentId — Agent details */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "agents:read");
  if (denied) return denied;

  const { agentId } = await params;

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .single();

    if (error || !data) return errorResponse("Agent not found", 404);

    return NextResponse.json({ agent: data });
  } catch (err) {
    console.error(`[admin/agents/${agentId}] get failed:`, err);
    return errorResponse("Failed to get agent", 500);
  }
}

/** PATCH /api/admin/agents/:agentId — Update agent */
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "agents:manage");
  if (denied) return denied;

  const { agentId } = await params;
  const parsed = await parseBody(request, updateAgentSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabase();
    const updateData: Record<string, unknown> = {};

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.model !== undefined) updateData.model = parsed.data.model;
    if (parsed.data.config !== undefined) updateData.config = parsed.data.config;
    if (parsed.data.permissions !== undefined) updateData.permissions = parsed.data.permissions;
    if (parsed.data.assigned_chats !== undefined) updateData.assigned_chats = parsed.data.assigned_chats;

    const { data, error } = await supabase
      .from("agents")
      .update(updateData)
      .eq("id", agentId)
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? "Update failed");

    await logAuditEvent({
      adminTelegramId: ctx.telegramId,
      actionType: "update_agent",
      payload: { agentId, changes: parsed.data },
      resultStatus: "success",
    });

    return NextResponse.json({ agent: data });
  } catch (err) {
    console.error(`[admin/agents/${agentId}] update failed:`, err);
    return errorResponse("Failed to update agent", 500);
  }
}

/** DELETE /api/admin/agents/:agentId — Retire agent */
export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "agents:manage");
  if (denied) return denied;

  const { agentId } = await params;

  try {
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("agents")
      .update({ status: "retired", retired_at: new Date().toISOString() })
      .eq("id", agentId);

    if (error) throw new Error(error.message);

    await logAuditEvent({
      adminTelegramId: ctx.telegramId,
      actionType: "retire_agent",
      payload: { agentId },
      resultStatus: "success",
    });

    return NextResponse.json({ agentId, retired: true });
  } catch (err) {
    console.error(`[admin/agents/${agentId}] retire failed:`, err);
    return errorResponse("Failed to retire agent", 500);
  }
}
