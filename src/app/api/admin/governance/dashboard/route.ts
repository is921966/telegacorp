import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, errorResponse } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

/** GET /api/admin/governance/dashboard — Governance overview metrics */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "governance:read");
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();

    // Parallel queries for dashboard aggregates
    const [agentsRes, patternsRes, monitoringRes, metricsRes] =
      await Promise.all([
        supabase.from("agents").select("status"),
        supabase.from("automation_patterns").select("status"),
        supabase
          .from("monitored_chats")
          .select("chat_id")
          .eq("monitoring_enabled", true),
        supabase
          .from("agent_metrics")
          .select("executions, cost_usd, time_saved_minutes"),
      ]);

    const agents = (agentsRes.data ?? []) as unknown as { status: string }[];
    const patterns = (patternsRes.data ?? []) as unknown as { status: string }[];
    const monitoredChats = monitoringRes.data ?? [];
    const metrics = (metricsRes.data ?? []) as unknown as {
      executions: number;
      cost_usd: number;
      time_saved_minutes: number;
    }[];

    const totalExecutions = metrics.reduce((s, m) => s + m.executions, 0);
    const totalCostUsd = metrics.reduce((s, m) => s + Number(m.cost_usd), 0);
    const totalTimeSaved = metrics.reduce(
      (s, m) => s + m.time_saved_minutes,
      0
    );

    return NextResponse.json({
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.status === "active").length,
      totalPatterns: patterns.length,
      pendingPatterns: patterns.filter((p) =>
        ["new", "proposed"].includes(p.status)
      ).length,
      monitoredChats: monitoredChats.length,
      totalExecutions,
      totalCostUsd: Math.round(totalCostUsd * 100) / 100,
      totalTimeSavedMinutes: totalTimeSaved,
    });
  } catch (err) {
    console.error("[admin/governance/dashboard] failed:", err);
    return errorResponse("Failed to get dashboard", 500);
  }
}
