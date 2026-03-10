import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, logAuditEvent } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminRoleEnum } from "@/lib/admin/validation";
import { z } from "zod";

type Params = { params: Promise<{ telegramId: string }> };

const updateRoleSchema = z.object({
  role: adminRoleEnum,
});

/** PATCH /api/admin/roles/:telegramId — Update user role */
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  const { telegramId } = await params;

  // Prevent self-demotion
  if (telegramId === ctx.telegramId) {
    return NextResponse.json(
      { error: "Cannot modify your own role" },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { role } = parsed.data;

  try {
    const supabase = createServerSupabase();

    const { data: existing, error: findError } = await supabase
      .from("admin_roles")
      .select("id, role")
      .eq("telegram_id", telegramId)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { error: "Admin role not found for this user" },
        { status: 404 }
      );
    }

    const oldRole = existing.role;

    const { error: updateError } = await supabase
      .from("admin_roles")
      .update({
        role,
        granted_by_telegram_id: ctx.telegramId,
        granted_at: new Date().toISOString(),
      })
      .eq("telegram_id", telegramId);

    if (updateError) {
      console.error("[Roles API] Failed to update role:", updateError);
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }

    await logAuditEvent({
      adminTelegramId: ctx.telegramId,
      actionType: "role_update",
      targetUserId: telegramId,
      payload: { oldRole, newRole: role },
      resultStatus: "success",
      request,
    });

    return NextResponse.json({ telegramId, updated: true, role });
  } catch (err) {
    console.error("[Roles API] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/admin/roles/:telegramId — Remove admin role */
export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  const { telegramId } = await params;

  // Prevent self-removal
  if (telegramId === ctx.telegramId) {
    return NextResponse.json(
      { error: "Cannot remove your own admin role" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabase();

    const { data: existing, error: findError } = await supabase
      .from("admin_roles")
      .select("id, role")
      .eq("telegram_id", telegramId)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { error: "Admin role not found for this user" },
        { status: 404 }
      );
    }

    const { error: deleteError } = await supabase
      .from("admin_roles")
      .delete()
      .eq("telegram_id", telegramId);

    if (deleteError) {
      console.error("[Roles API] Failed to delete role:", deleteError);
      return NextResponse.json({ error: "Failed to remove role" }, { status: 500 });
    }

    await logAuditEvent({
      adminTelegramId: ctx.telegramId,
      actionType: "role_remove",
      targetUserId: telegramId,
      payload: { removedRole: existing.role },
      resultStatus: "success",
      request,
    });

    return NextResponse.json({ telegramId, removed: true });
  } catch (err) {
    console.error("[Roles API] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
