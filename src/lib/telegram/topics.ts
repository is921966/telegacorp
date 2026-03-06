import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { callWithFloodWait, rateLimiter } from "./flood-wait";
import { mapMessages } from "./messages";
import type { TelegramForumTopic, TelegramMessage } from "@/types/telegram";

/** Telegram's predefined forum topic icon colors */
const TOPIC_COLORS: Record<number, number> = {
  0: 0x6fb9f0,
  1: 0xffd67e,
  2: 0xcb86db,
  3: 0x8eee98,
  4: 0xff93b2,
  5: 0xfb6f5f,
};

/** Normalize icon_color from GramJS (may be index or raw color) */
function normalizeIconColor(raw: number | undefined): number {
  if (raw === undefined) return TOPIC_COLORS[0];
  if (raw in TOPIC_COLORS) return TOPIC_COLORS[raw];
  return raw;
}

/** Extract sender name from a GramJS Message */
function extractSenderNameFromMsg(msg: Api.Message): string | undefined {
  if (!msg.fromId) return undefined;
  if (msg.fromId instanceof Api.PeerUser) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sender = (msg as any)._sender as Api.User | undefined;
    if (sender) {
      const first = sender.firstName || "";
      const last = sender.lastName || "";
      return (first + " " + last).trim() || sender.username || undefined;
    }
  }
  return undefined;
}

/**
 * Fetch forum topics for a supergroup with forum enabled.
 * Uses Api.channels.GetForumTopics.
 */
export async function getForumTopics(
  client: TelegramClient,
  chatId: string
): Promise<TelegramForumTopic[]> {
  await rateLimiter.throttle(`getForumTopics:${chatId}`, 500);

  const entity = await client.getInputEntity(chatId);

  const result = await callWithFloodWait(() =>
    client.invoke(
      new Api.channels.GetForumTopics({
        channel: entity,
        limit: 100,
        offsetDate: 0,
        offsetId: 0,
        offsetTopic: 0,
        q: "",
      })
    )
  );

  if (!result || !("topics" in result)) return [];

  // Build a map of messages by ID for last message resolution
  const messagesMap = new Map<number, Api.Message>();
  if ("messages" in result && Array.isArray(result.messages)) {
    for (const msg of result.messages) {
      if (msg instanceof Api.Message) {
        messagesMap.set(msg.id, msg);
      }
    }
  }

  const topics: TelegramForumTopic[] = [];

  for (const topic of result.topics) {
    if (!(topic instanceof Api.ForumTopic)) continue;

    // Find the last message for this topic
    let lastMessage: TelegramForumTopic["lastMessage"] | undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topicMsg = messagesMap.get((topic as any).topMessage || 0);
    if (topicMsg) {
      lastMessage = {
        text: topicMsg.message || "",
        date: new Date((topicMsg.date || 0) * 1000),
        senderId: topicMsg.fromId
          ? (topicMsg.fromId as Api.PeerUser).userId?.toString()
          : undefined,
        senderName: extractSenderNameFromMsg(topicMsg),
        isOutgoing: topicMsg.out || false,
      };
    }

    topics.push({
      id: topic.id,
      title: topic.title,
      iconColor: normalizeIconColor(topic.iconColor),
      iconEmojiId: topic.iconEmojiId?.toString(),
      unreadCount: topic.unreadCount || 0,
      unreadMentionsCount: topic.unreadMentionsCount || 0,
      lastMessage,
      isPinned: topic.pinned || false,
      isClosed: topic.closed || false,
      isHidden: topic.hidden || false,
      isGeneral: topic.id === 1,
    });
  }

  // Sort: pinned first, then by last message date (newest first)
  topics.sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const aTime = a.lastMessage?.date?.getTime() || 0;
    const bTime = b.lastMessage?.date?.getTime() || 0;
    return bTime - aTime;
  });

  return topics;
}

/** In-memory cache for custom emoji URLs: emojiId → data URL */
const emojiCache = new Map<string, string>();
/** Set of emoji IDs currently being fetched (prevents duplicate requests) */
const pendingEmojiDownloads = new Set<string>();

/**
 * Batch-download custom emoji icons for forum topics.
 * Uses Api.messages.GetCustomEmojiDocuments to get sticker documents,
 * then downloads a static thumbnail for each and converts to data URL.
 *
 * Returns a map of emojiId → data URL.
 */
export async function fetchTopicEmojis(
  client: TelegramClient,
  emojiIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // Filter out already cached and currently downloading
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toFetch: any[] = [];
  for (const id of emojiIds) {
    if (emojiCache.has(id)) {
      result.set(id, emojiCache.get(id)!);
    } else if (!pendingEmojiDownloads.has(id)) {
      toFetch.push(BigInt(id));
      pendingEmojiDownloads.add(id);
    }
  }

  if (toFetch.length === 0) return result;

  try {
    const docs = await callWithFloodWait(() =>
      client.invoke(
        new Api.messages.GetCustomEmojiDocuments({
          documentId: toFetch,
        })
      )
    );

    if (!docs || !Array.isArray(docs)) return result;

    // Download each document's thumbnail as a static image
    for (const doc of docs) {
      if (!(doc instanceof Api.Document)) continue;

      const docId = doc.id.toString();
      const mimeType = doc.mimeType || "image/webp";

      try {
        // Use client.downloadMedia with the last (largest) thumbnail
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const buffer = await client.downloadMedia(doc as any, {
          thumb: doc.thumbs && doc.thumbs.length > 0
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (doc.thumbs[doc.thumbs.length - 1] as any)
            : undefined,
        });

        if (buffer && (buffer as Uint8Array).length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bytes = new Uint8Array(buffer as any);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);
          // Animated sticker thumbnails are JPEG; static stickers keep original mime
          const thumbMime = mimeType === "application/x-tgsticker" || mimeType === "video/webm"
            ? "image/jpeg"
            : mimeType;
          const dataUrl = `data:${thumbMime};base64,${base64}`;

          emojiCache.set(docId, dataUrl);
          result.set(docId, dataUrl);
        }
      } catch {
        // Non-critical: topic will fall back to colored circle
      } finally {
        pendingEmojiDownloads.delete(docId);
      }
    }
  } catch {
    // Non-critical: cleanup pending flags
    for (const id of toFetch) {
      pendingEmojiDownloads.delete(id.toString());
    }
  }

  return result;
}

/**
 * Fetch messages for a specific forum topic.
 * Uses Api.messages.GetReplies with msgId = topicId.
 */
export async function getTopicMessages(
  client: TelegramClient,
  chatId: string,
  topicId: number,
  limit = 50,
  offsetId?: number
): Promise<TelegramMessage[]> {
  await rateLimiter.throttle(`getTopicMessages:${chatId}:${topicId}`, 300);

  const entity = await client.getInputEntity(chatId);

  const result = await callWithFloodWait(() =>
    client.invoke(
      new Api.messages.GetReplies({
        peer: entity,
        msgId: topicId,
        offsetId: offsetId || 0,
        addOffset: 0,
        limit,
        maxId: 0,
        minId: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hash: BigInt(0) as any,
      })
    )
  );

  if (!result || !("messages" in result)) return [];

  return mapMessages(result.messages as Api.Message[], chatId);
}
