import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission } from "@/lib/admin/api-helpers";

type Params = { params: Promise<{ userId: string }> };

/** PATCH /api/admin/roles/:userId — Update user role */
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  const { userId } = await params;

  // TODO: Validate + UPDATE admin_roles
  return NextResponse.json({ userId, updated: true });
}

/** DELETE /api/admin/roles/:userId — Remove admin role */
export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  const { userId } = await params;

  // TODO: DELETE FROM admin_roles WHERE user_id = userId
  return NextResponse.json({ userId, removed: true });
}
