import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

/**
 * POST /api/corporate/register-chat — add chat to workspace
 * DELETE /api/corporate/register-chat — remove chat from workspace
 *
 * Auth: cookie-based Supabase session (same as workspace-time).
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

  const telegramId = user.user_metadata?.telegram_id as string | undefined;
  return telegramId ?? null;
}

export async function POST(request: NextRequest) {
  const telegramId = await getAuthUser();
  if (!telegramId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const chatId = String(body.chatId || "").trim();

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    // Find the default active template
    const { data: template } = await supabase
      .from("policy_templates")
      .select("id")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (!template) {
      return NextResponse.json(
        { error: "No active policy template found" },
        { status: 500 }
      );
    }

    // Bind chat to the template
    const { error: insertError } = await supabase
      .from("chat_templates")
      .upsert(
        {
          chat_id: chatId,
          template_id: template.id,
          is_compliant: true,
          applied_at: new Date().toISOString(),
        },
        { onConflict: "chat_id" }
      );

    if (insertError) {
      console.error("[register-chat] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to register chat" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, templateId: template.id });
  } catch (err) {
    console.error("[register-chat] Failed:", err);
    return NextResponse.json(
      { error: "Failed to register chat" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const telegramId = await getAuthUser();
  if (!telegramId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const chatId = String(body.chatId || "").trim();

    if (!chatId) {
      return NextResponse.json(
        { error: "chatId is required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabase();

    const { error: deleteError } = await supabase
      .from("chat_templates")
      .delete()
      .eq("chat_id", chatId);

    if (deleteError) {
      console.error("[register-chat] Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to unregister chat" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[register-chat] Delete failed:", err);
    return NextResponse.json(
      { error: "Failed to unregister chat" },
      { status: 500 }
    );
  }
}
