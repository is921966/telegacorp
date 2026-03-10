import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { ChatManagementService } from "@/lib/admin/services/chat-management";
import { parseBody, editAdminSchema } from "@/lib/admin/validation";

type Params = { params: Promise<{ chatId: string }> };

/** GET /api/admin/chats/:chatId/admins — List chat admins */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  const { chatId } = await params;

  try {
    const result = await ChatManagementService.getParticipants(chatId, "admins");
    return NextResponse.json({ chatId, admins: result.participants });
  } catch (err) {
    console.error(`[admin/chats/${chatId}/admins] failed:`, err);
    return errorResponse("Failed to get admins", 500);
  }
}

/** POST /api/admin/chats/:chatId/admins — Promote/edit admin */
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "members:manage");
  if (denied) return denied;

  const { chatId } = await params;
  const parsed = await parseBody(request, editAdminSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    await ChatManagementService.editAdmin(
      chatId,
      parsed.data.userId,
      parsed.data.rights ?? {},
      parsed.data.rank,
      ctx.telegramId
    );
    return NextResponse.json({ chatId, updated: true });
  } catch (err) {
    console.error(`[admin/chats/${chatId}/admins] editAdmin failed:`, err);
    return errorResponse("Failed to edit admin", 500);
  }
}
