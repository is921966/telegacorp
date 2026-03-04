import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type MessageRow = Database["public"]["Tables"]["message_archive"]["Row"];
type Params = { params: Promise<{ chatId: string }> };

/**
 * GET /api/service/chats/:chatId/history
 * Service API: Retrieve message history from the archive.
 * Protected by SERVICE_API_TOKEN.
 */
export async function GET(request: NextRequest, { params }: Params) {
  if (!validateServiceToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chatId } = await params;
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 200);
  const before = url.searchParams.get("before"); // ISO datetime

  try {
    const supabase = createServerSupabase();
    let query = supabase
      .from("message_archive")
      .select("*")
      .eq("chat_id", parseInt(chatId, 10))
      .order("date", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("date", before);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      messages: (data ?? []) as unknown as MessageRow[],
      total: (data ?? []).length,
    });
  } catch (err) {
    console.error(`[service/chats/${chatId}/history] failed:`, err);
    return NextResponse.json(
      { error: "Failed to get history", message: String(err) },
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
