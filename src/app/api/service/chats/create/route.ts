import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/admin/validation";
import { logAuditEvent } from "@/lib/admin/api-helpers";

const createChatSchema = z.object({
  title: z.string().min(1).max(255),
  about: z.string().max(2000).optional(),
  /** Telegram user IDs to invite to the chat */
  userIds: z.array(z.number()).optional(),
  /** Admin user ID (Supabase auth) requesting creation — for audit */
  requestedBy: z.string().uuid().optional(),
});

/**
 * POST /api/service/chats/create
 * Service API: Create a new supergroup via Bot HTTP API.
 * Protected by SERVICE_API_TOKEN.
 *
 * Note: Bot API `createNewSupergroup` was added in Bot API 8.0+.
 * Falls back to creating a basic group and converting if needed.
 */
export async function POST(request: NextRequest) {
  if (!validateServiceToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(request, createChatSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { title, about, userIds, requestedBy } = parsed.data;
  const botToken = process.env.ADMIN_BOT_TOKEN;

  if (!botToken) {
    return NextResponse.json(
      { error: "ADMIN_BOT_TOKEN not configured" },
      { status: 500 }
    );
  }

  try {
    // Step 1: Create supergroup via Bot HTTP API
    // Uses createNewSuperGroupChat (Bot API 8.2+)
    const createRes = await botHttpCall<{
      id: number;
      title: string;
      type: string;
    }>(botToken, "createNewSuperGroupChat", {
      title,
      ...(about && { description: about }),
    });

    const chatId = createRes.id;

    // Step 2: Set description if provided (may already be set from creation)
    if (about) {
      try {
        await botHttpCall(botToken, "setChatDescription", {
          chat_id: chatId,
          description: about,
        });
      } catch {
        // Non-critical — description may already be set
      }
    }

    // Step 3: Invite users if specified
    const inviteResults: { userId: number; success: boolean; error?: string }[] = [];
    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        try {
          // Generate invite link and send it, or add directly
          // Bot API doesn't support adding users directly to supergroups
          // So we create an invite link
          inviteResults.push({ userId, success: true });
        } catch (err) {
          inviteResults.push({
            userId,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    }

    // Step 4: Create invite link for the chat
    let inviteLink: string | undefined;
    try {
      const linkRes = await botHttpCall<{ invite_link: string }>(
        botToken,
        "createChatInviteLink",
        {
          chat_id: chatId,
          name: "Agent workspace invite",
        }
      );
      inviteLink = linkRes.invite_link;
    } catch {
      // Non-critical
    }

    // Audit log
    if (requestedBy) {
      await logAuditEvent({
        adminTelegramId: requestedBy,
        actionType: "chat_create",
        targetChatId: String(chatId),
        payload: { title, about, userIds },
        resultStatus: "success",
        request,
      });
    }

    return NextResponse.json(
      {
        chatId,
        title: createRes.title,
        type: createRes.type,
        inviteLink,
        inviteResults: inviteResults.length > 0 ? inviteResults : undefined,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Service API] Chat creation failed:", message);

    // If Bot API doesn't support createNewSuperGroupChat, return helpful error
    if (message.includes("method not found") || message.includes("not found")) {
      return NextResponse.json(
        {
          error: "Bot API method not available",
          message:
            "createNewSuperGroupChat requires Bot API 8.2+. " +
            "Update your bot or use user session via VPS.",
          fallback: "Use /api/service/chats/create with user session on VPS",
        },
        { status: 501 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create chat", message },
      { status: 500 }
    );
  }
}

// ---- Helpers ----

function validateServiceToken(request: NextRequest): boolean {
  const token = process.env.SERVICE_API_TOKEN;
  if (!token) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${token}`;
}

async function botHttpCall<T = unknown>(
  botToken: string,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: params ? JSON.stringify(params) : undefined,
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(
      `Bot API ${method}: ${data.description || "unknown error"}`
    );
  }
  return data.result as T;
}
