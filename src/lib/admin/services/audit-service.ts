import { createServerSupabase } from "@/lib/supabase/server";
import { ChatManagementService } from "./chat-management";
import { TemplateService } from "./template-service";
import { withBotClient, botApiCall } from "@/lib/admin/gramjs-client";
import type { AuditLogEntry, ChatEventEntry } from "@/types/admin";
import type { Database } from "@/types/database";

type AuditRow = Database["public"]["Tables"]["admin_audit_log"]["Row"];
type EventRow = Database["public"]["Tables"]["chat_event_log"]["Row"];
type ArchiveStateRow = Database["public"]["Tables"]["chat_archive_state"]["Row"];

// ---- Interfaces ----

interface AuditSearchFilters {
  adminTelegramId?: string;
  actionType?: string;
  chatId?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

// ---- Service ----

export class AuditService {
  /**
   * Search the admin audit log with filters.
   */
  static async searchAuditLog(
    filters: AuditSearchFilters
  ): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const supabase = createServerSupabase();

    let query = supabase
      .from("admin_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (filters.adminTelegramId) {
      query = query.eq("admin_telegram_id", filters.adminTelegramId);
    }
    if (filters.actionType) {
      query = query.eq("action_type", filters.actionType);
    }
    if (filters.chatId) {
      query = query.eq("target_chat_id", filters.chatId);
    }
    if (filters.from) {
      query = query.gte("created_at", filters.from);
    }
    if (filters.to) {
      query = query.lte("created_at", filters.to);
    }

    query = query.range(filters.offset, filters.offset + filters.limit - 1);

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to search audit log: ${error.message}`);

    const rows = (data ?? []) as unknown as AuditRow[];

    return {
      entries: rows.map(mapAuditEntry),
      total: count ?? 0,
    };
  }

  /**
   * Export audit log entries as CSV string.
   */
  static async exportAuditLog(
    filters: Omit<AuditSearchFilters, "limit" | "offset">
  ): Promise<string> {
    const supabase = createServerSupabase();

    let query = supabase
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10000); // Safety cap

    if (filters.adminTelegramId) {
      query = query.eq("admin_telegram_id", filters.adminTelegramId);
    }
    if (filters.actionType) {
      query = query.eq("action_type", filters.actionType);
    }
    if (filters.chatId) {
      query = query.eq("target_chat_id", filters.chatId);
    }
    if (filters.from) {
      query = query.gte("created_at", filters.from);
    }
    if (filters.to) {
      query = query.lte("created_at", filters.to);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to export audit log: ${error.message}`);

    const rows = (data ?? []) as unknown as AuditRow[];
    return toCsv(rows);
  }

  /**
   * Collect Telegram admin event logs for specified chat IDs.
   * Telegram only keeps these for 48 hours — this should run hourly.
   * Uses user session (GetAdminLog requires user, not bot).
   */
  static async collectChatEventLogs(
    userId: string,
    chatIds: string[]
  ): Promise<{ collected: number; errors: string[] }> {
    const supabase = createServerSupabase();
    let collected = 0;
    const errors: string[] = [];

    for (const chatId of chatIds) {
      try {
        const events = await ChatManagementService.getChatEventLog(
          userId,
          chatId,
          100
        );

        if (events.length === 0) continue;

        // Upsert events (event_id is unique)
        const rows = events.map((evt) => ({
          chat_id: chatId,
          event_id: String(evt.id ?? `${chatId}_${evt.date}`),
          date: evt.date,
          user_id: evt.user_id ?? null,
          action: evt.action ?? null,
          payload: evt.payload ?? (evt as unknown as Record<string, unknown>),
        }));

        const { error } = await supabase
          .from("chat_event_log")
          .upsert(rows, { onConflict: "event_id" });

        if (error) {
          errors.push(`Chat ${chatId}: ${error.message}`);
        } else {
          collected += rows.length;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Chat ${chatId}: ${msg}`);
      }

      // Rate limit between chats
      await new Promise((r) => setTimeout(r, 2000));
    }

    return { collected, errors };
  }

  /**
   * Collect messages from managed chats for archive.
   * Uses bot client + GramJS GetHistory.
   * Runs as a cron job (every 15 minutes).
   */
  static async collectMessages(): Promise<{
    chatsProcessed: number;
    messagesCollected: number;
    errors: string[];
  }> {
    const supabase = createServerSupabase();

    // Get all enabled chats
    const { data: states, error: statesError } = await supabase
      .from("chat_archive_state")
      .select("*")
      .eq("is_enabled", true);

    if (statesError) throw new Error(`Failed to get archive states: ${statesError.message}`);
    if (!states || states.length === 0) {
      return { chatsProcessed: 0, messagesCollected: 0, errors: [] };
    }

    const archiveStates = states as unknown as ArchiveStateRow[];
    let totalMessages = 0;
    const errors: string[] = [];
    let chatsProcessed = 0;

    for (const state of archiveStates) {
      try {
        const messages = await botApiCall(
          "messages.GetHistory",
          async (client) => {
            const { Api } = await import("telegram");
            const result = await client.invoke(
              new Api.messages.GetHistory({
                peer: state.chat_id,
                offsetId: 0,
                offsetDate: 0,
                addOffset: 0,
                limit: 100,
                maxId: 0,
                minId: state.last_collected_msg_id,
                hash: 0 as any,
              })
            );

            if ("messages" in result) {
              return result.messages;
            }
            return [];
          },
          1500
        );

        if (messages.length === 0) {
          chatsProcessed++;
          continue;
        }

        // Normalize and insert messages
        // GramJS returns TypeMessage[] — cast to any for property access
        const rows = (messages as any[])
          .filter((m) => "id" in m && "date" in m)
          .map((m) => ({
            chat_id: state.chat_id,
            message_id: m.id as number,
            sender_id: m.fromId
              ? extractSenderId(m)
              : null,
            sender_name: null,
            text: typeof m.message === "string" ? m.message : null,
            date: new Date((m.date as number) * 1000).toISOString(),
            media_type: m.media ? getMediaType(m) : null,
            media_file_path: null,
            media_file_name: null,
            media_file_size: null,
            reply_to_msg_id: m.replyTo ? extractReplyToId(m) : null,
            forward_from: m.fwdFrom ? "forwarded" : null,
            is_edited: !!m.editDate,
            raw_data: m as Record<string, unknown>,
          }));

        if (rows.length > 0) {
          const { error: insertError } = await supabase
            .from("message_archive")
            .upsert(rows, { onConflict: "chat_id,message_id" });

          if (insertError) {
            errors.push(`Chat ${state.chat_id}: ${insertError.message}`);
          } else {
            totalMessages += rows.length;

            // Update state
            const maxMsgId = Math.max(...rows.map((r) => r.message_id));
            await supabase
              .from("chat_archive_state")
              .update({
                last_collected_msg_id: maxMsgId,
                last_collected_at: new Date().toISOString(),
                total_messages: state.total_messages + rows.length,
              })
              .eq("chat_id", state.chat_id);
          }
        }

        chatsProcessed++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Chat ${state.chat_id}: ${msg}`);
      }

      // Rate limit between chats
      await new Promise((r) => setTimeout(r, 2000));
    }

    return { chatsProcessed, messagesCollected: totalMessages, errors };
  }

  /**
   * Run drift check for all templates.
   * Cron job every 6 hours.
   */
  static async checkAllDrift(): Promise<{
    templatesChecked: number;
    totalChats: number;
    driftsFound: number;
    errors: string[];
  }> {
    const supabase = createServerSupabase();
    const { data: templates } = await supabase
      .from("policy_templates")
      .select("id")
      .eq("is_active", true);

    if (!templates || templates.length === 0) {
      return { templatesChecked: 0, totalChats: 0, driftsFound: 0, errors: [] };
    }

    let totalChats = 0;
    let driftsFound = 0;
    const errors: string[] = [];

    for (const t of templates) {
      try {
        const templateId = (t as unknown as { id: string }).id;
        const results = await TemplateService.checkDrift(templateId);
        totalChats += results.length;
        driftsFound += results.filter((r) => !r.isCompliant).length;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(msg);
      }
    }

    return {
      templatesChecked: templates.length,
      totalChats,
      driftsFound,
      errors,
    };
  }
}

// ---- Helpers ----

function mapAuditEntry(row: AuditRow): AuditLogEntry {
  return {
    id: row.id,
    admin_telegram_id: row.admin_telegram_id ?? "",
    action_type: row.action_type,
    target_chat_id: row.target_chat_id,
    target_user_id: row.target_user_id,
    payload: row.payload,
    result_status: (row.result_status ?? "success") as AuditLogEntry["result_status"],
    error_message: row.error_message,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at,
  };
}

function toCsv(rows: AuditRow[]): string {
  const headers = [
    "id",
    "admin_telegram_id",
    "action_type",
    "target_chat_id",
    "target_user_id",
    "result_status",
    "error_message",
    "ip_address",
    "created_at",
  ];
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.id,
        escapeCsv(row.admin_telegram_id),
        escapeCsv(row.action_type),
        escapeCsv(row.target_chat_id),
        escapeCsv(row.target_user_id),
        escapeCsv(row.result_status),
        escapeCsv(row.error_message),
        escapeCsv(row.ip_address),
        escapeCsv(row.created_at),
      ].join(",")
    );
  }

  return lines.join("\n");
}

function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function extractSenderId(m: Record<string, unknown>): number | null {
  try {
    const fromId = m.fromId as Record<string, unknown> | null;
    if (fromId && "userId" in fromId) return Number(fromId.userId);
    if (fromId && "channelId" in fromId) return Number(fromId.channelId);
    return null;
  } catch {
    return null;
  }
}

function extractReplyToId(m: Record<string, unknown>): number | null {
  try {
    const replyTo = m.replyTo as Record<string, unknown> | null;
    if (replyTo && "replyToMsgId" in replyTo) return Number(replyTo.replyToMsgId);
    return null;
  } catch {
    return null;
  }
}

function getMediaType(m: Record<string, unknown>): string {
  try {
    const media = m.media as Record<string, unknown> | null;
    if (!media) return "unknown";
    const className = media.constructor?.name ?? media.className ?? "unknown";
    return String(className)
      .replace("MessageMedia", "")
      .toLowerCase();
  } catch {
    return "unknown";
  }
}
