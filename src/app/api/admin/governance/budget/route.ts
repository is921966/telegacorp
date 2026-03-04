import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, errorResponse } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

/** GET /api/admin/governance/budget — Per-agent cost breakdown */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "governance:read");
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();

    // Get agents with their aggregated metrics
    const { data: agents } = await supabase
      .from("agents")
      .select("id, name, status")
      .in("status", ["active", "canary", "shadow", "testing"]);

    if (!agents || agents.length === 0) {
      return NextResponse.json({ agents: [], totalCostUsd: 0 });
    }

    const agentIds = (agents as unknown as { id: string }[]).map((a) => a.id);

    const { data: metrics } = await supabase
      .from("agent_metrics")
      .select("agent_id, cost_usd, tokens_consumed, executions")
      .in("agent_id", agentIds);

    // Aggregate by agent
    const costMap = new Map<
      string,
      { cost: number; tokens: number; executions: number }
    >();
    for (const m of (metrics ?? []) as unknown as {
      agent_id: string;
      cost_usd: number;
      tokens_consumed: number;
      executions: number;
    }[]) {
      const cur = costMap.get(m.agent_id) ?? { cost: 0, tokens: 0, executions: 0 };
      cur.cost += Number(m.cost_usd);
      cur.tokens += Number(m.tokens_consumed);
      cur.executions += m.executions;
      costMap.set(m.agent_id, cur);
    }

    const result = (agents as unknown as { id: string; name: string; status: string }[]).map((a) => {
      const data = costMap.get(a.id) ?? { cost: 0, tokens: 0, executions: 0 };
      return {
        id: a.id,
        name: a.name,
        status: a.status,
        totalCostUsd: Math.round(data.cost * 100) / 100,
        totalTokens: data.tokens,
        totalExecutions: data.executions,
      };
    });

    const totalCostUsd = result.reduce((s, a) => s + a.totalCostUsd, 0);

    return NextResponse.json({
      agents: result,
      totalCostUsd: Math.round(totalCostUsd * 100) / 100,
    });
  } catch (err) {
    console.error("[admin/governance/budget] failed:", err);
    return errorResponse("Failed to get budget data", 500);
  }
}
