import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, errorResponse } from "@/lib/admin/api-helpers";
import { ChatManagementService } from "@/lib/admin/services/chat-management";

/** GET /api/admin/chats — List managed chats */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  try {
    const chats = await ChatManagementService.listManagedChats();
    return NextResponse.json({ chats, total: chats.length });
  } catch (err) {
    console.error("[admin/chats] listManagedChats failed:", err);
    return errorResponse("Failed to list chats", 500);
  }
}
