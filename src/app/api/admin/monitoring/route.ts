import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, errorResponse } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

/** GET /api/admin/monitoring — List monitored chats */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "monitoring:manage");
  if (denied) return denied;

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("monitored_chats")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ chats: data ?? [], total: (data ?? []).length });
  } catch (err) {
    console.error("[admin/monitoring] list failed:", err);
    return errorResponse("Failed to list monitored chats", 500);
  }
}
