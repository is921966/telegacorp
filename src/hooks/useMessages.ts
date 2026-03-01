"use client";

import { useCallback, useEffect } from "react";
import { useMessagesStore } from "@/store/messages";
import { useTelegramClient } from "./useTelegramClient";

export function useMessages(chatId: string | null) {
  const { client, isConnected } = useTelegramClient();
  const {
    messagesByChat,
    isLoading,
    hasMore,
    setMessages,
    addMessage,
    prependMessages,
    updateMessage,
    deleteMessages: removeMessages,
    setLoading,
    setHasMore,
  } = useMessagesStore();

  const messages = chatId ? messagesByChat[chatId] || [] : [];

  const loadMessages = useCallback(
    async (offsetId?: number) => {
      if (!client || !isConnected || !chatId) return;

      setLoading(true);
      try {
        const { getMessages } = await import("@/lib/telegram/messages");
        const result = await getMessages(client, chatId, 50, offsetId);

        if (offsetId) {
          prependMessages(chatId, result);
        } else {
          setMessages(chatId, result);
        }

        setHasMore(chatId, result.length >= 50);
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoading(false);
      }
    },
    [client, isConnected, chatId, setMessages, prependMessages, setLoading, setHasMore]
  );

  const send = useCallback(
    async (text: string, replyToId?: number) => {
      if (!client || !chatId) return;

      const { sendMessage } = await import("@/lib/telegram/messages");
      const result = await sendMessage(client, chatId, text, replyToId);

      // Optimistically add the sent message to the store
      if (result && "id" in result) {
        const msg: import("@/types/telegram").TelegramMessage = {
          id: result.id,
          chatId,
          senderId: result.fromId
            ? (result.fromId as { userId?: { toString(): string } }).userId?.toString()
            : undefined,
          text: (result as { message?: string }).message || text,
          date: new Date(
            typeof result.date === "number" && result.date > 0
              ? result.date * 1000
              : Date.now()
          ),
          isOutgoing: true,
          replyToId,
        };
        addMessage(chatId, msg);
      }
    },
    [client, chatId, addMessage]
  );

  const edit = useCallback(
    async (messageId: number, text: string) => {
      if (!client || !chatId) return;

      const { editMessage } = await import("@/lib/telegram/messages");
      await editMessage(client, chatId, messageId, text);
      updateMessage(chatId, messageId, { text, isEdited: true });
    },
    [client, chatId, updateMessage]
  );

  const remove = useCallback(
    async (messageIds: number[]) => {
      if (!client || !chatId) return;

      const { deleteMessages } = await import("@/lib/telegram/messages");
      await deleteMessages(client, chatId, messageIds);
      removeMessages(chatId, messageIds);
    },
    [client, chatId, removeMessages]
  );

  const loadMore = useCallback(() => {
    if (messages.length > 0 && hasMore[chatId || ""]) {
      loadMessages(messages[0].id);
    }
  }, [messages, hasMore, chatId, loadMessages]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!client || !isConnected) return;

    let cleanup = false;
    const unsubscribers: Array<() => void> = [];

    import("@/lib/telegram/updates").then(
      ({ subscribeToNewMessages, subscribeToEditedMessages, subscribeToDeletedMessages }) => {
        if (cleanup) return;

        unsubscribers.push(
          subscribeToNewMessages(client, (msg) => {
            addMessage(msg.chatId, msg);
          })
        );

        unsubscribers.push(
          subscribeToEditedMessages(client, (msg) => {
            updateMessage(msg.chatId, msg.id, { text: msg.text, isEdited: true });
          })
        );

        unsubscribers.push(
          subscribeToDeletedMessages(client, (deletedChatId, ids) => {
            removeMessages(deletedChatId, ids);
          })
        );
      }
    );

    return () => {
      cleanup = true;
      // Remove all event handlers from the client to prevent handler leak
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [client, isConnected, addMessage, updateMessage, removeMessages]);

  // Load messages when chat changes
  useEffect(() => {
    if (chatId && isConnected && !messagesByChat[chatId]) {
      loadMessages();
    }
  }, [chatId, isConnected, messagesByChat, loadMessages]);

  return {
    messages,
    isLoading,
    hasMore: hasMore[chatId || ""] ?? true,
    loadMessages,
    loadMore,
    send,
    edit,
    remove,
  };
}
