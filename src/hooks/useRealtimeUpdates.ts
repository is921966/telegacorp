"use client";

import { useEffect, useRef } from "react";
import { useMessagesStore } from "@/store/messages";
import { useChatsStore } from "@/store/chats";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { useTopicsStore } from "@/store/topics";
import type { TelegramClient } from "telegram";
import type { TelegramDialog } from "@/types/telegram";

/**
 * Periodic dialog sync interval.
 * GramJS's _updateLoop can timeout, causing missed real-time events
 * (especially for broadcast channels). This periodic sync acts as a
 * catch-up mechanism: it fetches top dialogs from the API and smart-merges
 * them with the store, preserving any newer local data from real-time events.
 */
const DIALOG_SYNC_INTERVAL_MS = 60_000; // 60 seconds
const DIALOG_SYNC_BATCH_SIZE = 100; // Top 100 dialogs per sync

/**
 * Global real-time subscription hook.
 * Must be mounted once at the app shell level (ChatLayoutClient)
 * so that updates arrive regardless of which view is active.
 *
 * Combines two strategies for reliable updates:
 * 1. GramJS event handlers (NewMessage, Raw) for instant real-time delivery
 * 2. Periodic dialog sync (every 60s) to catch up on events missed due to
 *    GramJS TIMEOUT errors in _updateLoop
 *
 * Uses a polling approach to detect the client singleton directly
 * instead of relying on useTelegramClient() which has async race
 * conditions between its local state and the auth store.
 */
export function useRealtimeUpdates() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const subscribedRef = useRef(false);
  const unsubscribersRef = useRef<Array<() => void>>([]);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Main subscription effect — triggered when isTelegramConnected becomes true
  useEffect(() => {
    if (!isTelegramConnected) return;

    let cancelled = false;

    const trySubscribe = async () => {
      // Get client singleton directly (bypasses useTelegramClient's async local state)
      const { getExistingClient } = await import("@/lib/telegram/client");
      let client: TelegramClient | null = getExistingClient();

      // If client isn't available yet, retry a few times with short delay
      // (covers race between TelegramSessionProvider setting isTelegramConnected
      // and the client singleton being fully available)
      if (!client) {
        for (let attempt = 0; attempt < 10; attempt++) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 500));
          client = getExistingClient();
          if (client) break;
        }
      }

      if (!client || cancelled) return;
      if (subscribedRef.current) return; // already subscribed

      // Wait for dialogs to be loaded (at least the initial batch)
      // so that bumpDialog can find the target dialog for incoming events.
      // Without this, events arriving before dialogs load are silently dropped.
      for (let attempt = 0; attempt < 30; attempt++) {
        if (cancelled) return;
        if (useChatsStore.getState().dialogs.length > 0) break;
        await new Promise((r) => setTimeout(r, 500));
      }

      if (cancelled) return;
      subscribedRef.current = true;

      const {
        subscribeToNewMessages,
        subscribeToEditedMessages,
        subscribeToDeletedMessages,
      } = await import("@/lib/telegram/updates");

      if (cancelled) {
        subscribedRef.current = false;
        return;
      }

      // Capture client for use in async callbacks
      const capturedClient = client;

      // Throttled markAsRead for incoming messages while viewing chat
      let markAsReadTimer: ReturnType<typeof setTimeout> | null = null;
      let pendingMarkReadChatId: string | null = null;
      let pendingMarkReadMaxId = 0;

      const flushMarkAsRead = async () => {
        if (cancelled) return;
        if (!pendingMarkReadChatId || pendingMarkReadMaxId <= 0) return;
        const chatIdToMark = pendingMarkReadChatId;
        const maxIdToMark = pendingMarkReadMaxId;
        pendingMarkReadChatId = null;
        pendingMarkReadMaxId = 0;
        try {
          const { markAsRead } = await import("@/lib/telegram/dialogs");
          await markAsRead(capturedClient, chatIdToMark, maxIdToMark);
          if (!cancelled) {
            useChatsStore.getState().updateReadState(chatIdToMark, maxIdToMark);
          }
        } catch {
          // Non-critical: next scroll or periodic sync will catch up
        }
      };

      // New messages — update messages store, dialogs store, and topics store
      unsubscribersRef.current.push(
        subscribeToNewMessages(client, (msg) => {
          const uiState = useUIStore.getState();
          const isViewingChat = uiState.selectedChatId === msg.chatId;
          const topicId = msg.forumTopicId;

          // Add to regular chat store key
          useMessagesStore.getState().addMessage(msg.chatId, msg);

          // If message belongs to a forum topic, also add to composite topic key
          // so that an open topic view receives it in real-time
          if (topicId) {
            const topicStoreKey = `${msg.chatId}:topic:${topicId}`;
            useMessagesStore.getState().addMessage(topicStoreKey, msg);

            // Update topic in topics store (last message + unread count)
            const topicsState = useTopicsStore.getState();
            const isViewingTopic =
              isViewingChat && uiState.selectedTopicId === topicId;

            topicsState.updateTopicLastMessage(msg.chatId, topicId, {
              text: msg.text || "",
              date: msg.date instanceof Date ? msg.date : new Date(msg.date),
              senderId: msg.senderId,
              senderName: msg.senderName,
              isOutgoing: msg.isOutgoing || false,
            });

            // Increment topic unread if not currently viewing this topic
            if (!msg.isOutgoing && !isViewingTopic) {
              const topics = topicsState.topicsByChat[msg.chatId];
              const topic = topics?.find((t) => t.id === topicId);
              if (topic) {
                topicsState.updateTopicUnread(
                  msg.chatId,
                  topicId,
                  topic.unreadCount + 1
                );
              }
            }
          }

          // Update dialog in chat list: lastMessage + unreadCount + re-sort
          const mediaType = msg.media?.type as
            | NonNullable<NonNullable<TelegramDialog["lastMessage"]>["mediaType"]>
            | undefined;

          useChatsStore.getState().bumpDialog(
            msg.chatId,
            {
              text: msg.text || "",
              date:
                msg.date instanceof Date ? msg.date : new Date(msg.date),
              senderId: msg.senderId,
              senderName: msg.senderName,
              isOutgoing: msg.isOutgoing || false,
              isRead: msg.isOutgoing || isViewingChat,
              mediaType,
              mediaFileName: msg.media?.fileName,
            },
            // Increment unread only for incoming messages when NOT viewing that chat
            !msg.isOutgoing && !isViewingChat
          );

          // Auto-mark as read when viewing the chat (throttled)
          if (isViewingChat && !msg.isOutgoing) {
            pendingMarkReadChatId = msg.chatId;
            pendingMarkReadMaxId = Math.max(pendingMarkReadMaxId, msg.id);
            if (markAsReadTimer) clearTimeout(markAsReadTimer);
            markAsReadTimer = setTimeout(flushMarkAsRead, 500);
          }
        })
      );

      // Cleanup markAsRead timer on unsubscribe
      unsubscribersRef.current.push(() => {
        if (markAsReadTimer) {
          clearTimeout(markAsReadTimer);
          markAsReadTimer = null;
        }
      });

      // Edited messages
      unsubscribersRef.current.push(
        subscribeToEditedMessages(client, (msg) => {
          useMessagesStore
            .getState()
            .updateMessage(msg.chatId, msg.id, {
              text: msg.text,
              isEdited: true,
            });
          // Also update in topic store key if applicable
          if (msg.forumTopicId) {
            const topicStoreKey = `${msg.chatId}:topic:${msg.forumTopicId}`;
            useMessagesStore
              .getState()
              .updateMessage(topicStoreKey, msg.id, {
                text: msg.text,
                isEdited: true,
              });
          }
        })
      );

      // Deleted messages
      unsubscribersRef.current.push(
        subscribeToDeletedMessages(client, (deletedChatId, ids) => {
          useMessagesStore.getState().deleteMessages(deletedChatId, ids);
          // Note: deleteMessages with unknown chatId iterates all keys,
          // so topic composite keys are also covered automatically.
        })
      );

      // --- Periodic dialog sync ---
      // GramJS _updateLoop can TIMEOUT periodically, causing missed events
      // for broadcast channels (and sometimes groups/private chats).
      // This timer fetches top dialogs every 60s and smart-merges them,
      // ensuring the chat list stays reasonably up to date even when
      // real-time events are lost.
      const runPeriodicSync = async () => {
        try {
          const { getDialogs } = await import("@/lib/telegram/dialogs");
          const fresh = await getDialogs(capturedClient, DIALOG_SYNC_BATCH_SIZE);
          if (fresh.length > 0) {
            // Use syncDialogs (not mergeDialogs) — updates existing dialogs
            // in-place without removing those outside the top-100 batch
            useChatsStore.getState().syncDialogs(fresh);
          }
        } catch {
          // Non-critical: sync will retry on next interval
        }
      };

      syncIntervalRef.current = setInterval(runPeriodicSync, DIALOG_SYNC_INTERVAL_MS);

      // Background media prefetch — start after subscriptions are ready
      const { initPrefetchManager } = await import("@/lib/prefetch-manager");
      const cleanupPrefetch = initPrefetchManager();
      unsubscribersRef.current.push(cleanupPrefetch);
    };

    trySubscribe();

    return () => {
      cancelled = true;
      for (const unsub of unsubscribersRef.current) {
        unsub();
      }
      unsubscribersRef.current = [];
      subscribedRef.current = false;

      // Clear periodic sync
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [isTelegramConnected]);
}
