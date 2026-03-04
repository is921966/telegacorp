import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { ChatManagementService } from "@/lib/admin/services/chat-management";
import { parseBody, updateChatSettingsSchema } from "@/lib/admin/validation";

type Params = { params: Promise<{ chatId: string }> };

/** GET /api/admin/chats/:chatId — Chat details (GetFullChannel) */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  const { chatId } = await params;

  try {
    const details = await ChatManagementService.getChatDetails(chatId);
    return NextResponse.json(details);
  } catch (err) {
    console.error(`[admin/chats/${chatId}] getChatDetails failed:`, err);
    return errorResponse("Failed to get chat details", 500);
  }
}

/** PATCH /api/admin/chats/:chatId — Update chat settings */
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:write");
  if (denied) return denied;

  const { chatId } = await params;
  const parsed = await parseBody(request, updateChatSettingsSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { slowModeDelay, noForwards, defaultBannedRights } = parsed.data;

  try {
    if (slowModeDelay !== undefined) {
      await ChatManagementService.toggleSlowMode(chatId, slowModeDelay, ctx.userId);
    }
    if (noForwards !== undefined) {
      await ChatManagementService.toggleNoForwards(chatId, noForwards, ctx.userId);
    }
    if (defaultBannedRights) {
      await ChatManagementService.updateDefaultRights(
        chatId,
        defaultBannedRights,
        ctx.userId
      );
    }

    return NextResponse.json({ chatId, updated: true });
  } catch (err) {
    console.error(`[admin/chats/${chatId}] update failed:`, err);
    return errorResponse("Failed to update chat settings", 500);
  }
}
