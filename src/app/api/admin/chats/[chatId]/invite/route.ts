import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { ChatManagementService } from "@/lib/admin/services/chat-management";
import { parseBody, createInviteLinkSchema } from "@/lib/admin/validation";

type Params = { params: Promise<{ chatId: string }> };

/** GET /api/admin/chats/:chatId/invite — List invite links */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  const { chatId } = await params;

  try {
    const links = await ChatManagementService.getInviteLinks(chatId);
    return NextResponse.json({ chatId, links });
  } catch (err) {
    console.error(`[admin/chats/${chatId}/invite] list failed:`, err);
    return errorResponse("Failed to get invite links", 500);
  }
}

/** POST /api/admin/chats/:chatId/invite — Create invite link */
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:write");
  if (denied) return denied;

  const { chatId } = await params;
  const parsed = await parseBody(request, createInviteLinkSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const link = await ChatManagementService.createInviteLink(
      chatId,
      parsed.data,
      ctx.telegramId
    );
    return NextResponse.json({ chatId, link }, { status: 201 });
  } catch (err) {
    console.error(`[admin/chats/${chatId}/invite] create failed:`, err);
    return errorResponse("Failed to create invite link", 500);
  }
}

/** DELETE /api/admin/chats/:chatId/invite — Revoke invite link */
export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:write");
  if (denied) return denied;

  const { chatId } = await params;
  const url = new URL(request.url);
  const link = url.searchParams.get("link");
  if (!link) {
    return errorResponse("link query param required", 400);
  }

  try {
    await ChatManagementService.revokeInviteLink(chatId, link, ctx.telegramId);
    return NextResponse.json({ chatId, revoked: true });
  } catch (err) {
    console.error(`[admin/chats/${chatId}/invite] revoke failed:`, err);
    return errorResponse("Failed to revoke invite link", 500);
  }
}
