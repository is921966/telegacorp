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
/** Chats loaded with "around" mode — skip stale detection for these because
 *  the loaded messages are intentionally from the middle of history. */
const loadedWithAround = new Set<string>();

export type LoadMode = "bottom" | "around" | "older" | "newer";

export function useMessages(chatId: string | null) {
  const { client, isConnected } = useTelegramClient();
  const {
    messagesByChat,
    isLoading,
    hasMore,
    hasNewer,
    setMessages,
    addMessage,
    prependMessages,
    appendMessages,
    updateMessage,
    deleteMessages: removeMessages,
    setLoading,
    setHasMore,
    setHasNewer,
  } = useMessagesStore();

  const messages = chatId ? messagesByChat[chatId] || [] : [];
  const chatHasNewer = hasNewer[chatId || ""] ?? false;

  // Prevent concurrent initial loads for the same chat
  const loadingChatRef = useRef<string | null>(null);

  /**
   * Load messages with different strategies:
   * - "bottom": load latest messages (default, current behavior)
   * - "around": load around a target ID (for jumping to unread)
   * - "older": load older messages (scroll up pagination)
   * - "newer": load newer messages (scroll down pagination)
   */
  const loadMessages = useCallback(
    async (mode: LoadMode = "bottom", anchorId?: number) => {
      if (!client || !isConnected || !chatId) return;

      // Guard against concurrent initial loads
      if ((mode === "bottom" || mode === "around") && loadingChatRef.current === chatId) return;
      if (mode === "bottom" || mode === "around") loadingChatRef.current = chatId;

      setLoading(true);
      try {
        if (mode === "bottom") {
          const { getMessages } = await import("@/lib/telegram/messages");
          const result = await getMessages(client, chatId, 50);
          setMessages(chatId, result);
          setHasMore(chatId, result.length >= 50);
          setHasNewer(chatId, false);
          loadedThisSession.add(chatId);
          loadedWithAround.delete(chatId);
        } else if (mode === "around" && anchorId) {
          // Clear stale cached messages so the initial scroll-to-divider in
          // MessageList fires AFTER fresh data arrives (not on stale cache).
          setMessages(chatId, []);
          setLoading(true);
          const { getMessagesAround } = await import("@/lib/telegram/messages");
          const result = await getMessagesAround(client, chatId, anchorId, 50);
          setMessages(chatId, result);
          setHasMore(chatId, result.length >= 25); // loaded around center
          setHasNewer(chatId, true); // there may be newer messages
          loadedThisSession.add(chatId);
          loadedWithAround.add(chatId);
        } else if (mode === "older" && anchorId) {
          const { getMessages } = await import("@/lib/telegram/messages");
          const result = await getMessages(client, chatId, 50, anchorId);
          prependMessages(chatId, result);
          setHasMore(chatId, result.length >= 50);
        } else if (mode === "newer" && anchorId) {
          const { getNewerMessages } = await import("@/lib/telegram/messages");
          const result = await getNewerMessages(client, chatId, anchorId, 50);
          appendMessages(chatId, result);
          setHasNewer(chatId, result.length >= 50);
        }
      } catch (err) {
        console.error("Failed to load messages for chat", chatId, err);
      } finally {
        setLoading(false);
        if (mode === "bottom" || mode === "around") loadingChatRef.current = null;
      }
    },
    [client, isConnected, chatId, setMessages, prependMessages, appendMessages, setLoading, setHasMore, setHasNewer]
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

  /** Load older messages (scroll up pagination) */
  const loadMore = useCallback(() => {
    if (messages.length > 0 && hasMore[chatId || ""]) {
      const oldestId = Math.min(...messages.map((m) => m.id));
      loadMessages("older", oldestId);
    }
  }, [messages, hasMore, chatId, loadMessages]);

  /** Load newer messages (scroll down pagination) */
  const loadNewer = useCallback(() => {
    if (messages.length > 0 && chatHasNewer) {
      const newestId = Math.max(...messages.map((m) => m.id));
      loadMessages("newer", newestId);
    }
  }, [messages, chatHasNewer, loadMessages]);

  /** Mark messages as read up to maxId (or all if not specified) */
  const markChatAsRead = useCallback(
    async (maxId?: number) => {
      if (!client || !chatId || !isConnected) return;
      try {
        // Capture current state BEFORE the API call
        const dialog = useChatsStore.getState().dialogs.find((d) => d.id === chatId);
        const oldReadMaxId = dialog?.readInboxMaxId ?? 0;
        const currentUnread = dialog?.unreadCount ?? 0;

        const { markAsRead } = await import("@/lib/telegram/dialogs");
        await markAsRead(client, chatId, maxId);

        if (maxId && maxId > 0) {
          // Count how many loaded messages were just marked as read
          // (between old readInboxMaxId and new maxId). Decrement the
          // current unread count by that amount — this is more accurate
          // than counting remaining loaded messages, because the server
          // may have many more unread messages beyond what's loaded.
          const stored = useMessagesStore.getState().messagesByChat[chatId] || [];
          const markedCount = stored.filter(
            (m) => !m.isOutgoing && m.id > oldReadMaxId && m.id <= maxId
          ).length;
          const newUnread = Math.max(0, currentUnread - markedCount);
          useChatsStore.getState().updateReadState(chatId, maxId, newUnread);
        } else {
          // maxId=0 or undefined: mark all as read
          useChatsStore.getState().updateReadState(chatId, 0);
        }
      } catch (err) {
        console.error("Failed to mark as read", chatId, err);
      }
    },
    [client, chatId, isConnected]
  );

  // When dialogs load, GramJS entity cache gets populated.
  // We subscribe to dialogs count so that failed message loads
  // (due to empty entity cache) get retried automatically.
  const dialogsCount = useChatsStore((s) => s.dialogs.length);

  // Targeted selector: only re-renders when THIS chat's loaded state changes
  // (avoids re-firing initial load when messages arrive for OTHER chats)
  const hasCachedMessages = useMessagesStore(
    (s) => chatId ? (s.messagesByChat[chatId]?.length ?? 0) > 0 : false
  );

  // Track the dialog's lastMessage timestamp for the current chat.
  // When periodic dialog sync updates this to a newer value than our
  // latest stored message, we know real-time events were missed.
  const dialogLastMsgTs = useChatsStore((s) => {
    if (!chatId) return 0;
    const dialog = s.dialogs.find((d) => d.id === chatId);
    if (!dialog?.lastMessage?.date) return 0;
    const d = dialog.lastMessage.date;
    return d instanceof Date ? d.getTime() : new Date(d).getTime();
  });

  // Track the latest stored message timestamp for the current chat.
  // Uses a targeted selector so we only re-render when this value changes.
  const latestStoredMsgTs = useMessagesStore((s) => {
    if (!chatId) return 0;
    const stored = s.messagesByChat[chatId];
    if (!stored || stored.length === 0) return 0;
    const d = stored[stored.length - 1].date;
    return d instanceof Date ? d.getTime() : new Date(d).getTime();
  });

  // Load messages when chat changes, client connects, or dialogs load.
  // Smart initial load: if chat has unread messages, load around the first
  // unread message; otherwise load from bottom as usual.
  useEffect(() => {
    if (!chatId || !isConnected) return;

    const loadedBefore = loadedThisSession.has(chatId);

    // Load if: never loaded this session, OR no cached messages at all
    if (!loadedBefore || !hasCachedMessages) {
      const dialog = useChatsStore.getState().dialogs.find((d) => d.id === chatId);

      if (dialog && dialog.unreadCount > 0 && dialog.readInboxMaxId) {
        loadMessages("around", dialog.readInboxMaxId + 1);
      } else {
        loadMessages("bottom");
      }
    }
  }, [chatId, isConnected, loadMessages, hasCachedMessages, dialogsCount]);

  // Stale message detection: when the dialog store reports a newer
  // lastMessage than our latest stored message, GramJS real-time events
  // were missed (e.g. _updateLoop timeout). Re-fetch to catch up.
  useEffect(() => {
    if (!chatId || !isConnected) return;
    if (!loadedThisSession.has(chatId)) return; // initial load handles this
    // Skip when loaded with "around" — messages are intentionally from the
    // middle of history, so the latest stored message is expected to be old.
    if (loadedWithAround.has(chatId)) return;
    if (latestStoredMsgTs <= 0 || dialogLastMsgTs <= 0) return;

    // Dialog has a message >2s newer than our latest — we're missing messages
    if (dialogLastMsgTs - latestStoredMsgTs > 2_000) {
      loadMessages("bottom");
    }
  }, [chatId, isConnected, dialogLastMsgTs, latestStoredMsgTs, loadMessages]);

  return {
    messages,
    isLoading,
    hasMore: hasMore[chatId || ""] ?? true,
    hasNewer: chatHasNewer,
    loadMessages,
    loadMore,
    loadNewer,
    send,
    edit,
    remove,
    markChatAsRead,
  };
}
