import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, errorResponse } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

/** GET /api/admin/employees — List employees from telegram_users */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const filter = url.searchParams.get("filter") || "all"; // all | admins | with_company
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const offset = Number(url.searchParams.get("offset")) || 0;

  try {
    const supabase = createServerSupabase();

    // No FK between tables — fetch separately, then merge in JS

    // 1. Fetch admin_roles and work_companies maps
    const [rolesRes, companiesRes] = await Promise.all([
      supabase.from("admin_roles").select("telegram_id, role"),
      supabase.from("work_companies").select("telegram_id, companies"),
    ]);

    const roleMap = new Map<string, string>();
    for (const r of rolesRes.data ?? []) {
      roleMap.set(r.telegram_id, r.role);
    }

    const companyMap = new Map<string, unknown[]>();
    for (const c of companiesRes.data ?? []) {
      companyMap.set(c.telegram_id, c.companies as unknown[]);
    }

    // 2. Build telegram_users query
    let query = supabase
      .from("telegram_users")
      .select("*", { count: "exact" });

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,username.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    // For "admins" filter, restrict to telegram_ids that have a role
    if (filter === "admins") {
      const adminIds = [...roleMap.keys()];
      if (adminIds.length === 0) {
        return NextResponse.json({ employees: [], total: 0 });
      }
      query = query.in("telegram_id", adminIds);
    }

    // For "with_company" filter, restrict to telegram_ids that have companies
    if (filter === "with_company") {
      const companyIds = [...companyMap.keys()];
      if (companyIds.length === 0) {
        return NextResponse.json({ employees: [], total: 0 });
      }
      query = query.in("telegram_id", companyIds);
    }

    query = query
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error("[admin/employees] query error:", error);
      return errorResponse("Failed to query employees", 500);
    }

    // 3. Merge
    interface TelegramUserRow {
      telegram_id: string;
      first_name: string;
      last_name: string | null;
      username: string | null;
      phone: string | null;
      photo_url: string | null;
      last_seen_at: string | null;
      created_at: string;
    }

    const employees = ((data ?? []) as TelegramUserRow[]).map((row) => ({
      telegram_id: row.telegram_id,
      first_name: row.first_name,
      last_name: row.last_name,
      username: row.username,
      phone: row.phone,
      photo_url: row.photo_url,
      last_seen_at: row.last_seen_at,
      created_at: row.created_at,
      role: roleMap.get(row.telegram_id) ?? null,
      companies: companyMap.get(row.telegram_id) ?? [],
    }));

    return NextResponse.json({ employees, total: count ?? 0 });
  } catch (err) {
    console.error("[admin/employees] unexpected error:", err);
    return errorResponse("Internal error", 500);
  }
}
