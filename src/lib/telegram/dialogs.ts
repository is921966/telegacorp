import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { callWithFloodWait, rateLimiter } from "./flood-wait";
import type { TelegramDialog, TelegramFolder } from "@/types/telegram";

/** Extract media type from a message */
function getMediaType(
  message: Api.Message
): NonNullable<TelegramDialog["lastMessage"]>["mediaType"] {
  const media = message.media;
  if (!media) return undefined;
  if (media instanceof Api.MessageMediaPhoto) return "photo";
  if (media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    if (doc instanceof Api.Document) {
      const attrs = doc.attributes || [];
      for (const attr of attrs) {
        if (attr instanceof Api.DocumentAttributeSticker) return "sticker";
        if (attr instanceof Api.DocumentAttributeAnimated) return "gif";
        if (attr instanceof Api.DocumentAttributeVideo) {
          return "video";
        }
        if (attr instanceof Api.DocumentAttributeAudio) {
          return attr.voice ? "voice" : "audio";
        }
      }
      return "document";
    }
  }
  if (media instanceof Api.MessageMediaContact) return "contact";
  if (media instanceof Api.MessageMediaGeo || media instanceof Api.MessageMediaGeoLive)
    return "location";
  if (media instanceof Api.MessageMediaPoll) return "poll";
  return undefined;
}

/** Get sender display name from a message, resolving against dialog entities */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSenderName(message: Api.Message, dialog: { entity?: any }): string | undefined {
  if (!message.fromId) return undefined;

  // For PeerUser, try to get name from message._sender or fall back
  if (message.fromId instanceof Api.PeerUser) {
    const sender = (message as unknown as { _sender?: Api.User })._sender;
    if (sender) {
      const first = sender.firstName || "";
      const last = sender.lastName || "";
      return (first + " " + last).trim() || sender.username || undefined;
    }
  }

  // For PeerChannel (anonymous admin)
  if (message.fromId instanceof Api.PeerChannel) {
    return undefined; // channel post, no individual sender
  }

  return undefined;
}

/** Convert an InputPeer to the dialog ID string format used by GramJS */
function inputPeerToDialogId(peer: Api.TypeInputPeer): string | null {
  try {
    if (peer instanceof Api.InputPeerUser) {
      return peer.userId.toString();
    }
    if (peer instanceof Api.InputPeerChat) {
      // GramJS uses -chatId for group chats
      return (-BigInt(peer.chatId.toString())).toString();
    }
    if (peer instanceof Api.InputPeerChannel) {
      // GramJS uses -(1000000000000 + channelId) for channels
      return (-BigInt("1000000000000") - BigInt(peer.channelId.toString())).toString();
    }
  } catch {
    return null;
  }
  return null;
}

/** Check if a dialog matches a folder's filter criteria */
export function dialogMatchesFolder(
  dialog: TelegramDialog,
  folder: TelegramFolder
): boolean {
  // "All chats" folder matches everything
  if (folder.id === 0) return true;

  // Check explicit excludes first
  if (folder.excludePeerIds.includes(dialog.id)) return false;

  // Check exclude flags
  if (folder.flags.excludeMuted && dialog.isMuted) return false;
  if (folder.flags.excludeRead && dialog.unreadCount === 0 && !dialog.hasDraft) return false;

  // Check explicit includes (includePeers + pinnedPeers)
  if (folder.includePeerIds.includes(dialog.id)) return true;

  // Check category flags
  if (folder.flags.groups && dialog.type === "group") return true;
  if (folder.flags.broadcasts && dialog.type === "channel") return true;
  if (folder.flags.bots && dialog.isBot) return true;
  // contacts/nonContacts — we approximate: any non-bot user matches both
  if (folder.flags.contacts && dialog.type === "user" && !dialog.isBot) return true;
  if (folder.flags.nonContacts && dialog.type === "user" && !dialog.isBot) return true;

  return false;
}

/** Get chat folders/filters */
export async function getDialogFilters(
  client: TelegramClient
): Promise<TelegramFolder[]> {
  try {
    const result = await client.invoke(new Api.messages.GetDialogFilters());
    const folders: TelegramFolder[] = [];

    // "All Chats" as first folder — no filtering needed
    folders.push({
      id: 0,
      title: "Все чаты",
      includePeerIds: [],
      pinnedPeerIds: [],
      excludePeerIds: [],
      flags: {},
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = result as any;
    const filtersArray: unknown[] = res?.filters ?? (Array.isArray(res) ? res : []);
    for (const filter of filtersArray) {
      if (filter instanceof Api.DialogFilter) {
        const title = typeof filter.title === "string"
          ? filter.title
          : (filter.title as { text?: string })?.text || `Folder ${filter.id}`;

        // Extract pinned peer IDs (ordered)
        const pinnedPeerIds: string[] = [];
        for (const peer of filter.pinnedPeers || []) {
          const id = inputPeerToDialogId(peer);
          if (id) pinnedPeerIds.push(id);
        }

        // Extract peer IDs from includePeers + pinnedPeers
        const includePeerIds: string[] = [...pinnedPeerIds];
        for (const peer of filter.includePeers || []) {
          const id = inputPeerToDialogId(peer);
          if (id && !includePeerIds.includes(id)) includePeerIds.push(id);
        }

        // Extract peer IDs from excludePeers
        const excludePeerIds: string[] = [];
        for (const peer of filter.excludePeers || []) {
          const id = inputPeerToDialogId(peer);
          if (id) excludePeerIds.push(id);
        }

        folders.push({
          id: filter.id,
          title,
          emoticon: filter.emoticon || undefined,
          includePeerIds,
          pinnedPeerIds,
          excludePeerIds,
          flags: {
            contacts: filter.contacts || false,
            nonContacts: filter.nonContacts || false,
            groups: filter.groups || false,
            broadcasts: filter.broadcasts || false,
            bots: filter.bots || false,
            excludeMuted: filter.excludeMuted || false,
            excludeRead: filter.excludeRead || false,
            excludeArchived: filter.excludeArchived || false,
          },
        });
      }
    }

    return folders;
  } catch (err) {
    console.error("Failed to get dialog filters:", err);
    return [{ id: 0, title: "Все чаты", includePeerIds: [], pinnedPeerIds: [], excludePeerIds: [], flags: {} }];
  }
}

export async function getDialogs(
  client: TelegramClient,
  limit = 100,
  offsetDate?: number
): Promise<TelegramDialog[]> {
  await rateLimiter.throttle("getDialogs", 2000);

  const params: { limit: number; offsetDate?: number } = { limit };
  if (offsetDate) params.offsetDate = offsetDate;

  const dialogs = await callWithFloodWait(() =>
    client.getDialogs(params)
  );

  return dialogs.map((dialog, index) => {
    const entity = dialog.entity;
    let type: TelegramDialog["type"] = "user";
    let isVerified = false;
    let isMuted = false;
    let isBot = false;
    let isForum = false;
    let participantsCount: number | undefined;
    let lastSeen: Date | undefined;
    let emojiStatus: string | undefined;
    let isPremium = false;
    let hasBotApp = false;

    if (entity instanceof Api.User) {
      type = "user";
      isVerified = entity.verified || false;
      isBot = entity.bot || false;
      isPremium = entity.premium || false;
      // Extract last seen
      if (entity.status) {
        if (entity.status instanceof Api.UserStatusOffline) {
          lastSeen = new Date(entity.status.wasOnline * 1000);
        }
      }
      // Extract emoji status
      if (entity.emojiStatus && "documentId" in entity.emojiStatus) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        emojiStatus = (entity.emojiStatus as any).documentId?.toString();
      }
      // Check for bot mini-app
      if (isBot && entity.botAttachMenu) {
        hasBotApp = true;
      }
    } else if (entity instanceof Api.Chat || entity instanceof Api.ChatForbidden) {
      type = "group";
      if (entity instanceof Api.Chat) {
        participantsCount = entity.participantsCount;
      }
    } else if (entity instanceof Api.Channel) {
      type = entity.megagroup ? "group" : "channel";
      isVerified = entity.verified || false;
      isForum = entity.forum || false;
      participantsCount = entity.participantsCount;
    }

    // Check mute status from notifySettings on the raw dialog
    // Use duck-typing to avoid instanceof issues with GramJS deserialization
    const rawDialog = dialog.dialog;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ns = (rawDialog as any)?.notifySettings;
    if (ns) {
      // GramJS may use camelCase or snake_case depending on version
      const muteUntil = ns.muteUntil ?? ns.mute_until;
      if (muteUntil && Number(muteUntil) > Math.floor(Date.now() / 1000)) {
        isMuted = true;
      }
      // "Без звука" — silent can be Bool, boolean, or truthy value
      if (ns.silent) {
        isMuted = true;
      }
    }

    // Additional: check GramJS high-level dialog properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dlg = dialog as any;
    if (!isMuted && (dlg.archived === false || dlg.archived === undefined)) {
      // Check if GramJS Dialog object exposes mute info directly
      if (dlg.dialog?.notifySettings?.className === "PeerNotifySettings") {
        const settings = dlg.dialog.notifySettings;
        if (settings.silent || (settings.muteUntil && Number(settings.muteUntil) > Math.floor(Date.now() / 1000))) {
          isMuted = true;
        }
      }
    }

    // Check for draft
    let hasDraft = false;
    let draftText: string | undefined;
    if (rawDialog instanceof Api.Dialog && rawDialog.draft) {
      if (rawDialog.draft instanceof Api.DraftMessage) {
        hasDraft = true;
        draftText = rawDialog.draft.message || "";
      }
    }

    // Extract unread mentions count
    let unreadMentionsCount = 0;
    if (rawDialog instanceof Api.Dialog) {
      unreadMentionsCount = rawDialog.unreadMentionsCount || 0;
    }

    // Online status for users
    let isOnline = false;
    if (entity instanceof Api.User && entity.status) {
      isOnline = entity.status instanceof Api.UserStatusOnline;
    }

    // Message data
    const msg = dialog.message;
    let lastMessage: TelegramDialog["lastMessage"] | undefined;
    if (msg && msg instanceof Api.Message) {
      const isOutgoing = msg.out || false;
      let isRead = false;
      if (isOutgoing && rawDialog instanceof Api.Dialog) {
        isRead = msg.id <= (rawDialog.readOutboxMaxId || 0);
      }

      const senderName =
        type !== "user" ? getSenderName(msg, dialog) : undefined;

      lastMessage = {
        text: msg.message || "",
        date: new Date((msg.date || 0) * 1000),
        senderId: msg.fromId
          ? (msg.fromId as Api.PeerUser).userId?.toString()
          : undefined,
        senderName,
        isOutgoing,
        isRead,
        mediaType: getMediaType(msg),
      };
    }

    return {
      id: dialog.id!.toString(),
      type,
      title: dialog.title || "Unknown",
      unreadCount: dialog.unreadCount,
      unreadMentionsCount,
      isPinned: dialog.pinned || false,
      isVerified,
      isMuted,
      isBot,
      isForum,
      isOnline,
      hasDraft,
      draftText,
      folderId: 0,
      lastMessage,
      participantsCount,
      isPremium,
      lastSeen,
      emojiStatus,
      hasBotApp,
      apiOrder: index,
    };
  });
}

export async function markAsRead(
  client: TelegramClient,
  chatId: string
): Promise<void> {
  await rateLimiter.throttle("markAsRead", 500);
  const peer = await client.getInputEntity(chatId);
  await client.invoke(
    new Api.messages.ReadHistory({
      peer,
      maxId: 0,
    })
  );
}

/** Get pinned messages for a chat */
export async function getPinnedMessages(
  client: TelegramClient,
  chatId: string
): Promise<{ id: number; text: string }[]> {
  try {
    await rateLimiter.throttle("getPinnedMessages", 1000);
    const peer = await client.getInputEntity(chatId);
    const result = await client.invoke(
      new Api.messages.Search({
        peer,
        q: "",
        filter: new Api.InputMessagesFilterPinned(),
        minDate: 0,
        maxDate: 0,
        offsetId: 0,
        addOffset: 0,
        limit: 10,
        maxId: 0,
        minId: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hash: BigInt(0) as any,
      })
    );

    if ("messages" in result) {
      return result.messages
        .filter((m): m is Api.Message => m instanceof Api.Message)
        .map((m) => ({
          id: m.id,
          text: m.message || "",
        }));
    }
    return [];
  } catch {
    return [];
  }
}
