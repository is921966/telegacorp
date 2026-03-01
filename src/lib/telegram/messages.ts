import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { callWithFloodWait, rateLimiter } from "./flood-wait";
import type { TelegramMessage, TelegramMedia, TelegramReaction, TextEntity, ForwardInfo, WebPagePreview } from "@/types/telegram";

function extractMedia(message: Api.Message): TelegramMedia | undefined {
  const media = message.media;
  if (!media) return undefined;

  if (media instanceof Api.MessageMediaPhoto) {
    const photo = media.photo;
    let width: number | undefined;
    let height: number | undefined;
    if (photo instanceof Api.Photo && photo.sizes) {
      for (const size of photo.sizes) {
        if ("w" in size && "h" in size) {
          width = (size as { w: number }).w;
          height = (size as { h: number }).h;
        }
      }
    }
    return { type: "photo", width, height };
  }
  if (media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    if (doc instanceof Api.Document) {
      const isSticker = doc.attributes?.some(
        (a) => a instanceof Api.DocumentAttributeSticker
      );
      const isAnimated = doc.attributes?.some(
        (a) => a instanceof Api.DocumentAttributeAnimated
      );
      if (isSticker) {
        const stickerAttr = doc.attributes?.find(
          (a): a is Api.DocumentAttributeImageSize =>
            a instanceof Api.DocumentAttributeImageSize
        );
        return {
          type: "sticker",
          mimeType: doc.mimeType,
          width: stickerAttr?.w,
          height: stickerAttr?.h,
        };
      }

      const isVideo = doc.mimeType?.startsWith("video/") || isAnimated;
      const isVoice = doc.attributes?.some(
        (a) => a instanceof Api.DocumentAttributeAudio && a.voice
      );
      const videoAttr = doc.attributes?.find(
        (a): a is Api.DocumentAttributeVideo => a instanceof Api.DocumentAttributeVideo
      );
      return {
        type: isVoice ? "voice" : isVideo ? "video" : "document",
        mimeType: doc.mimeType,
        size: Number(doc.size),
        fileName: doc.attributes?.find(
          (a): a is Api.DocumentAttributeFilename =>
            a instanceof Api.DocumentAttributeFilename
        )?.fileName,
        duration: videoAttr?.duration,
        width: videoAttr?.w,
        height: videoAttr?.h,
      };
    }
  }
  return undefined;
}

function extractEntities(message: Api.Message): TextEntity[] | undefined {
  if (!message.entities || message.entities.length === 0) return undefined;

  const result: TextEntity[] = [];
  for (const entity of message.entities) {
    let type: TextEntity["type"] | null = null;
    let url: string | undefined;
    let language: string | undefined;

    if (entity instanceof Api.MessageEntityBold) type = "bold";
    else if (entity instanceof Api.MessageEntityItalic) type = "italic";
    else if (entity instanceof Api.MessageEntityCode) type = "code";
    else if (entity instanceof Api.MessageEntityPre) {
      type = "pre";
      language = entity.language || undefined;
    }
    else if (entity instanceof Api.MessageEntityUnderline) type = "underline";
    else if (entity instanceof Api.MessageEntityStrike) type = "strike";
    else if (entity instanceof Api.MessageEntityBlockquote) type = "blockquote";
    else if (entity instanceof Api.MessageEntityTextUrl) {
      type = "textUrl";
      url = entity.url;
    }
    else if (entity instanceof Api.MessageEntityMention) type = "mention";
    else if (entity instanceof Api.MessageEntityHashtag) type = "hashtag";
    else if (entity instanceof Api.MessageEntitySpoiler) type = "spoiler";

    if (type) {
      result.push({ offset: entity.offset, length: entity.length, type, url, language });
    }
  }
  return result.length > 0 ? result : undefined;
}

function extractForwardInfo(message: Api.Message): ForwardInfo | undefined {
  const fwd = message.fwdFrom;
  if (!fwd) return undefined;

  let fromName: string | undefined = fwd.fromName || undefined;
  let fromId: string | undefined;

  if (fwd.fromId) {
    if (fwd.fromId instanceof Api.PeerUser) {
      fromId = fwd.fromId.userId.toString();
    } else if (fwd.fromId instanceof Api.PeerChannel) {
      fromId = (-BigInt("1000000000000") - BigInt(fwd.fromId.channelId.toString())).toString();
    } else if (fwd.fromId instanceof Api.PeerChat) {
      fromId = (-BigInt(fwd.fromId.chatId.toString())).toString();
    }
  }

  return {
    fromName: fromName || "Forwarded",
    fromId,
    date: fwd.date ? new Date(fwd.date * 1000) : undefined,
  };
}

function extractWebPage(message: Api.Message): WebPagePreview | undefined {
  const media = message.media;
  if (!media || !(media instanceof Api.MessageMediaWebPage)) return undefined;
  const wp = media.webpage;
  if (!wp || !(wp instanceof Api.WebPage)) return undefined;

  return {
    url: wp.url,
    siteName: wp.siteName || undefined,
    title: wp.title || undefined,
    description: wp.description || undefined,
  };
}

function extractReactions(message: Api.Message): TelegramReaction[] | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reactions = (message as any).reactions;
  if (!reactions || !reactions.results) return undefined;

  const result: TelegramReaction[] = [];
  for (const r of reactions.results) {
    const reaction = r.reaction;
    if (reaction && "emoticon" in reaction) {
      result.push({
        emoji: reaction.emoticon,
        count: r.count || 0,
        isChosen: r.chosen || false,
      });
    }
  }
  return result.length > 0 ? result : undefined;
}

function extractSenderName(message: Api.Message): string | undefined {
  if (!message.fromId) return undefined;
  if (message.fromId instanceof Api.PeerUser) {
    const sender = (message as unknown as { _sender?: Api.User })._sender;
    if (sender) {
      const first = sender.firstName || "";
      const last = sender.lastName || "";
      return (first + " " + last).trim() || sender.username || undefined;
    }
  }
  return undefined;
}

export async function getMessages(
  client: TelegramClient,
  chatId: string,
  limit = 50,
  offsetId?: number
): Promise<TelegramMessage[]> {
  await rateLimiter.throttle("getMessages", 500);

  const messages = await callWithFloodWait(() =>
    client.getMessages(chatId, {
      limit,
      offsetId,
    })
  );

  return messages
    .filter((msg): msg is Api.Message => msg instanceof Api.Message)
    .map((msg) => {
      // Extract reply-to preview
      let replyToText: string | undefined;
      let replyToSenderName: string | undefined;
      if (msg.replyTo?.replyToMsgId) {
        const replyMsg = messages.find(
          (m) => m instanceof Api.Message && m.id === msg.replyTo?.replyToMsgId
        );
        if (replyMsg && replyMsg instanceof Api.Message) {
          replyToText = replyMsg.message || "";
          replyToSenderName = extractSenderName(replyMsg);
        }
      }

      // Extract comments count for channel posts
      let commentsCount: number | undefined;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const replies = (msg as any).replies;
      if (replies && replies.comments) {
        commentsCount = replies.replies || 0;
      }

      return {
        id: msg.id,
        chatId,
        senderId: msg.fromId
          ? (msg.fromId as Api.PeerUser).userId?.toString()
          : undefined,
        senderName: extractSenderName(msg),
        text: msg.message || "",
        date: new Date((msg.date || 0) * 1000),
        isOutgoing: msg.out || false,
        replyToId: msg.replyTo?.replyToMsgId,
        replyToText,
        replyToSenderName,
        media: extractMedia(msg),
        isEdited: !!msg.editDate,
        isPinned: msg.pinned || false,
        reactions: extractReactions(msg),
        commentsCount,
        views: msg.views,
        groupedId: msg.groupedId?.toString(),
        entities: extractEntities(msg),
        forwardFrom: extractForwardInfo(msg),
        webPage: extractWebPage(msg),
      };
    });
}

export async function sendMessage(
  client: TelegramClient,
  chatId: string,
  text: string,
  replyToId?: number
) {
  await rateLimiter.throttle("sendMessage", 300);

  return callWithFloodWait(() =>
    client.sendMessage(chatId, {
      message: text,
      replyTo: replyToId,
    })
  );
}

export async function editMessage(
  client: TelegramClient,
  chatId: string,
  messageId: number,
  text: string
) {
  await rateLimiter.throttle("editMessage", 500);

  return callWithFloodWait(() =>
    client.invoke(
      new Api.messages.EditMessage({
        peer: chatId,
        id: messageId,
        message: text,
      })
    )
  );
}

export async function deleteMessages(
  client: TelegramClient,
  chatId: string,
  messageIds: number[],
  revoke = true
) {
  await rateLimiter.throttle("deleteMessages", 500);

  const peer = await client.getInputEntity(chatId);
  return callWithFloodWait(() =>
    client.invoke(
      new Api.messages.DeleteMessages({
        id: messageIds,
        revoke,
      })
    )
  );
}
