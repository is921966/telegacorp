import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PolicyTemplateRow = Database["public"]["Tables"]["policy_templates"]["Row"];
type ChatTemplateRow = Database["public"]["Tables"]["chat_templates"]["Row"];

/**
 * GET /api/corporate/config
 *
 * Returns corporate configuration for the authenticated user.
 * Unlike /api/admin/config, this endpoint is NOT behind RBAC middleware —
 * any authenticated Supabase user can access it.
 *
 * Returns: { managedChatIds, policies, archiveChatIds, templates }
 */
export async function GET() {
  // 1. Authenticate user via cookie-based session
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const supabaseAuth = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Query corporate config using service_role (bypass RLS)
  try {
    const supabase = createServerSupabase();

    // Get all chat→template bindings
    const { data: bindings } = await supabase
      .from("chat_templates")
      .select("*");

    const chatBindings = (bindings ?? []) as unknown as ChatTemplateRow[];

    // Get all active templates
    const { data: templates } = await supabase
      .from("policy_templates")
      .select("*")
      .eq("is_active", true);

    const activeTemplates = (templates ?? []) as unknown as PolicyTemplateRow[];

    // Build managed chat IDs (all chats bound to templates)
    const managedChatIds = chatBindings.map((b) => b.chat_id);

    // Build policies map: chatId → PolicyConfig from bound template
    const policies: Record<string, unknown> = {};
    for (const binding of chatBindings) {
      if (!binding.template_id) continue;
      const template = activeTemplates.find((t) => t.id === binding.template_id);
      if (template) {
        policies[binding.chat_id] = template.config;
      }
    }

    // Get archive-enabled chats
    const { data: archiveStates } = await supabase
      .from("chat_archive_state")
      .select("chat_id")
      .eq("is_enabled", true);

    const archiveChatIds = (
      (archiveStates ?? []) as unknown as { chat_id: number }[]
    ).map((s) => String(s.chat_id));

    return NextResponse.json({
      managedChatIds,
      policies,
      archiveChatIds,
      templates: activeTemplates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
      })),
    });
  } catch (err) {
    console.error("[corporate/config] failed:", err);
    return NextResponse.json(
      { error: "Failed to get corporate config" },
      { status: 500 }
    );
  }
}
