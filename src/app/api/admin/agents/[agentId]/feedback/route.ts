import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, errorResponse } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseBody, submitFeedbackSchema } from "@/lib/admin/validation";

type Params = { params: Promise<{ agentId: string }> };

/** GET /api/admin/agents/:agentId/feedback — Agent feedback list */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "agents:read");
  if (denied) return denied;

  const { agentId } = await params;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("agent_feedback")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return NextResponse.json({ feedback: data ?? [] });
  } catch (err) {
    console.error(`[admin/agents/${agentId}/feedback] get failed:`, err);
    return errorResponse("Failed to get feedback", 500);
  }
}

/** POST /api/admin/agents/:agentId/feedback — Submit feedback */
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  // Any admin can submit feedback
  const { agentId } = await params;
  const parsed = await parseBody(request, submitFeedbackSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("agent_feedback")
      .insert({
        agent_id: agentId,
        telegram_id: ctx.telegramId,
        type: parsed.data.type,
        message: parsed.data.message ?? null,
        original_output: parsed.data.original_output ?? null,
        corrected_output: parsed.data.corrected_output ?? null,
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? "Insert failed");
    return NextResponse.json({ feedback: data }, { status: 201 });
  } catch (err) {
    console.error(`[admin/agents/${agentId}/feedback] submit failed:`, err);
    return errorResponse("Failed to submit feedback", 500);
  }
}
