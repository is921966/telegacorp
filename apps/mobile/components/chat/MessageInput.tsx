import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";

interface MessageInputProps {
  onSend: (text: string) => void;
  /** Reply context */
  replyTo?: { id: number; text: string; senderName?: string } | null;
  onCancelReply?: () => void;
  /** Edit mode */
  editMessage?: { id: number; text: string } | null;
  onCancelEdit?: () => void;
  isSending?: boolean;
  disabled?: boolean;
}

/**
 * Message input bar — text input + send button + reply/edit banners.
 */
export function MessageInput({
  onSend,
  replyTo,
  onCancelReply,
  editMessage,
  onCancelEdit,
  isSending,
  disabled,
}: MessageInputProps) {
  const [text, setText] = useState(editMessage?.text || "");
  const inputRef = useRef<TextInput>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  const canSend = text.trim().length > 0 && !isSending && !disabled;

  return (
    <View style={styles.container}>
      {/* Reply banner */}
      {replyTo && (
        <View style={styles.banner}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerLabel}>
              Ответ {replyTo.senderName ? `на ${replyTo.senderName}` : ""}
            </Text>
            <Text style={styles.bannerText} numberOfLines={1}>
              {replyTo.text || "Сообщение"}
            </Text>
          </View>
          <Pressable onPress={onCancelReply} style={styles.bannerClose}>
            <Text style={styles.bannerCloseText}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Edit banner */}
      {editMessage && (
        <View style={styles.banner}>
          <View style={styles.bannerContent}>
            <Text style={[styles.bannerLabel, styles.editLabel]}>
              Редактирование
            </Text>
            <Text style={styles.bannerText} numberOfLines={1}>
              {editMessage.text}
            </Text>
          </View>
          <Pressable onPress={onCancelEdit} style={styles.bannerClose}>
            <Text style={styles.bannerCloseText}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        {/* Attachment button */}
        <Pressable style={styles.iconButton} disabled={disabled}>
          <Text style={styles.iconText}>📎</Text>
        </Pressable>

        {/* Text input */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Сообщение..."
          placeholderTextColor="#999"
          multiline
          maxLength={4096}
          editable={!disabled}
          returnKeyType="default"
        />

        {/* Send button */}
        <Pressable
          style={[styles.sendButton, canSend && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendIcon}>➤</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
    backgroundColor: "#f8f8f8",
  },
  bannerContent: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: "#2196F3",
    paddingLeft: 8,
  },
  bannerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#2196F3",
  },
  editLabel: {
    color: "#FF9800",
  },
  bannerText: {
    fontSize: 13,
    color: "#666",
    marginTop: 1,
  },
  bannerClose: {
    padding: 8,
  },
  bannerCloseText: {
    fontSize: 16,
    color: "#999",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  iconText: {
    fontSize: 22,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 120,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    color: "#1a1a2e",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonActive: {
    backgroundColor: "#2196F3",
  },
  sendIcon: {
    fontSize: 18,
    color: "#fff",
  },
});
