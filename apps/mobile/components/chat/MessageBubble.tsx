import { memo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { TelegramMessage } from "@corp/shared";

interface MessageBubbleProps {
  message: TelegramMessage;
  /** Whether to show sender name (in group chats) */
  showSender?: boolean;
  onLongPress?: (message: TelegramMessage) => void;
  onReplyPress?: (replyToId: number) => void;
}

/**
 * Message bubble — renders a single chat message.
 * Incoming messages left-aligned, outgoing right-aligned.
 * Supports: text, reply preview, media placeholder, reactions, read checks.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  showSender,
  onLongPress,
  onReplyPress,
}: MessageBubbleProps) {
  const isOut = message.isOutgoing;
  const timeStr = formatMessageTime(message.date);

  return (
    <Pressable
      style={[styles.row, isOut && styles.rowOut]}
      onLongPress={() => onLongPress?.(message)}
      delayLongPress={300}
    >
      <View style={[styles.bubble, isOut ? styles.bubbleOut : styles.bubbleIn]}>
        {/* Sender name in groups */}
        {showSender && !isOut && message.senderName && (
          <Text style={styles.senderName}>{message.senderName}</Text>
        )}

        {/* Reply preview */}
        {message.replyToId && (
          <Pressable
            style={styles.replyPreview}
            onPress={() => onReplyPress?.(message.replyToId!)}
          >
            {message.replyToSenderName && (
              <Text style={styles.replySender} numberOfLines={1}>
                {message.replyToSenderName}
              </Text>
            )}
            <Text style={styles.replyText} numberOfLines={1}>
              {message.replyToText || "Сообщение"}
            </Text>
          </Pressable>
        )}

        {/* Forwarded */}
        {message.forwardFrom && (
          <View style={styles.forward}>
            <Text style={styles.forwardLabel}>
              Переслано от {message.forwardFrom.fromName || "неизвестного"}
            </Text>
          </View>
        )}

        {/* Media placeholder */}
        {message.media && (
          <View style={styles.mediaPlaceholder}>
            <Text style={styles.mediaIcon}>
              {mediaIcon(message.media.type)}
            </Text>
            <Text style={styles.mediaLabel}>
              {mediaLabel(message.media.type)}
              {message.media.fileName
                ? ` • ${message.media.fileName}`
                : ""}
            </Text>
          </View>
        )}

        {/* Message text with basic entity rendering */}
        {message.text ? (
          <Text style={[styles.text, isOut && styles.textOut]}>
            {message.text}
          </Text>
        ) : null}

        {/* Web page preview */}
        {message.webPage && (
          <View style={styles.webPreview}>
            {message.webPage.siteName && (
              <Text style={styles.webSite}>{message.webPage.siteName}</Text>
            )}
            {message.webPage.title && (
              <Text style={styles.webTitle} numberOfLines={2}>
                {message.webPage.title}
              </Text>
            )}
          </View>
        )}

        {/* Footer: time + edit + read status */}
        <View style={styles.footer}>
          {message.isEdited && (
            <Text style={styles.edited}>ред.</Text>
          )}
          <Text style={[styles.time, isOut && styles.timeOut]}>
            {timeStr}
          </Text>
          {isOut && (
            <Text style={styles.readCheck}>
              {message.id > 0 ? "✓✓" : "✓"}
            </Text>
          )}
        </View>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <View style={styles.reactions}>
            {message.reactions.map((r, i) => (
              <View
                key={i}
                style={[
                  styles.reaction,
                  r.isChosen && styles.reactionChosen,
                ]}
              >
                <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                <Text style={styles.reactionCount}>{r.count}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────

function formatMessageTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

function mediaIcon(type: string): string {
  const icons: Record<string, string> = {
    photo: "📷",
    video: "🎬",
    document: "📎",
    voice: "🎤",
    sticker: "🏷️",
  };
  return icons[type] || "📎";
}

function mediaLabel(type: string): string {
  const labels: Record<string, string> = {
    photo: "Фото",
    video: "Видео",
    document: "Документ",
    voice: "Голосовое",
    sticker: "Стикер",
  };
  return labels[type] || "Вложение";
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  rowOut: {
    justifyContent: "flex-end",
  },
  bubble: {
    maxWidth: "80%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  bubbleIn: {
    backgroundColor: "#f0f0f0",
    borderBottomLeftRadius: 4,
  },
  bubbleOut: {
    backgroundColor: "#DCF8C6",
    borderBottomRightRadius: 4,
  },
  senderName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2196F3",
    marginBottom: 2,
  },
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: "#2196F3",
    paddingLeft: 8,
    marginBottom: 4,
  },
  replySender: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2196F3",
  },
  replyText: {
    fontSize: 12,
    color: "#666",
  },
  forward: {
    marginBottom: 4,
  },
  forwardLabel: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#2196F3",
  },
  mediaPlaceholder: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 4,
  },
  mediaIcon: {
    fontSize: 20,
  },
  mediaLabel: {
    fontSize: 13,
    color: "#666",
    flex: 1,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
    color: "#1a1a2e",
  },
  textOut: {
    color: "#1a1a2e",
  },
  webPreview: {
    backgroundColor: "rgba(0,0,0,0.05)",
    borderLeftWidth: 2,
    borderLeftColor: "#2196F3",
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
  },
  webSite: {
    fontSize: 11,
    color: "#2196F3",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  webTitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1a1a2e",
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  edited: {
    fontSize: 11,
    color: "#999",
    fontStyle: "italic",
  },
  time: {
    fontSize: 11,
    color: "#999",
  },
  timeOut: {
    color: "#7cb342",
  },
  readCheck: {
    fontSize: 11,
    color: "#7cb342",
  },
  reactions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  reaction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  reactionChosen: {
    backgroundColor: "#E3F2FD",
    borderWidth: 1,
    borderColor: "#2196F3",
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: "#666",
  },
});
