import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import type { TelegramMedia } from "@corp/shared";

const MAX_MEDIA_WIDTH = Dimensions.get("window").width * 0.7;
const MAX_MEDIA_HEIGHT = 300;

interface MediaMessageProps {
  media: TelegramMedia;
  chatId: string;
  messageId: number;
  /** Base64 data URL of thumbnail (if available from cache) */
  thumbnailUri?: string | null;
  onPress?: () => void;
}

/**
 * Media message component — renders photo/video/document/voice media.
 * Photos show thumbnail with tap-to-view-full.
 * Videos show thumbnail with play icon overlay.
 * Documents show file info with download indicator.
 * Voice shows a waveform placeholder with duration.
 */
export function MediaMessage({
  media,
  chatId,
  messageId,
  thumbnailUri,
  onPress,
}: MediaMessageProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Calculate display dimensions
  const displayWidth = Math.min(
    media.width || MAX_MEDIA_WIDTH,
    MAX_MEDIA_WIDTH
  );
  const aspectRatio =
    media.width && media.height ? media.width / media.height : 4 / 3;
  const displayHeight = Math.min(
    displayWidth / aspectRatio,
    MAX_MEDIA_HEIGHT
  );

  if (media.type === "photo") {
    return (
      <Pressable onPress={onPress} style={styles.mediaContainer}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={[
              styles.image,
              { width: displayWidth, height: displayHeight },
            ]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.placeholder,
              { width: displayWidth, height: displayHeight },
            ]}
          >
            <ActivityIndicator size="small" color="#fff" />
          </View>
        )}
      </Pressable>
    );
  }

  if (media.type === "video") {
    const durationStr = media.duration
      ? formatDuration(media.duration)
      : "";

    return (
      <Pressable onPress={onPress} style={styles.mediaContainer}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={[
              styles.image,
              { width: displayWidth, height: displayHeight },
            ]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.placeholder,
              { width: displayWidth, height: displayHeight },
            ]}
          >
            <Text style={styles.placeholderIcon}>🎬</Text>
          </View>
        )}
        {/* Play overlay */}
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
          {durationStr && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{durationStr}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  if (media.type === "document") {
    const sizeStr = media.size ? formatFileSize(media.size) : "";

    return (
      <Pressable
        onPress={onPress}
        style={[styles.documentContainer, isLoading && styles.documentLoading]}
      >
        <View style={styles.docIcon}>
          <Text style={styles.docIconText}>📄</Text>
        </View>
        <View style={styles.docInfo}>
          <Text style={styles.docName} numberOfLines={1}>
            {media.fileName || "Документ"}
          </Text>
          <Text style={styles.docMeta}>
            {[sizeStr, media.mimeType].filter(Boolean).join(" • ")}
          </Text>
        </View>
        {isLoading ? (
          <ActivityIndicator size="small" color="#2196F3" />
        ) : (
          <Text style={styles.downloadIcon}>⬇</Text>
        )}
      </Pressable>
    );
  }

  if (media.type === "voice") {
    const durationStr = media.duration
      ? formatDuration(media.duration)
      : "0:00";

    return (
      <Pressable onPress={onPress} style={styles.voiceContainer}>
        <View style={styles.voicePlayBtn}>
          <Text style={styles.voicePlayIcon}>▶</Text>
        </View>
        <View style={styles.voiceWaveform}>
          {/* Simple waveform placeholder */}
          {Array.from({ length: 20 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                { height: 6 + Math.random() * 16 },
              ]}
            />
          ))}
        </View>
        <Text style={styles.voiceDuration}>{durationStr}</Text>
      </Pressable>
    );
  }

  if (media.type === "sticker") {
    return (
      <View style={styles.stickerContainer}>
        {thumbnailUri ? (
          <Image
            source={{ uri: thumbnailUri }}
            style={styles.sticker}
            resizeMode="contain"
          />
        ) : (
          <Text style={styles.stickerPlaceholder}>🏷️</Text>
        )}
      </View>
    );
  }

  // Fallback for unknown types
  return (
    <View style={styles.documentContainer}>
      <Text style={styles.docIconText}>📎</Text>
      <Text style={styles.docName}>Вложение</Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  mediaContainer: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  image: {
    borderRadius: 12,
  },
  placeholder: {
    backgroundColor: "#e0e0e0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    fontSize: 32,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    color: "#fff",
    fontSize: 20,
    marginLeft: 3,
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  documentContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: 10,
    padding: 10,
    gap: 10,
    minWidth: 200,
  },
  documentLoading: {
    opacity: 0.7,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
  },
  docIconText: {
    fontSize: 20,
  },
  docInfo: {
    flex: 1,
    gap: 2,
  },
  docName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#1a1a2e",
  },
  docMeta: {
    fontSize: 12,
    color: "#999",
  },
  downloadIcon: {
    fontSize: 18,
    color: "#2196F3",
  },
  voiceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 200,
  },
  voicePlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
  },
  voicePlayIcon: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 2,
  },
  voiceWaveform: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 24,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: "#2196F3",
    opacity: 0.6,
  },
  voiceDuration: {
    fontSize: 12,
    color: "#999",
  },
  stickerContainer: {
    width: 160,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  sticker: {
    width: 160,
    height: 160,
  },
  stickerPlaceholder: {
    fontSize: 64,
  },
});
