import { memo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { TelegramDialog } from "@corp/shared";

interface ChatListItemProps {
  dialog: TelegramDialog;
  onPress: (id: string) => void;
  onLongPress?: (id: string) => void;
}

/**
 * Chat list item — renders a single dialog row.
 * Shows avatar placeholder, title, last message preview, time, unread badge.
 */
export const ChatListItem = memo(function ChatListItem({
  dialog,
  onPress,
  onLongPress,
}: ChatListItemProps) {
  const lastMsg = dialog.lastMessage;
  const hasUnread = dialog.unreadCount > 0;
  const timeString = lastMsg?.date ? formatTime(lastMsg.date) : "";

  // Message preview
  let preview = "";
  if (lastMsg) {
    if (lastMsg.mediaType && !lastMsg.text) {
      preview = mediaLabel(lastMsg.mediaType);
    } else {
      preview = lastMsg.text || "";
    }
    if (lastMsg.isOutgoing && preview) {
      preview = "Вы: " + preview;
    } else if (lastMsg.senderName && dialog.type !== "user") {
      preview = lastMsg.senderName.split(" ")[0] + ": " + preview;
    }
  }

  if (dialog.hasDraft && dialog.draftText) {
    preview = "Черновик: " + dialog.draftText;
  }

  // Avatar initials
  const initials = getInitials(dialog.title);
  const avatarColor = getAvatarColor(dialog.id);

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={() => onPress(dialog.id)}
      onLongPress={() => onLongPress?.(dialog.id)}
    >
      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
        <Text style={styles.avatarText}>{initials}</Text>
        {dialog.isOnline && <View style={styles.onlineDot} />}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            {dialog.isVerified && <Text style={styles.verified}>✓</Text>}
            {dialog.isMuted && <Text style={styles.muted}>🔇</Text>}
            <Text style={styles.title} numberOfLines={1}>
              {dialog.title}
            </Text>
          </View>
          <Text style={[styles.time, hasUnread && styles.timeUnread]}>
            {timeString}
          </Text>
        </View>

        <View style={styles.previewRow}>
          <Text
            style={[
              styles.preview,
              dialog.hasDraft && styles.previewDraft,
            ]}
            numberOfLines={1}
          >
            {preview || " "}
          </Text>

          {/* Badges */}
          <View style={styles.badges}>
            {dialog.isPinned && !hasUnread && (
              <Text style={styles.pin}>📌</Text>
            )}
            {hasUnread && (
              <View
                style={[
                  styles.unreadBadge,
                  dialog.isMuted && styles.unreadBadgeMuted,
                ]}
              >
                <Text style={styles.unreadText}>
                  {dialog.unreadCount > 999
                    ? "999+"
                    : dialog.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// ─── Helpers ──────────────────────────────────────────────────────────

function formatTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
  } else if (diffDays === 1) {
    return "Вчера";
  } else if (diffDays < 7) {
    return d.toLocaleDateString("ru", { weekday: "short" });
  } else {
    return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
  }
}

function mediaLabel(type: string): string {
  const labels: Record<string, string> = {
    photo: "📷 Фото",
    video: "🎬 Видео",
    document: "📎 Документ",
    voice: "🎤 Голосовое",
    sticker: "🏷 Стикер",
    gif: "GIF",
    audio: "🎵 Аудио",
    contact: "👤 Контакт",
    location: "📍 Геопозиция",
    poll: "📊 Опрос",
  };
  return labels[type] || "📎 Вложение";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
}

const AVATAR_COLORS = [
  "#F44336", "#E91E63", "#9C27B0", "#673AB7",
  "#3F51B5", "#2196F3", "#03A9F4", "#009688",
  "#4CAF50", "#FF9800", "#FF5722", "#795548",
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: "#fff",
  },
  pressed: {
    backgroundColor: "#f5f5f5",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 4,
    marginRight: 8,
  },
  verified: {
    fontSize: 12,
    color: "#2196F3",
  },
  muted: {
    fontSize: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1a1a2e",
    flex: 1,
  },
  time: {
    fontSize: 13,
    color: "#999",
  },
  timeUnread: {
    color: "#2196F3",
    fontWeight: "500",
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  preview: {
    fontSize: 14,
    color: "#666",
    flex: 1,
    marginRight: 8,
  },
  previewDraft: {
    color: "#d32f2f",
  },
  badges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pin: {
    fontSize: 12,
  },
  unreadBadge: {
    backgroundColor: "#2196F3",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  unreadBadgeMuted: {
    backgroundColor: "#999",
  },
  unreadText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
});
