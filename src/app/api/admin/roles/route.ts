import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission } from "@/lib/admin/api-helpers";

/** GET /api/admin/roles — List admin users and their roles */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  // TODO: Phase 1 (later) — query admin_roles + join auth.users
  return NextResponse.json({ admins: [] });
}

/** POST /api/admin/roles — Assign role to user */
export async function POST(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const denied = requirePermission(ctx, "*");
  if (denied) return denied;

  // TODO: Validate with assignRoleSchema, INSERT into admin_roles
  return NextResponse.json({ assigned: true }, { status: 201 });
}
