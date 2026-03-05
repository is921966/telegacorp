import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/admin/stats — Dashboard statistics
 * Returns aggregated counts for the admin dashboard.
 */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Any admin role can view dashboard stats
  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();

    // Run all count queries in parallel
    const [
      monitoredChatsResult,
      templatesResult,
      adminsResult,
      recentAuditResult,
      agentsResult,
      patternsResult,
    ] = await Promise.all([
      // Managed/monitored chats count
      supabase.from("monitored_chats").select("chat_id", { count: "exact", head: true }),

      // Active policy templates count
      supabase
        .from("policy_templates")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),

      // Admin users count
      supabase.from("admin_roles").select("id", { count: "exact", head: true }),

      // Audit actions in last 24 hours
      supabase
        .from("admin_audit_log")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

      // Active agents count
      supabase
        .from("agents")
        .select("id", { count: "exact", head: true })
        .in("status", ["active", "canary", "shadow"]),

      // New patterns count (awaiting review)
      supabase
        .from("automation_patterns")
        .select("id", { count: "exact", head: true })
        .eq("status", "new"),
    ]);

    return NextResponse.json({
      managedChats: monitoredChatsResult.count ?? 0,
      activeTemplates: templatesResult.count ?? 0,
      admins: adminsResult.count ?? 0,
      actionsLast24h: recentAuditResult.count ?? 0,
      activeAgents: agentsResult.count ?? 0,
      newPatterns: patternsResult.count ?? 0,
    });
  } catch (err) {
    console.error("[Stats API] Error:", err);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
