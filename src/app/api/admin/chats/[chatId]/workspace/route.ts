import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, errorResponse } from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

/** PUT /api/admin/chats/:chatId/workspace — add chat to workspace */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:write");
  if (denied) return denied;

  const { chatId } = await params;
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
    return errorResponse("No active policy template found", 500);
  }

  const { error } = await supabase
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

  if (error) {
    console.error("[admin/workspace] PUT error:", error);
    return errorResponse("Failed to add to workspace", 500);
  }

  return NextResponse.json({ ok: true, templateId: template.id });
}

/** DELETE /api/admin/chats/:chatId/workspace — remove chat from workspace */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:write");
  if (denied) return denied;

  const { chatId } = await params;
  const supabase = createServerSupabase();

  const { error } = await supabase
    .from("chat_templates")
    .delete()
    .eq("chat_id", chatId);

  if (error) {
    console.error("[admin/workspace] DELETE error:", error);
    return errorResponse("Failed to remove from workspace", 500);
  }

  return NextResponse.json({ ok: true });
}
