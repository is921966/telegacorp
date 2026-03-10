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

    const { data: roles, error } = await supabase
      .from("admin_roles")
      .select("id, telegram_id, role, granted_by_telegram_id, granted_at")
      .order("granted_at", { ascending: false });

    if (error) {
      console.error("[Roles API] Failed to query admin_roles:", error);
      return NextResponse.json({ error: "Failed to list roles" }, { status: 500 });
    }

    const admins = (roles ?? []).map((row) => ({
      id: row.id,
      telegramId: row.telegram_id,
      role: row.role,
      grantedByTelegramId: row.granted_by_telegram_id,
      grantedAt: row.granted_at,
    }));

    return NextResponse.json({ admins });
  } catch (err) {
    console.error("[Roles API] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/admin/roles — Assign role to user by Telegram ID */
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

  const { telegramId, role } = parsed.data;

  try {
    const supabase = createServerSupabase();

    // Upsert role (UNIQUE constraint on telegram_id)
    const { data: inserted, error } = await supabase
      .from("admin_roles")
      .upsert(
        {
          telegram_id: telegramId,
          role,
          granted_by_telegram_id: ctx.telegramId,
          granted_at: new Date().toISOString(),
        },
        { onConflict: "telegram_id" }
      )
      .select("id, telegram_id, role, granted_by_telegram_id, granted_at")
      .single();

    if (error) {
      console.error("[Roles API] Failed to assign role:", error);
      return NextResponse.json({ error: "Failed to assign role" }, { status: 500 });
    }

    await logAuditEvent({
      adminTelegramId: ctx.telegramId,
      actionType: "role_assign",
      targetUserId: telegramId,
      payload: { role },
      resultStatus: "success",
      request,
    });

    return NextResponse.json(
      {
        assigned: true,
        admin: {
          id: inserted.id,
          telegramId: inserted.telegram_id,
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
