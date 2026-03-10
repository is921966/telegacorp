import { Api } from "telegram";
import type { TelegramClient } from "telegram";
import { botApiCall, userApiCall } from "@/lib/admin/gramjs-client";
import { createServerSupabase } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/admin/api-helpers";
import type {
  ManagedChatInfo,
  ChatParticipantInfo,
  InviteLinkInfo,
  ChatBannedRights,
  ChatEventEntry,
} from "@/types/admin";

// ---- Bot HTTP API helper ----

/**
 * Call Telegram Bot HTTP API.
 * Used for methods that are unavailable via MTProto for bots (e.g. getUpdates, getChat).
 */
async function botHttpCall<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
  const botToken = process.env.ADMIN_BOT_TOKEN;
  if (!botToken) throw new Error("Missing ADMIN_BOT_TOKEN");

  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: params ? JSON.stringify(params) : undefined,
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Bot API ${method}: ${data.description || "unknown error"}`);
  }
  return data.result as T;
}

// ---- Helpers ----

/** Convert our ChatBannedRights to GramJS Api.ChatBannedRights */
function toBannedRights(rights: ChatBannedRights): Api.ChatBannedRights {
  return new Api.ChatBannedRights({
    untilDate: 0,
    sendMessages: !rights.can_send_messages,
    sendMedia: !rights.can_send_media,
    sendPolls: !rights.can_send_polls,
    sendStickers: !rights.can_send_other,
    sendGifs: !rights.can_send_other,
    sendGames: !rights.can_send_other,
    sendInline: !rights.can_send_other,
    embedLinks: !rights.can_add_web_page_previews,
    changeInfo: !rights.can_change_info,
    inviteUsers: !rights.can_invite_users,
    pinMessages: !rights.can_pin_messages,
  });
}

/** Convert GramJS ChatBannedRights to our ChatBannedRights */
function fromBannedRights(rights: Api.ChatBannedRights | undefined): ChatBannedRights {
  if (!rights) {
    return {
      can_send_messages: true,
      can_send_media: true,
      can_send_polls: true,
      can_send_other: true,
      can_add_web_page_previews: true,
      can_change_info: true,
      can_invite_users: true,
      can_pin_messages: true,
    };
  }
  return {
    can_send_messages: !rights.sendMessages,
    can_send_media: !rights.sendMedia,
    can_send_polls: !rights.sendPolls,
    can_send_other: !rights.sendStickers,
    can_add_web_page_previews: !rights.embedLinks,
    can_change_info: !rights.changeInfo,
    can_invite_users: !rights.inviteUsers,
    can_pin_messages: !rights.pinMessages,
  };
}

/** Determine chat type string from full channel info */
function getChatType(chat: Api.Channel): "supergroup" | "channel" {
  return chat.megagroup ? "supergroup" : "channel";
}

// ---- Service ----

export class ChatManagementService {
  /**
   * List managed (corporate) chats.
   * For now, returns all chats the bot is admin in.
   * In Phase 5, this will be filtered by corporate config.
   */
  static async listManagedChats(): Promise<ManagedChatInfo[]> {
    const supabase = createServerSupabase();

    // Get chat-template mappings to know compliance status
    const { data: templates } = await supabase
      .from("chat_templates")
      .select("chat_id, template_id, is_compliant");

    const templateMap = new Map(
      (templates ?? []).map((t) => [t.chat_id, t])
    );

    // Collect unique chat IDs from multiple sources:
    // 1. monitored_chats table (already registered)
    // 2. Bot API getUpdates (recently active chats)
    const chatIds = new Set<number>();

    // Source 1: Database — monitored chats
    const { data: monitored } = await supabase
      .from("monitored_chats")
      .select("chat_id");
    for (const m of monitored ?? []) {
      chatIds.add(Number(m.chat_id));
    }

    // Source 2: Bot API getUpdates — discover recent chats
    try {
      interface BotUpdate {
        message?: { chat: { id: number } };
        my_chat_member?: { chat: { id: number } };
        channel_post?: { chat: { id: number } };
      }
      const updates = await botHttpCall<BotUpdate[]>("getUpdates", {
        offset: -100,
        limit: 100,
        timeout: 0,
      });
      for (const u of updates) {
        if (u.message?.chat) chatIds.add(u.message.chat.id);
        if (u.my_chat_member?.chat) chatIds.add(u.my_chat_member.chat.id);
        if (u.channel_post?.chat) chatIds.add(u.channel_post.chat.id);
      }
    } catch {
      // getUpdates may fail if webhook is set — non-critical
      console.warn("[listManagedChats] getUpdates failed, using DB only");
    }

    // For each chat, call getChat to verify access and get fresh info
    interface BotChat {
      id: number;
      title?: string;
      type: string; // "group" | "supergroup" | "channel" | "private"
    }

    interface BotChatMember {
      status: string;
    }

    const chats: ManagedChatInfo[] = [];

    // Also try getChat for any chat IDs — if bot is in the chat, it works
    // If we have NO chat IDs yet, there's nothing to list
    if (chatIds.size === 0) {
      // Try getting bot info to verify token works
      await botHttpCall("getMe");
      return [];
    }

    const botMe = await botHttpCall<{ id: number }>("getMe");

    for (const chatId of chatIds) {
      // Skip private chats
      if (chatId > 0) continue;

      try {
        const chat = await botHttpCall<BotChat>("getChat", { chat_id: chatId });

        // Only include groups, supergroups, and channels
        if (!["group", "supergroup", "channel"].includes(chat.type)) continue;

        // Check if bot is admin in this chat
        const member = await botHttpCall<BotChatMember>("getChatMember", {
          chat_id: chatId,
          user_id: botMe.id,
        });

        if (!["administrator", "creator"].includes(member.status)) continue;

        const tpl = templateMap.get(chat.id.toString());

        chats.push({
          id: chat.id.toString(),
          title: chat.title || "",
          type: chat.type === "channel" ? "channel" : "supergroup",
          participantCount: 0, // Would need getChatMemberCount — extra call
          about: null,
          templateId: tpl?.template_id ?? null,
          isCompliant: tpl?.is_compliant ?? true,
        });
      } catch {
        // Bot not in chat or chat deleted — skip
        continue;
      }
    }

    return chats;
  }

  /**
   * Get detailed chat info using Bot HTTP API getChat.
   */
  static async getChatDetails(chatId: string): Promise<{
    chat: ManagedChatInfo;
    about: string | null;
    slowModeDelay: number;
    defaultBannedRights: ChatBannedRights;
    hasProtectedContent: boolean;
    hasHiddenMembers: boolean;
    hasAggressiveAntiSpam: boolean;
    linkedChatId: string | null;
    inviteLink: string | null;
  }> {
    const supabase = createServerSupabase();
    const { data: tpl } = await supabase
      .from("chat_templates")
      .select("template_id, is_compliant")
      .eq("chat_id", chatId)
      .single();

    interface BotChatFull {
      id: number;
      title?: string;
      type: string;
      description?: string;
      invite_link?: string;
      slow_mode_delay?: number;
      has_protected_content?: boolean;
      has_hidden_members?: boolean;
      has_aggressive_anti_spam_enabled?: boolean;
      linked_chat_id?: number;
      permissions?: {
        can_send_messages?: boolean;
        can_send_polls?: boolean;
        can_send_other_messages?: boolean;
        can_add_web_page_previews?: boolean;
        can_change_info?: boolean;
        can_invite_users?: boolean;
        can_pin_messages?: boolean;
        can_send_audios?: boolean;
        can_send_documents?: boolean;
        can_send_photos?: boolean;
        can_send_videos?: boolean;
        can_send_video_notes?: boolean;
        can_send_voice_notes?: boolean;
      };
    }

    const chatData = await botHttpCall<BotChatFull>("getChat", { chat_id: Number(chatId) });
    const memberCount = await botHttpCall<number>("getChatMemberCount", { chat_id: Number(chatId) }).catch(() => 0);

    const perms = chatData.permissions;
    const defaultRights: ChatBannedRights = perms
      ? {
          can_send_messages: perms.can_send_messages ?? true,
          can_send_media: (perms.can_send_photos ?? true) && (perms.can_send_videos ?? true),
          can_send_polls: perms.can_send_polls ?? true,
          can_send_other: perms.can_send_other_messages ?? true,
          can_add_web_page_previews: perms.can_add_web_page_previews ?? true,
          can_change_info: perms.can_change_info ?? true,
          can_invite_users: perms.can_invite_users ?? true,
          can_pin_messages: perms.can_pin_messages ?? true,
        }
      : fromBannedRights(undefined);

    return {
      chat: {
        id: chatData.id.toString(),
        title: chatData.title || "",
        type: chatData.type === "channel" ? "channel" : "supergroup",
        participantCount: typeof memberCount === "number" ? memberCount : 0,
        about: chatData.description || null,
        templateId: tpl?.template_id ?? null,
        isCompliant: tpl?.is_compliant ?? true,
      },
      about: chatData.description || null,
      slowModeDelay: chatData.slow_mode_delay ?? 0,
      defaultBannedRights: defaultRights,
      hasProtectedContent: chatData.has_protected_content ?? false,
      hasHiddenMembers: chatData.has_hidden_members ?? false,
      hasAggressiveAntiSpam: chatData.has_aggressive_anti_spam_enabled ?? false,
      linkedChatId: chatData.linked_chat_id?.toString() ?? null,
      inviteLink: chatData.invite_link ?? null,
    };
  }

  /**
   * Get participants list with filter support.
   */
  static async getParticipants(
    chatId: string,
    filter: "all" | "admins" | "banned" | "kicked" = "all",
    _offset = 0,
    _limit = 50
  ): Promise<{ participants: ChatParticipantInfo[]; total: number }> {
    // Bot HTTP API only supports listing admins (getChatAdministrators).
    // For "banned"/"kicked" filters, we return empty — these require user MTProto session.
    if (filter === "banned" || filter === "kicked") {
      return { participants: [], total: 0 };
    }

    interface BotChatMemberResult {
      user: {
        id: number;
        first_name?: string;
        last_name?: string;
        username?: string;
        is_bot?: boolean;
      };
      status: string; // "creator" | "administrator" | "member" | "restricted" | "left" | "kicked"
      custom_title?: string;
      is_anonymous?: boolean;
    }

    // getChatAdministrators returns all admins + creator
    const admins = await botHttpCall<BotChatMemberResult[]>(
      "getChatAdministrators",
      { chat_id: Number(chatId) }
    );

    const memberCount = await botHttpCall<number>(
      "getChatMemberCount",
      { chat_id: Number(chatId) }
    ).catch(() => 0);

    const participants: ChatParticipantInfo[] = admins.map((m) => ({
      userId: m.user.id.toString(),
      firstName: m.user.first_name ?? null,
      lastName: m.user.last_name ?? null,
      username: m.user.username ?? null,
      isAdmin: m.status === "administrator" || m.status === "creator",
      isCreator: m.status === "creator",
      isBanned: false,
      joinedDate: null,
    }));

    // For "all" filter, we return admins (Bot API limitation) with total = memberCount
    // For "admins" filter, same data
    return {
      participants,
      total: filter === "all" ? (typeof memberCount === "number" ? memberCount : participants.length) : participants.length,
    };
  }

  /**
   * Promote or edit an admin in the chat.
   */
  static async editAdmin(
    chatId: string,
    userId: string,
    rights: {
      changeInfo?: boolean;
      postMessages?: boolean;
      editMessages?: boolean;
      deleteMessages?: boolean;
      banUsers?: boolean;
      inviteUsers?: boolean;
      pinMessages?: boolean;
      addAdmins?: boolean;
      manageCall?: boolean;
    },
    rank?: string,
    adminTelegramId?: string
  ): Promise<void> {
    await botApiCall(
      "editAdmin",
      async (client) => {
        await client.invoke(
          new Api.channels.EditAdmin({
            channel: chatId,
            userId,
            adminRights: new Api.ChatAdminRights({
              changeInfo: rights.changeInfo,
              postMessages: rights.postMessages,
              editMessages: rights.editMessages,
              deleteMessages: rights.deleteMessages,
              banUsers: rights.banUsers,
              inviteUsers: rights.inviteUsers,
              pinMessages: rights.pinMessages,
              addAdmins: rights.addAdmins,
              manageCall: rights.manageCall,
            }),
            rank: rank || "",
          })
        );
      },
      2000
    );

    if (adminTelegramId) {
      await logAuditEvent({
        adminTelegramId,
        actionType: "edit_admin",
        targetChatId: chatId,
        targetUserId: userId,
        payload: { rights, rank },
        resultStatus: "success",
      });
    }
  }

  /**
   * Ban a user from the chat.
   */
  static async banUser(
    chatId: string,
    userId: string,
    untilDate?: number,
    adminTelegramId?: string
  ): Promise<void> {
    await botApiCall(
      "banUser",
      async (client) => {
        await client.invoke(
          new Api.channels.EditBanned({
            channel: chatId,
            participant: userId,
            bannedRights: new Api.ChatBannedRights({
              untilDate: untilDate ?? 0,
              viewMessages: true, // Full ban — cannot even view
              sendMessages: true,
              sendMedia: true,
              sendStickers: true,
              sendGifs: true,
              sendGames: true,
              sendInline: true,
              embedLinks: true,
            }),
          })
        );
      },
      2000
    );

    if (adminTelegramId) {
      await logAuditEvent({
        adminTelegramId,
        actionType: "ban_user",
        targetChatId: chatId,
        targetUserId: userId,
        payload: { untilDate },
        resultStatus: "success",
      });
    }
  }

  /**
   * Unban a user.
   */
  static async unbanUser(
    chatId: string,
    userId: string,
    adminTelegramId?: string
  ): Promise<void> {
    await botApiCall(
      "unbanUser",
      async (client) => {
        await client.invoke(
          new Api.channels.EditBanned({
            channel: chatId,
            participant: userId,
            bannedRights: new Api.ChatBannedRights({
              untilDate: 0,
              // All false = unrestricted
            }),
          })
        );
      },
      2000
    );

    if (adminTelegramId) {
      await logAuditEvent({
        adminTelegramId,
        actionType: "unban_user",
        targetChatId: chatId,
        targetUserId: userId,
        resultStatus: "success",
      });
    }
  }

  /**
   * Update default banned rights for a chat.
   */
  static async updateDefaultRights(
    chatId: string,
    rights: ChatBannedRights,
    adminTelegramId?: string
  ): Promise<void> {
    await botApiCall(
      "updateDefaultRights",
      async (client) => {
        await client.invoke(
          new Api.messages.EditChatDefaultBannedRights({
            peer: chatId,
            bannedRights: toBannedRights(rights),
          })
        );
      },
      2000
    );

    if (adminTelegramId) {
      await logAuditEvent({
        adminTelegramId,
        actionType: "update_default_rights",
        targetChatId: chatId,
        payload: { rights },
        resultStatus: "success",
      });
    }
  }

  /**
   * Toggle slow mode (seconds between messages).
   */
  static async toggleSlowMode(
    chatId: string,
    seconds: number,
    adminTelegramId?: string
  ): Promise<void> {
    await botApiCall(
      "toggleSlowMode",
      async (client) => {
        await client.invoke(
          new Api.channels.ToggleSlowMode({
            channel: chatId,
            seconds,
          })
        );
      },
      2000
    );

    if (adminTelegramId) {
      await logAuditEvent({
        adminTelegramId,
        actionType: "toggle_slow_mode",
        targetChatId: chatId,
        payload: { seconds },
        resultStatus: "success",
      });
    }
  }

  /**
   * Toggle "no forwards" (protected content).
   */
  static async toggleNoForwards(
    chatId: string,
    enabled: boolean,
    adminTelegramId?: string
  ): Promise<void> {
    await botApiCall(
      "toggleNoForwards",
      async (client) => {
        await client.invoke(
          new Api.messages.ToggleNoForwards({
            peer: chatId,
            enabled,
          })
        );
      },
      2000
    );

    if (adminTelegramId) {
      await logAuditEvent({
        adminTelegramId,
        actionType: "toggle_no_forwards",
        targetChatId: chatId,
        payload: { enabled },
        resultStatus: "success",
      });
    }
  }

  /**
   * Create an invite link for the chat.
   */
  static async createInviteLink(
    chatId: string,
    params: {
      title?: string;
      expireDate?: number;
      usageLimit?: number;
      requestNeeded?: boolean;
    },
    adminTelegramId?: string
  ): Promise<InviteLinkInfo> {
    const result = await botApiCall(
      "createInviteLink",
      async (client) => {
        const resp = await client.invoke(
          new Api.messages.ExportChatInvite({
            peer: chatId,
            title: params.title,
            expireDate: params.expireDate,
            usageLimit: params.usageLimit,
            requestNeeded: params.requestNeeded,
          })
        );

        if (!(resp instanceof Api.ChatInviteExported)) {
          throw new Error("Unexpected response type for invite link");
        }

        return {
          link: resp.link,
          title: resp.title ?? null,
          isRevoked: resp.revoked ?? false,
          isPermanent: resp.permanent ?? false,
          expireDate: resp.expireDate
            ? new Date(resp.expireDate * 1000).toISOString()
            : null,
          usageLimit: resp.usageLimit ?? null,
          usage: resp.usage ?? 0,
          requestNeeded: resp.requestNeeded ?? false,
        } as InviteLinkInfo;
      },
      2000
    );

    if (adminTelegramId) {
      await logAuditEvent({
        adminTelegramId,
        actionType: "create_invite_link",
        targetChatId: chatId,
        payload: params,
        resultStatus: "success",
      });
    }

    return result;
  }

  /**
   * Get all invite links for a chat.
   */
  static async getInviteLinks(
    chatId: string
  ): Promise<InviteLinkInfo[]> {
    return botApiCall(
      "getInviteLinks",
      async (client) => {
        // Need bot's own userId to query its invite links
        const me = await client.getMe();

        const result = await client.invoke(
          new Api.messages.GetExportedChatInvites({
            peer: chatId,
            adminId: me.id.toString(),
            limit: 50,
          })
        );

        return result.invites
          .filter((inv): inv is Api.ChatInviteExported =>
            inv instanceof Api.ChatInviteExported
          )
          .map((inv) => ({
            link: inv.link,
            title: inv.title ?? null,
            isRevoked: inv.revoked ?? false,
            isPermanent: inv.permanent ?? false,
            expireDate: inv.expireDate
              ? new Date(inv.expireDate * 1000).toISOString()
              : null,
            usageLimit: inv.usageLimit ?? null,
            usage: inv.usage ?? 0,
            requestNeeded: inv.requestNeeded ?? false,
          }));
      },
      2000
    );
  }

  /**
   * Revoke an invite link.
   */
  static async revokeInviteLink(
    chatId: string,
    link: string,
    adminTelegramId?: string
  ): Promise<void> {
    await botApiCall(
      "revokeInviteLink",
      async (client) => {
        await client.invoke(
          new Api.messages.EditExportedChatInvite({
            peer: chatId,
            link,
            revoked: true,
          })
        );
      },
      2000
    );

    if (adminTelegramId) {
      await logAuditEvent({
        adminTelegramId,
        actionType: "revoke_invite_link",
        targetChatId: chatId,
        payload: { link },
        resultStatus: "success",
      });
    }
  }

  /**
   * Get admin log (requires user session, not bot).
   * Telegram only keeps 48h of admin logs.
   */
  static async getChatEventLog(
    _adminTelegramId: string,
    chatId: string,
    limit = 100
  ): Promise<ChatEventEntry[]> {
    // Telegram's channels.GetAdminLog requires a user session (not bot).
    // Fall back to events previously collected and stored in our database.
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("chat_event_log")
      .select("id, chat_id, event_id, date, user_id, action, payload, collected_at")
      .eq("chat_id", chatId)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[getChatEventLog] DB query failed:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      chat_id: row.chat_id,
      event_id: row.event_id,
      date: row.date,
      user_id: row.user_id,
      action: row.action ?? "unknown",
      payload: (row.payload ?? {}) as Record<string, unknown>,
      collected_at: row.collected_at,
    }));
  }
}
