import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type PolicyTemplateRow = Database["public"]["Tables"]["policy_templates"]["Row"];
type ChatTemplateRow = Database["public"]["Tables"]["chat_templates"]["Row"];

/**
 * GET /api/admin/config — Corporate configuration for the current user.
 * Returns managed chat IDs, policies per chat, and active templates.
 * Used by the client-side corporate store for workspace switching.
 */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

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

    const archiveChatIds = ((archiveStates ?? []) as unknown as { chat_id: number }[])
      .map((s) => String(s.chat_id));

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
    console.error("[admin/config] failed:", err);
    return errorResponse("Failed to get corporate config", 500);
  }
}
