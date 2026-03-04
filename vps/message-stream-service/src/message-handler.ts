import { Api } from "telegram";
import type { StreamMessage } from "./stream-publisher";

/**
 * Normalize a GramJS message into a StreamMessage for Redis.
 */
export function normalizeMessage(
  message: Api.Message,
  chatId: bigint | number
): StreamMessage {
  const senderId = message.senderId
    ? String(message.senderId)
    : "";

  // Extract sender name from message entities if available
  const senderName = extractSenderName(message);

  // Detect media type
  const mediaType = detectMediaType(message.media);

  // Reply reference
  const replyToMsgId = message.replyTo?.replyToMsgId
    ? String(message.replyTo.replyToMsgId)
    : null;

  // Forward info
  const forwardFrom = message.fwdFrom
    ? extractForwardSource(message.fwdFrom)
    : null;

  return {
    chat_id: String(chatId),
    message_id: String(message.id),
    sender_id: senderId,
    sender_name: senderName,
    text: message.message ?? "",
    date: new Date((message.date ?? 0) * 1000).toISOString(),
    media_type: mediaType,
    reply_to_msg_id: replyToMsgId,
    forward_from: forwardFrom,
    is_edit: !!message.editDate,
    raw_entities: JSON.stringify(message.entities ?? []),
  };
}

/**
 * Extract sender display name from message.
 */
function extractSenderName(message: Api.Message): string {
  // If the message has a post author (channel posts)
  if (message.postAuthor) {
    return message.postAuthor;
  }

  // The sender entity might not be cached — return ID-based fallback
  return "";
}

/**
 * Detect media type from message media.
 */
function detectMediaType(
  media: Api.TypeMessageMedia | undefined
): string | null {
  if (!media) return null;

  if (media instanceof Api.MessageMediaPhoto) return "photo";
  if (media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    if (doc instanceof Api.Document) {
      // Check MIME type
      const mime = doc.mimeType ?? "";
      if (mime.startsWith("video/")) return "video";
      if (mime.startsWith("audio/")) {
        // Check for voice message attribute
        const isVoice = doc.attributes?.some(
          (a) => a instanceof Api.DocumentAttributeAudio && a.voice
        );
        return isVoice ? "voice" : "audio";
      }
      if (mime === "image/webp" || mime === "application/x-tgsticker")
        return "sticker";
      if (mime.startsWith("image/")) return "photo";
      return "document";
    }
    return "document";
  }
  if (media instanceof Api.MessageMediaGeo) return "geo";
  if (media instanceof Api.MessageMediaContact) return "contact";
  if (media instanceof Api.MessageMediaPoll) return "poll";
  if (media instanceof Api.MessageMediaWebPage) return "webpage";
  if (media instanceof Api.MessageMediaVenue) return "venue";

  return "other";
}

/**
 * Extract forward source info.
 */
function extractForwardSource(
  fwdFrom: Api.MessageFwdHeader
): string {
  if (fwdFrom.fromName) return fwdFrom.fromName;
  if (fwdFrom.fromId) return String(fwdFrom.fromId);
  return "unknown";
}

/**
 * Check if a message should be processed (not service, has content).
 */
export function shouldProcess(message: Api.Message): boolean {
  // Skip empty messages
  if (!message.message && !message.media) return false;

  // Skip service messages (join, leave, etc.)
  if (message.action) return false;

  return true;
}
