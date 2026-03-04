import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { ChatManagementService } from "@/lib/admin/services/chat-management";

type Params = { params: Promise<{ chatId: string }> };

/** GET /api/admin/chats/:chatId/participants — List participants */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  const { chatId } = await params;
  const url = new URL(request.url);
  const filter = (url.searchParams.get("filter") ?? "all") as
    | "all"
    | "admins"
    | "banned"
    | "kicked";
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    200
  );

  try {
    const result = await ChatManagementService.getParticipants(
      chatId,
      filter,
      offset,
      limit
    );
    return NextResponse.json({ chatId, ...result });
  } catch (err) {
    console.error(`[admin/chats/${chatId}/participants] failed:`, err);
    return errorResponse("Failed to get participants", 500);
  }
}
