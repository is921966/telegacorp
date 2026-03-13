import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { useLocalSearchParams, Stack } from "expo-router";
import {
  useMessages,
  useChatsStore,
  type TelegramMessage,
} from "@corp/shared";
import { MessageBubble } from "../../components/chat/MessageBubble";
import { MessageInput } from "../../components/chat/MessageInput";
import { DaySeparator } from "../../components/chat/DaySeparator";

type ListItem =
  | { type: "message"; data: TelegramMessage }
  | { type: "date"; date: string };

/**
 * Chat view — shows messages for a single chat.
 * Inverted FlashList with newest messages at the bottom.
 * Supports: scroll-to-load-older, reply context, day separators.
 */
export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { messages, isLoading, hasMore, loadMessages } = useMessages(
    chatId || null
  );

  // Get dialog info for header
  const dialog = useChatsStore((s) =>
    s.dialogs.find((d) => d.id === chatId)
  );

  const [replyTo, setReplyTo] = useState<{
    id: number;
    text: string;
    senderName?: string;
  } | null>(null);

  const listRef = useRef<FlashListRef<ListItem>>(null);

  // ── Build list items with day separators ──
  const listItems = useMemo(() => {
    if (!messages.length) return [];

    // Messages are newest-first from store, but we render inverted
    // so we need oldest-first for day separators to work correctly
    const sorted = [...messages].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const items: ListItem[] = [];
    let lastDateStr = "";

    for (const msg of sorted) {
      const dateStr = formatDate(msg.date);
      if (dateStr !== lastDateStr) {
        items.push({ type: "date", date: dateStr });
        lastDateStr = dateStr;
      }
      items.push({ type: "message", data: msg });
    }

    // Reverse for inverted list (newest at bottom = first in inverted array)
    return items.reverse();
  }, [messages]);

  // ── Load older messages on scroll to top ──
  const handleLoadOlder = useCallback(() => {
    if (hasMore && !isLoading && messages.length > 0) {
      const oldest = messages.reduce((min, m) =>
        new Date(m.date).getTime() < new Date(min.date).getTime() ? m : min
      );
      loadMessages("older", oldest.id);
    }
  }, [hasMore, isLoading, messages, loadMessages]);

  // ── Send message ──
  const handleSend = useCallback(
    async (text: string) => {
      if (!chatId) return;

      try {
        const { sendMessage } = await import("@corp/shared/telegram/messages");
        const { getExistingClient } = await import("@corp/shared");
        const client = getExistingClient();
        if (!client) return;

        await sendMessage(client, chatId, text, replyTo?.id);
        setReplyTo(null);

        // Refresh messages
        loadMessages("bottom");
      } catch (err) {
        console.error("[Chat] Send error:", err);
      }
    },
    [chatId, replyTo, loadMessages]
  );

  // ── Long press → set reply ──
  const handleLongPress = useCallback((message: TelegramMessage) => {
    setReplyTo({
      id: message.id,
      text: message.text || "Сообщение",
      senderName: message.senderName,
    });
  }, []);

  // ── Header title ──
  const chatTitle = dialog?.title || "Чат";
  const isGroup = dialog?.type === "group" || dialog?.type === "channel";

  // ── Loading state ──
  if (isLoading && messages.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: chatTitle }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Загрузка сообщений...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: chatTitle,
          headerBackTitle: "Назад",
        }}
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {/* Messages list (inverted) */}
        <FlashList
          ref={listRef}
          data={listItems}
          keyExtractor={(item, index) =>
            item.type === "message"
              ? `msg-${item.data.id}`
              : `date-${item.date}-${index}`
          }
          renderItem={({ item }) => {
            if (item.type === "date") {
              return <DaySeparator date={item.date} />;
            }
            return (
              <MessageBubble
                message={item.data}
                showSender={isGroup}
                onLongPress={handleLongPress}
              />
            );
          }}
          inverted
          onEndReached={handleLoadOlder}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isLoading ? (
              <View style={styles.footer}>
                <ActivityIndicator size="small" color="#2196F3" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Нет сообщений</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />

        {/* Input bar */}
        <MessageInput
          onSend={handleSend}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDate(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  return d.toLocaleDateString("ru", {
    day: "numeric",
    month: "long",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  listContent: {
    paddingVertical: 8,
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 60,
    alignItems: "center",
    // Inverted, so this shows at bottom
    transform: [{ scaleY: -1 }],
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
});
