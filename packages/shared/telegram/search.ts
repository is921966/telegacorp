import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { callWithFloodWait, rateLimiter } from "./flood-wait";
import type { TelegramMessage, TelegramContact, GlobalSearchResults } from "../types/telegram";

export async function searchMessages(
  client: TelegramClient,
  chatId: string,
  query: string,
  limit = 50
): Promise<TelegramMessage[]> {
  await rateLimiter.throttle("searchMessages", 2000);

  const messages = await callWithFloodWait(() =>
    client.getMessages(chatId, { search: query, limit })
  );

  return messages
    .filter((msg): msg is Api.Message => msg instanceof Api.Message)
    .map((msg) => ({
      id: msg.id,
      chatId,
      senderId: msg.fromId
        ? (msg.fromId as Api.PeerUser).userId?.toString()
        : undefined,
      text: msg.message || "",
      date: new Date((msg.date || 0) * 1000),
      isOutgoing: msg.out || false,
      replyToId: msg.replyTo?.replyToMsgId,
      isEdited: !!msg.editDate,
    }));
}

export async function searchGlobal(
  client: TelegramClient,
  query: string,
  limit = 50
) {
  await rateLimiter.throttle("searchGlobal", 3000);

  const result = await callWithFloodWait(() =>
    client.invoke(
      new Api.messages.SearchGlobal({
        q: query,
        filter: new Api.InputMessagesFilterEmpty(),
        minDate: 0,
        maxDate: 0,
        offsetRate: 0,
        offsetPeer: new Api.InputPeerEmpty(),
        offsetId: 0,
        limit,
      })
    )
  );

  return result;
}

/**
 * Perform a global search and return structured results grouped by type.
 * Combines contacts.Search (for people) with messages.SearchGlobal (for messages).
 */
export async function searchGlobalStructured(
  client: TelegramClient,
  query: string,
  limit = 30
): Promise<GlobalSearchResults> {
  // Run contact search and message search in parallel
  const [contactResult, messageResult] = await Promise.allSettled([
    (async () => {
      const { searchContacts } = await import("./contacts");
      return searchContacts(client, query, 10);
    })(),
    searchGlobal(client, query, limit),
  ]);

  // Process contacts
  const contacts: TelegramContact[] = [];
  if (contactResult.status === "fulfilled") {
    contacts.push(...contactResult.value.myContacts, ...contactResult.value.globalUsers);
  }

  // Process messages from global search
  const messages: GlobalSearchResults["messages"] = [];

  if (messageResult.status === "fulfilled") {
    const result = messageResult.value;

    // Build maps for resolving entities
    const usersMap = new Map<string, Api.User>();
    const chatsMap = new Map<string, string>(); // id -> title

    if ("users" in result) {
      for (const u of (result as { users: Api.TypeUser[] }).users) {
        if (u instanceof Api.User) usersMap.set(u.id.toString(), u);
      }
    }
    if ("chats" in result) {
      for (const c of (result as { chats: Api.TypeChat[] }).chats) {
        if (c instanceof Api.Chat) {
          chatsMap.set((-BigInt(c.id.toString())).toString(), c.title);
        } else if (c instanceof Api.Channel) {
          chatsMap.set((-BigInt("1000000000000") - BigInt(c.id.toString())).toString(), c.title);
        }
      }
    }

    if ("messages" in result) {
      for (const msg of (result as { messages: Api.TypeMessage[] }).messages) {
        if (msg instanceof Api.Message) {
          let chatId = "";
          let chatTitle = "";

          if (msg.peerId instanceof Api.PeerUser) {
            chatId = msg.peerId.userId.toString();
            const u = usersMap.get(chatId);
            chatTitle = u ? ((u.firstName || "") + " " + (u.lastName || "")).trim() : chatId;
          } else if (msg.peerId instanceof Api.PeerChat) {
            chatId = (-BigInt(msg.peerId.chatId.toString())).toString();
            chatTitle = chatsMap.get(chatId) || chatId;
          } else if (msg.peerId instanceof Api.PeerChannel) {
            chatId = (-BigInt("1000000000000") - BigInt(msg.peerId.channelId.toString())).toString();
            chatTitle = chatsMap.get(chatId) || chatId;
          }

          messages.push({
            chatId,
            chatTitle,
            messageId: msg.id,
            text: msg.message || "",
            date: new Date((msg.date || 0) * 1000),
            senderName: undefined,
          });
        }
      }
    }
  }

  return { contacts, messages };
}
