import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
  logAuditEvent,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseBody, createAgentSchema } from "@/lib/admin/validation";
import type { Database } from "@/types/database";

type AgentRow = Database["public"]["Tables"]["agents"]["Row"];

/** GET /api/admin/agents — List agents */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "agents:read");
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  try {
    const supabase = createServerSupabase();
    let query = supabase
      .from("agents")
      .select("*")
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      agents: (data ?? []) as unknown as AgentRow[],
      total: (data ?? []).length,
    });
  } catch (err) {
    console.error("[admin/agents] list failed:", err);
    return errorResponse("Failed to list agents", 500);
  }
}

/** POST /api/admin/agents — Create agent */
export async function POST(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "agents:manage");
  if (denied) return denied;

  const parsed = await parseBody(request, createAgentSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("agents")
      .insert({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        model: parsed.data.model,
        pattern_id: parsed.data.pattern_id ?? null,
        config: parsed.data.config ?? {},
        permissions: parsed.data.permissions ?? {},
        assigned_chats: parsed.data.assigned_chats ?? [],
        status: "draft",
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? "Insert failed");

    await logAuditEvent({
      adminTelegramId: ctx.telegramId,
      actionType: "create_agent",
      payload: { agentId: (data as unknown as AgentRow).id, name: parsed.data.name },
      resultStatus: "success",
    });

    return NextResponse.json({ agent: data }, { status: 201 });
  } catch (err) {
    console.error("[admin/agents] create failed:", err);
    return errorResponse("Failed to create agent", 500);
  }
}
