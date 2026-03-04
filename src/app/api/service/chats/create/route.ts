import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/admin/validation";

const createChatSchema = z.object({
  title: z.string().min(1).max(255),
  about: z.string().max(2000).optional(),
  userIds: z.array(z.string()).optional(),
});

/**
 * POST /api/service/chats/create
 * Service API: Create a new supergroup (for agent workspaces).
 * Requires user session — currently a placeholder.
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

  // Creating a supergroup requires a user session (CreateChannel)
  // This will be implemented when the user client bridge is set up on VPS
  return NextResponse.json(
    {
      error: "Not implemented",
      message:
        "Chat creation requires user session. Use VPS message stream service.",
    },
    { status: 501 }
  );
}

function validateServiceToken(request: NextRequest): boolean {
  const token = process.env.SERVICE_API_TOKEN;
  if (!token) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${token}`;
}
