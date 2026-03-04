import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { ChatManagementService } from "@/lib/admin/services/chat-management";
import { parseBody, banUserSchema } from "@/lib/admin/validation";

type Params = { params: Promise<{ chatId: string }> };

/** POST /api/admin/chats/:chatId/ban — Ban user */
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "members:manage");
  if (denied) return denied;

  const { chatId } = await params;
  const parsed = await parseBody(request, banUserSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    await ChatManagementService.banUser(
      chatId,
      parsed.data.userId,
      parsed.data.untilDate,
      ctx.userId
    );
    return NextResponse.json({ chatId, banned: true });
  } catch (err) {
    console.error(`[admin/chats/${chatId}/ban] failed:`, err);
    return errorResponse("Failed to ban user", 500);
  }
}

/** DELETE /api/admin/chats/:chatId/ban — Unban user */
export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "members:manage");
  if (denied) return denied;

  const { chatId } = await params;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) {
    return errorResponse("userId query param required", 400);
  }

  try {
    await ChatManagementService.unbanUser(chatId, userId, ctx.userId);
    return NextResponse.json({ chatId, unbanned: true });
  } catch (err) {
    console.error(`[admin/chats/${chatId}/ban] unban failed:`, err);
    return errorResponse("Failed to unban user", 500);
  }
}
