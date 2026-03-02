"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMessagesStore } from "@/store/messages";
import { useChatsStore } from "@/store/chats";
import { useTelegramClient } from "./useTelegramClient";

/**
 * Track which chats have been loaded in THIS browser session.
 * Persisted store may have stale/empty data from a previous session —
 * we always want to fetch fresh messages at least once per session.
 */
const loadedThisSession = new Set<string>();

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

  // Prevent concurrent initial loads for the same chat
  const loadingChatRef = useRef<string | null>(null);

  const loadMessages = useCallback(
    async (offsetId?: number) => {
      if (!client || !isConnected || !chatId) return;

      // Guard against concurrent initial loads (not offset-based pagination)
      if (!offsetId && loadingChatRef.current === chatId) return;
      if (!offsetId) loadingChatRef.current = chatId;

      setLoading(true);
      try {
        const { getMessages } = await import("@/lib/telegram/messages");
        const result = await getMessages(client, chatId, 50, offsetId);

        if (offsetId) {
          prependMessages(chatId, result);
        } else {
          setMessages(chatId, result);
          loadedThisSession.add(chatId);
        }

        setHasMore(chatId, result.length >= 50);
      } catch (err) {
        console.error("Failed to load messages for chat", chatId, err);
      } finally {
        setLoading(false);
        if (!offsetId) loadingChatRef.current = null;
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

        // Bump dialog to top with our sent message
        useChatsStore.getState().bumpDialog(
          chatId,
          {
            text: msg.text || "",
            date: msg.date instanceof Date ? msg.date : new Date(msg.date),
            senderId: msg.senderId,
            isOutgoing: true,
            isRead: false,
          },
          false
        );
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

  // When dialogs load, GramJS entity cache gets populated.
  // We subscribe to dialogs count so that failed message loads
  // (due to empty entity cache) get retried automatically.
  const dialogsCount = useChatsStore((s) => s.dialogs.length);

  // Load messages when chat changes, client connects, or dialogs load.
  // Always fetch fresh data at least once per session per chat,
  // regardless of what may be persisted in localStorage.
  useEffect(() => {
    if (!chatId || !isConnected) return;

    const hasCachedMessages = messagesByChat[chatId]?.length > 0;
    const loadedBefore = loadedThisSession.has(chatId);

    // Load if: never loaded this session, OR no cached messages at all
    if (!loadedBefore || !hasCachedMessages) {
      loadMessages();
    }
  }, [chatId, isConnected, loadMessages, messagesByChat, dialogsCount]);

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
