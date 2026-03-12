import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddleware } from "@/lib/supabase/middleware";
import type { AdminRole } from "@/types/admin";

/**
 * Next.js middleware — RBAC for /admin/* and /api/admin/* routes.
 *
 * Flow:
 * 1. Validate Supabase session
 * 2. Look up admin_roles for the user
 * 3. If valid → set x-admin-user-id + x-admin-role headers
 * 4. If invalid → 401 (API) or redirect to / (pages)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cron routes use their own CRON_SECRET auth — skip Supabase session check
  if (pathname.startsWith("/api/admin/cron")) {
    return NextResponse.next();
  }

  const isApiRoute = pathname.startsWith("/api/admin");

  // Create response to be modified
  const response = NextResponse.next();

  // Validate Supabase session
  const supabase = createSupabaseMiddleware(request, response);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    // Redirect page requests to home
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Resolve telegram_id from user_metadata (saved during Telegram auth)
  const telegramId = user.user_metadata?.telegram_id as string | undefined;
  if (!telegramId) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Forbidden: no Telegram ID linked" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Check admin role by telegram_id
  const { data: roleData } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("telegram_id", telegramId)
    .single();

  if (!roleData) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Forbidden: no admin role assigned" },
        { status: 403 }
      );
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  const role = roleData.role as AdminRole;

  // Set admin context headers for downstream API Routes
  response.headers.set("x-admin-telegram-id", telegramId);
  response.headers.set("x-admin-role", role);

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
