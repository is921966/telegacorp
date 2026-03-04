import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * GET /api/service/chats/monitored
 * Service API: List chats with monitoring enabled.
 * Used by the VPS Message Stream Service to know which chats to observe.
 */
export async function GET(request: NextRequest) {
  if (!validateServiceToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("monitored_chats")
      .select("chat_id, title, excluded_topics, assigned_agents")
      .eq("monitoring_enabled", true);

    if (error) throw new Error(error.message);

    return NextResponse.json({ chats: data ?? [] });
  } catch (err) {
    console.error("[service/chats/monitored] failed:", err);
    return NextResponse.json(
      { error: "Failed to get monitored chats", message: String(err) },
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
