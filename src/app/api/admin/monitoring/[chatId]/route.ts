import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
  logAuditEvent,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseBody, updateMonitoringSchema } from "@/lib/admin/validation";
import type { Database } from "@/types/database";

type Params = { params: Promise<{ chatId: string }> };

/** GET /api/admin/monitoring/:chatId — Monitoring settings for a chat */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "monitoring:manage");
  if (denied) return denied;

  const { chatId } = await params;

  try {
    const supabase = createServerSupabase();
    const { data } = await supabase
      .from("monitored_chats")
      .select("*")
      .eq("chat_id", parseInt(chatId, 10))
      .single();

    if (!data) {
      return NextResponse.json({
        chat_id: parseInt(chatId, 10),
        monitoring_enabled: false,
        consent_obtained_at: null,
        assigned_agents: [],
        excluded_topics: [],
      });
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error(`[admin/monitoring/${chatId}] get failed:`, err);
    return errorResponse("Failed to get monitoring config", 500);
  }
}

/** PATCH /api/admin/monitoring/:chatId — Update monitoring config */
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "monitoring:manage");
  if (denied) return denied;

  const { chatId } = await params;
  const parsed = await parseBody(request, updateMonitoringSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabase();
    const chatIdNum = parseInt(chatId, 10);

    const upsertData: Database["public"]["Tables"]["monitored_chats"]["Insert"] = {
      chat_id: chatIdNum,
      monitoring_enabled: parsed.data.monitoring_enabled,
    };

    if (parsed.data.consent_obtained_at) {
      upsertData.consent_obtained_at = parsed.data.consent_obtained_at;
    }
    if (parsed.data.excluded_topics) {
      upsertData.excluded_topics = parsed.data.excluded_topics;
    }

    const { data, error } = await supabase
      .from("monitored_chats")
      .upsert(upsertData, { onConflict: "chat_id" })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logAuditEvent({
      adminTelegramId: ctx.telegramId,
      actionType: parsed.data.monitoring_enabled
        ? "enable_monitoring"
        : "disable_monitoring",
      targetChatId: chatId,
      resultStatus: "success",
    });

    return NextResponse.json(data);
  } catch (err) {
    console.error(`[admin/monitoring/${chatId}] update failed:`, err);
    return errorResponse("Failed to update monitoring", 500);
  }
}
