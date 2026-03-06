import type { TelegramClient } from "telegram";
import { NewMessage } from "telegram/events";
import { Raw } from "telegram/events";
import { Api } from "telegram";
import type { TelegramMessage } from "@/types/telegram";

type MessageHandler = (message: TelegramMessage) => void;
type DeleteHandler = (chatId: string, messageIds: number[]) => void;

/** Cleanup function returned by subscribe methods. Removes the event handler from the client. */
export type Unsubscribe = () => void;

/** Media types used in dialog lastMessage preview */
type DialogMediaType = "photo" | "video" | "document" | "voice" | "sticker" | "gif" | "audio" | "contact" | "location" | "poll";

/** Extract a simplified media type from a message for dialog preview */
function extractMediaType(msg: Api.Message): DialogMediaType | undefined {
  const media = msg.media;
  if (!media) return undefined;

  if (media instanceof Api.MessageMediaPhoto) return "photo";
  if (media instanceof Api.MessageMediaDocument) {
    const doc = (media as Api.MessageMediaDocument).document;
    if (doc instanceof Api.Document) {
      const isSticker = doc.attributes?.some((a) => a instanceof Api.DocumentAttributeSticker);
      if (isSticker) return "sticker";
      const isVoice = doc.attributes?.some(
        (a) => a instanceof Api.DocumentAttributeAudio && (a as Api.DocumentAttributeAudio).voice
      );
      if (isVoice) return "voice";
      const isAudio = doc.attributes?.some((a) => a instanceof Api.DocumentAttributeAudio);
      if (isAudio) return "audio";
      const isAnimated = doc.attributes?.some((a) => a instanceof Api.DocumentAttributeAnimated);
      if (isAnimated) return "gif";
      const isVideo = doc.attributes?.some((a) => a instanceof Api.DocumentAttributeVideo);
      if (isVideo) return "video";
      return "document";
    }
  }
  if (media instanceof Api.MessageMediaContact) return "contact";
  if (media instanceof Api.MessageMediaGeo || media instanceof Api.MessageMediaGeoLive) return "location";
  if (media instanceof Api.MessageMediaPoll) return "poll";
  return undefined;
}

/**
 * Convert a Peer (PeerUser/PeerChat/PeerChannel) to dialog ID string.
 * Must match the format used in dialogs.ts: dialog.id!.toString()
 * - PeerUser: userId (positive)
 * - PeerChat: -chatId (negative)
 * - PeerChannel: -(1000000000000 + channelId) (negative)
 */
export function peerToDialogId(peer: Api.TypePeer | undefined): string {
  if (!peer) return "";
  if (peer instanceof Api.PeerUser) {
    return peer.userId.toString();
  }
  if (peer instanceof Api.PeerChat) {
    return (-BigInt(peer.chatId.toString())).toString();
  }
  if (peer instanceof Api.PeerChannel) {
    return (-BigInt("1000000000000") - BigInt(peer.channelId.toString())).toString();
  }
  return "";
}

/** Build a TelegramMessage from a raw Api.Message and call handler */
function dispatchMessage(msg: Api.Message, handler: MessageHandler): void {
  const chatId = peerToDialogId(msg.peerId);
  if (!chatId) return;

  // Extract sender name from GramJS's _sender property
  let senderName: string | undefined;
  if (msg.fromId instanceof Api.PeerUser) {
    const sender = (msg as unknown as { _sender?: Api.User })._sender;
    if (sender) {
      const first = sender.firstName || "";
      const last = sender.lastName || "";
      senderName = (first + " " + last).trim() || sender.username || undefined;
    }
  }

  // Extract media type and filename for dialog preview
  const mediaType = extractMediaType(msg);
  let mediaFileName: string | undefined;
  if (mediaType === "document" && msg.media instanceof Api.MessageMediaDocument) {
    const doc = (msg.media as Api.MessageMediaDocument).document;
    if (doc instanceof Api.Document) {
      const fnAttr = doc.attributes?.find((a) => a instanceof Api.DocumentAttributeFilename);
      if (fnAttr) mediaFileName = (fnAttr as Api.DocumentAttributeFilename).fileName;
    }
  }

  // Extract forum topic ID from reply header (for forum supergroups)
  const forumTopicId = msg.replyTo?.replyToTopId ?? undefined;

  handler({
    id: msg.id,
    chatId,
    senderId: msg.senderId?.toString(),
    senderName,
    text: msg.message || "",
    date: new Date((msg.date || 0) * 1000),
    isOutgoing: msg.out || false,
    replyToId: msg.replyTo?.replyToMsgId,
    forumTopicId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    media: mediaType ? ({ type: mediaType, fileName: mediaFileName } as any) : undefined,
  });
}

export function subscribeToNewMessages(
  client: TelegramClient,
  handler: MessageHandler
): Unsubscribe {
  // 1) NewMessage event — handles UpdateNewMessage (private chats & groups)
  const newMsgCallback = (event: { message?: Api.Message }) => {
    const msg = event.message;
    if (!msg) return;
    dispatchMessage(msg, handler);
  };

  const newMsgEvent = new NewMessage({});
  client.addEventHandler(newMsgCallback, newMsgEvent);

  // 2) Raw event — catches UpdateNewChannelMessage for channels/supergroups
  //    that NewMessage may miss. Duplicates are ignored by addMessage (dedup by id).
  const rawCallback = (update: Api.TypeUpdate) => {
    if (update instanceof Api.UpdateNewChannelMessage) {
      const msg = update.message;
      if (msg instanceof Api.Message) {
        dispatchMessage(msg, handler);
      }
    }
  };

  const rawEvent = new Raw({});
  client.addEventHandler(rawCallback, rawEvent);

  return () => {
    client.removeEventHandler(newMsgCallback, newMsgEvent);
    client.removeEventHandler(rawCallback, rawEvent);
  };
}

export function subscribeToEditedMessages(
  client: TelegramClient,
  handler: MessageHandler
): Unsubscribe {
  const callback = (update: Api.TypeUpdate) => {
    if (
      update instanceof Api.UpdateEditMessage ||
      update instanceof Api.UpdateEditChannelMessage
    ) {
      const msg = update.message;
      if (msg instanceof Api.Message) {
        const chatId = peerToDialogId(msg.peerId);
        if (!chatId) return;

        handler({
          id: msg.id,
          chatId,
          senderId: msg.fromId
            ? (msg.fromId as Api.PeerUser).userId?.toString()
            : undefined,
          text: msg.message || "",
          date: new Date((msg.date || 0) * 1000),
          isOutgoing: msg.out || false,
          isEdited: true,
        });
      }
    }
  };

  const event = new Raw({});
  client.addEventHandler(callback, event);

  return () => {
    client.removeEventHandler(callback, event);
  };
}

export function subscribeToDeletedMessages(
  client: TelegramClient,
  handler: DeleteHandler
): Unsubscribe {
  const callback = (update: Api.TypeUpdate) => {
    if (update instanceof Api.UpdateDeleteMessages) {
      // For non-channel deletes we don't know the chatId from the update.
      // Pass empty string — the store can iterate all chats to remove by messageId.
      handler("", update.messages || []);
    } else if (update instanceof Api.UpdateDeleteChannelMessages) {
      const chatId = (-BigInt("1000000000000") - BigInt(update.channelId.toString())).toString();
      handler(chatId, update.messages || []);
    }
  };

  const event = new Raw({});
  client.addEventHandler(callback, event);

  return () => {
    client.removeEventHandler(callback, event);
  };
}
