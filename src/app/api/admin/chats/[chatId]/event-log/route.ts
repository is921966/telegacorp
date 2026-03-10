import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { ChatManagementService } from "@/lib/admin/services/chat-management";

type Params = { params: Promise<{ chatId: string }> };

/** GET /api/admin/chats/:chatId/event-log — Chat admin log (via user session) */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "audit:read");
  if (denied) return denied;

  const { chatId } = await params;
  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "100", 10),
    500
  );

  try {
    const events = await ChatManagementService.getChatEventLog(
      ctx.telegramId,
      chatId,
      limit
    );
    return NextResponse.json({ chatId, events, total: events.length });
  } catch (err) {
    console.error(`[admin/chats/${chatId}/event-log] failed:`, err);
    return errorResponse("Failed to get event log", 500);
  }
}
