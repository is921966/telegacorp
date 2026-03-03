"use client";

import { useEffect, useRef } from "react";
import { useMessagesStore } from "@/store/messages";
import { useChatsStore } from "@/store/chats";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
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

      // New messages — update both messages store and dialogs store
      unsubscribersRef.current.push(
        subscribeToNewMessages(client, (msg) => {
          useMessagesStore.getState().addMessage(msg.chatId, msg);

          // Update dialog in chat list: lastMessage + unreadCount + re-sort
          const mediaType = msg.media?.type as
            | NonNullable<NonNullable<TelegramDialog["lastMessage"]>["mediaType"]>
            | undefined;
          const isViewingChat =
            useUIStore.getState().selectedChatId === msg.chatId;

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
        })
      );

      // Edited messages
      unsubscribersRef.current.push(
        subscribeToEditedMessages(client, (msg) => {
          useMessagesStore
            .getState()
            .updateMessage(msg.chatId, msg.id, {
              text: msg.text,
              isEdited: true,
            });
        })
      );

      // Deleted messages
      unsubscribersRef.current.push(
        subscribeToDeletedMessages(client, (deletedChatId, ids) => {
          useMessagesStore.getState().deleteMessages(deletedChatId, ids);
        })
      );

      // --- Periodic dialog sync ---
      // GramJS _updateLoop can TIMEOUT periodically, causing missed events
      // for broadcast channels (and sometimes groups/private chats).
      // This timer fetches top dialogs every 60s and smart-merges them,
      // ensuring the chat list stays reasonably up to date even when
      // real-time events are lost.
      const capturedClient = client;
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
