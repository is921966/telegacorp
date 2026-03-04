import { NextResponse, type NextRequest } from "next/server";
import { botApiCall } from "@/lib/admin/gramjs-client";
import { parseBody, sendMessageSchema } from "@/lib/admin/validation";

/**
 * POST /api/service/messages/send
 * Service API: Agent sends a message to a chat via the bot client.
 * Protected by SERVICE_API_TOKEN.
 */
export async function POST(request: NextRequest) {
  if (!validateServiceToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = await parseBody(request, sendMessageSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await botApiCall(
      "messages.SendMessage",
      async (client) => {
        return client.sendMessage(String(parsed.data.chatId), {
          message: parsed.data.text,
          replyTo: parsed.data.replyToMsgId,
        });
      },
      1000
    );

    return NextResponse.json({
      ok: true,
      messageId: result?.id ?? null,
    });
  } catch (err) {
    console.error("[service/messages/send] failed:", err);
    return NextResponse.json(
      { error: "Failed to send message", message: String(err) },
      { status: 500 }
    );
  }
}

function validateServiceToken(request: NextRequest): boolean {
  const token = process.env.SERVICE_API_TOKEN;
  if (!token) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${token}`;
}
