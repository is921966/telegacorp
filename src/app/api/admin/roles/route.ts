import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, logAuditEvent } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseBody, assignRoleSchema } from "@/lib/admin/validation";

/** GET /api/admin/roles — List admin users and their roles */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();

    // Query admin_roles table
    const { data: roles, error } = await supabase
      .from("admin_roles")
      .select("id, user_id, role, granted_by, granted_at")
      .order("granted_at", { ascending: false });

    if (error) {
      console.error("[Roles API] Failed to query admin_roles:", error);
      return NextResponse.json({ error: "Failed to list roles" }, { status: 500 });
    }

    // Enrich with user emails via Supabase Auth Admin API
    const admins = await Promise.all(
      (roles ?? []).map(async (row) => {
        let email: string | null = null;
        let grantedByEmail: string | null = null;

        try {
          const { data: userData } = await supabase.auth.admin.getUserById(row.user_id);
          email = userData?.user?.email ?? null;
        } catch {
          // User may have been deleted
        }

        if (row.granted_by) {
          try {
            const { data: granterData } = await supabase.auth.admin.getUserById(row.granted_by);
            grantedByEmail = granterData?.user?.email ?? null;
          } catch {
            // Granter may have been deleted
          }
        }

        return {
          id: row.id,
          userId: row.user_id,
          email,
          role: row.role,
          grantedBy: row.granted_by,
          grantedByEmail,
          grantedAt: row.granted_at,
        };
      })
    );

    return NextResponse.json({ admins });
  } catch (err) {
    console.error("[Roles API] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/admin/roles — Assign role to user */
export async function POST(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  const parsed = await parseBody(request, assignRoleSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { userId, role } = parsed.data;

  try {
    const supabase = createServerSupabase();

    // Verify target user exists
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData?.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Upsert role (UNIQUE constraint on user_id)
    const { data: inserted, error } = await supabase
      .from("admin_roles")
      .upsert(
        {
          user_id: userId,
          role,
          granted_by: ctx.userId,
          granted_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("id, user_id, role, granted_by, granted_at")
      .single();

    if (error) {
      console.error("[Roles API] Failed to assign role:", error);
      return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
    }

    // Audit log
    await logAuditEvent({
      adminUserId: ctx.userId,
      actionType: "role_assign",
      targetUserId: userId,
      payload: { role },
      resultStatus: "success",
      request,
    });

    return NextResponse.json(
      {
        assigned: true,
        admin: {
          id: inserted.id,
          userId: inserted.user_id,
          email: userData.user.email,
          role: inserted.role,
          grantedAt: inserted.granted_at,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[Roles API] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
