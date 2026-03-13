import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
  logAuditEvent,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";

type Params = { params: Promise<{ chatId: string }> };

/** PATCH /api/admin/chats/:chatId/archive-state — Toggle archiving */
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:write");
  if (denied) return denied;

  const { chatId } = await params;
  const body = await request.json();
  const isEnabled = Boolean(body.is_enabled);
  const chatIdNum = parseInt(chatId, 10);

  const supabase = createServerSupabase();

  const { data, error } = await supabase
    .from("chat_archive_state")
    .upsert(
      {
        chat_id: chatIdNum,
        is_enabled: isEnabled,
      },
      { onConflict: "chat_id" }
    )
    .select()
    .single();

  if (error) {
    console.error(`[admin/chats/${chatId}/archive-state] update failed:`, error);
    return errorResponse("Failed to update archive state", 500);
  }

  await logAuditEvent({
    adminTelegramId: ctx.telegramId,
    actionType: isEnabled ? "enable_archiving" : "disable_archiving",
    targetChatId: chatId,
    resultStatus: "success",
  });

  return NextResponse.json(data);
}
