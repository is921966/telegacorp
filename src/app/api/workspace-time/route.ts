import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * POST /api/workspace-time — Sync workspace time from client
 * GET  /api/workspace-time — Get saved workspace time (for restore on new device)
 *
 * Auth: cookie-based Supabase session (same as /api/corporate/config)
 */

async function getAuthUser() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) return null;

  const supabaseAuth = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();

  if (error || !user) return null;

  // Get telegram_id from user metadata
  const telegramId = user.user_metadata?.telegram_id as string | undefined;
  return telegramId ?? null;
}

export async function GET() {
  const telegramId = await getAuthUser();
  if (!telegramId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("workspace_time")
      .select("personal_seconds, work_seconds")
      .eq("telegram_id", telegramId)
      .single();

    return NextResponse.json({
      personalSeconds: data?.personal_seconds ?? 0,
      workSeconds: data?.work_seconds ?? 0,
    });
  } catch (err) {
    console.error("[workspace-time] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const telegramId = await getAuthUser();
  if (!telegramId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const personalSeconds = Math.max(0, Math.floor(Number(body.personalSeconds) || 0));
    const workSeconds = Math.max(0, Math.floor(Number(body.workSeconds) || 0));

    const supabase = createServerSupabase();
    const { error } = await supabase.from("workspace_time").upsert(
      {
        telegram_id: telegramId,
        personal_seconds: personalSeconds,
        work_seconds: workSeconds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "telegram_id" }
    );

    if (error) {
      console.error("[workspace-time] upsert error:", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[workspace-time] POST error:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
