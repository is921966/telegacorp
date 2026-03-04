import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, errorResponse } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

type Params = { params: Promise<{ agentId: string }> };

/** GET /api/admin/agents/:agentId/metrics — Agent performance metrics */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "agents:read");
  if (denied) return denied;

  const { agentId } = await params;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "30", 10), 100);

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("agent_metrics")
      .select("*")
      .eq("agent_id", agentId)
      .order("period_start", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return NextResponse.json({ metrics: data ?? [] });
  } catch (err) {
    console.error(`[admin/agents/${agentId}/metrics] failed:`, err);
    return errorResponse("Failed to get metrics", 500);
  }
}
