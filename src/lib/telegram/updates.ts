import type { TelegramClient } from "telegram";
import { NewMessage } from "telegram/events";
import { Raw } from "telegram/events";
import { Api } from "telegram";
import type { TelegramMessage } from "@/types/telegram";

type MessageHandler = (message: TelegramMessage) => void;
type DeleteHandler = (chatId: string, messageIds: number[]) => void;

/** Cleanup function returned by subscribe methods. Removes the event handler from the client. */
export type Unsubscribe = () => void;

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

export function subscribeToNewMessages(
  client: TelegramClient,
  handler: MessageHandler
): Unsubscribe {
  const callback = (event: { message?: Api.Message }) => {
    const msg = event.message;
    if (!msg) return;

    const chatId = peerToDialogId(msg.peerId);
    if (!chatId) return;

    handler({
      id: msg.id,
      chatId,
      senderId: msg.senderId?.toString(),
      text: msg.message || "",
      date: new Date((msg.date || 0) * 1000),
      isOutgoing: msg.out || false,
      replyToId: msg.replyTo?.replyToMsgId,
    });
  };

  const event = new NewMessage({});
  client.addEventHandler(callback, event);

  return () => {
    client.removeEventHandler(callback, event);
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
