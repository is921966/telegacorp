"use client";

import { useEffect, useRef } from "react";
import { useMessagesStore } from "@/store/messages";
import { useChatsStore } from "@/store/chats";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import type { TelegramClient } from "telegram";
import type { TelegramDialog } from "@/types/telegram";

/**
 * Global real-time subscription hook.
 * Must be mounted once at the app shell level (ChatLayoutClient)
 * so that updates arrive regardless of which view is active.
 *
 * Uses a polling approach to detect the client singleton directly
 * instead of relying on useTelegramClient() which has async race
 * conditions between its local state and the auth store.
 */
export function useRealtimeUpdates() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const subscribedRef = useRef(false);
  const unsubscribersRef = useRef<Array<() => void>>([]);

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

    };

    trySubscribe();

    return () => {
      cancelled = true;
      for (const unsub of unsubscribersRef.current) {
        unsub();
      }
      unsubscribersRef.current = [];
      subscribedRef.current = false;
    };
  }, [isTelegramConnected]);
}
