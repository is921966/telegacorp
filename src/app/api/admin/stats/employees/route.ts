import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/admin/stats/employees — Employee statistics for dashboard
 */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();

    const now = new Date();
    const day1 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      totalRes,
      seenDay1Res,
      seenDay7Res,
      seenDay30Res,
      newDay7Res,
      newDay30Res,
      withPhoneRes,
      withUsernameRes,
      withPhotoRes,
      rolesRes,
      companiesRes,
      sessionsRes,
      workspaceTimeRes,
    ] = await Promise.all([
      // Total users
      supabase.from("telegram_users").select("telegram_id", { count: "exact", head: true }),

      // Active last 24h
      supabase
        .from("telegram_users")
        .select("telegram_id", { count: "exact", head: true })
        .gte("last_seen_at", day1),

      // Active last 7d
      supabase
        .from("telegram_users")
        .select("telegram_id", { count: "exact", head: true })
        .gte("last_seen_at", day7),

      // Active last 30d
      supabase
        .from("telegram_users")
        .select("telegram_id", { count: "exact", head: true })
        .gte("last_seen_at", day30),

      // New last 7d
      supabase
        .from("telegram_users")
        .select("telegram_id", { count: "exact", head: true })
        .gte("created_at", day7),

      // New last 30d
      supabase
        .from("telegram_users")
        .select("telegram_id", { count: "exact", head: true })
        .gte("created_at", day30),

      // With phone
      supabase
        .from("telegram_users")
        .select("telegram_id", { count: "exact", head: true })
        .not("phone", "is", null),

      // With username
      supabase
        .from("telegram_users")
        .select("telegram_id", { count: "exact", head: true })
        .not("username", "is", null),

      // With photo
      supabase
        .from("telegram_users")
        .select("telegram_id", { count: "exact", head: true })
        .not("photo_url", "is", null),

      // All admin roles
      supabase.from("admin_roles").select("telegram_id, role"),

      // All companies
      supabase.from("work_companies").select("telegram_id, companies"),

      // Sessions (for time-in-app calculation)
      supabase
        .from("telegram_sessions")
        .select("user_id, is_active, created_at, updated_at"),

      // Workspace time (personal/work area tracking)
      supabase
        .from("workspace_time")
        .select("telegram_id, personal_seconds, work_seconds"),
    ]);

    // Role breakdown
    const roles = rolesRes.data ?? [];
    const roleBreakdown: Record<string, number> = {};
    for (const r of roles) {
      roleBreakdown[r.role] = (roleBreakdown[r.role] ?? 0) + 1;
    }

    // Company breakdown
    const companies = companiesRes.data ?? [];
    const domainCounts: Record<string, number> = {};
    let withCompany = 0;
    for (const c of companies) {
      const arr = c.companies as Array<{ email?: string; domain?: string; enabled?: boolean }> | null;
      if (arr && arr.length > 0) {
        withCompany++;
        for (const comp of arr) {
          // Extract domain from email (user@domain.com → domain.com) or use domain field
          const domain = comp.domain || (comp.email?.includes("@") ? comp.email.split("@")[1] : null);
          if (domain) {
            domainCounts[domain] = (domainCounts[domain] ?? 0) + 1;
          }
        }
      }
    }

    // Top domains sorted by count desc
    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    // Session duration stats
    const sessions = sessionsRes.data ?? [];
    let totalSessionMinutes = 0;
    let activeSessions = 0;
    let longestSessionMinutes = 0;
    const sessionDurations: number[] = [];

    for (const s of sessions) {
      if (s.created_at && s.updated_at) {
        const dur =
          (new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()) /
          (1000 * 60);
        if (dur > 0) {
          sessionDurations.push(dur);
          totalSessionMinutes += dur;
          if (dur > longestSessionMinutes) longestSessionMinutes = dur;
        }
      }
      if (s.is_active) activeSessions++;
    }

    const avgSessionMinutes =
      sessionDurations.length > 0
        ? totalSessionMinutes / sessionDurations.length
        : 0;

    // Workspace time aggregation
    const wsTimeRows = workspaceTimeRes.data ?? [];
    let totalPersonalSeconds = 0;
    let totalWorkSeconds = 0;
    for (const row of wsTimeRows) {
      totalPersonalSeconds += Number(row.personal_seconds) || 0;
      totalWorkSeconds += Number(row.work_seconds) || 0;
    }
    const wsUserCount = wsTimeRows.length || 1; // avoid division by zero

    return NextResponse.json({
      total: totalRes.count ?? 0,
      activity: {
        last24h: seenDay1Res.count ?? 0,
        last7d: seenDay7Res.count ?? 0,
        last30d: seenDay30Res.count ?? 0,
      },
      newUsers: {
        last7d: newDay7Res.count ?? 0,
        last30d: newDay30Res.count ?? 0,
      },
      profile: {
        withPhone: withPhoneRes.count ?? 0,
        withUsername: withUsernameRes.count ?? 0,
        withPhoto: withPhotoRes.count ?? 0,
      },
      admins: {
        total: roles.length,
        byRole: roleBreakdown,
      },
      companies: {
        withCompany,
        topDomains,
      },
      sessions: {
        total: sessions.length,
        active: activeSessions,
        avgDurationMinutes: Math.round(avgSessionMinutes),
        longestDurationMinutes: Math.round(longestSessionMinutes),
        totalTimeMinutes: Math.round(totalSessionMinutes),
      },
      workspaceTime: {
        users: wsTimeRows.length,
        totalPersonalMinutes: Math.round(totalPersonalSeconds / 60),
        totalWorkMinutes: Math.round(totalWorkSeconds / 60),
        avgPersonalMinutes: Math.round(totalPersonalSeconds / 60 / wsUserCount),
        avgWorkMinutes: Math.round(totalWorkSeconds / 60 / wsUserCount),
      },
    });
  } catch (err) {
    console.error("[Stats/Employees API] Error:", err);
    return NextResponse.json({ error: "Failed to load employee stats" }, { status: 500 });
  }
}
