import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, logAuditEvent } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminRoleEnum } from "@/lib/admin/validation";
import { z } from "zod";

type Params = { params: Promise<{ userId: string }> };

const updateRoleSchema = z.object({
  role: adminRoleEnum,
});

/** PATCH /api/admin/roles/:userId — Update user role */
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  const { userId } = await params;

  // Prevent self-demotion
  if (userId === ctx.userId) {
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

    // Check existing role
    const { data: existing, error: findError } = await supabase
      .from("admin_roles")
      .select("id, role")
      .eq("user_id", userId)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { error: "Admin role not found for this user" },
        { status: 404 }
      );
    }

    const oldRole = existing.role;

    // Update role
    const { error: updateError } = await supabase
      .from("admin_roles")
      .update({
        role,
        granted_by: ctx.userId,
        granted_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (updateError) {
      console.error("[Roles API] Failed to update role:", updateError);
      return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
    }

    // Audit log
    await logAuditEvent({
      adminUserId: ctx.userId,
      actionType: "role_update",
      targetUserId: userId,
      payload: { oldRole, newRole: role },
      resultStatus: "success",
      request,
    });

    return NextResponse.json({ userId, updated: true, role });
  } catch (err) {
    console.error("[Roles API] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/admin/roles/:userId — Remove admin role */
export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  const { userId } = await params;

  // Prevent self-removal
  if (userId === ctx.userId) {
    return NextResponse.json(
      { error: "Cannot remove your own admin role" },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabase();

    // Check existing role
    const { data: existing, error: findError } = await supabase
      .from("admin_roles")
      .select("id, role")
      .eq("user_id", userId)
      .single();

    if (findError || !existing) {
      return NextResponse.json(
        { error: "Admin role not found for this user" },
        { status: 404 }
      );
    }

    // Delete role
    const { error: deleteError } = await supabase
      .from("admin_roles")
      .delete()
      .eq("user_id", userId);

    if (deleteError) {
      console.error("[Roles API] Failed to delete role:", deleteError);
      return NextResponse.json({ error: "Failed to remove role" }, { status: 500 });
    }

    // Audit log
    await logAuditEvent({
      adminUserId: ctx.userId,
      actionType: "role_remove",
      targetUserId: userId,
      payload: { removedRole: existing.role },
      resultStatus: "success",
      request,
    });

    return NextResponse.json({ userId, removed: true });
  } catch (err) {
    console.error("[Roles API] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
