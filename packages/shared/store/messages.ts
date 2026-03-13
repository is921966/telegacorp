import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TelegramMessage } from "../types/telegram";

/** Limit persisted data: max 50 messages per chat, max 20 chats */
const MAX_PERSISTED_CHATS = 20;
const MAX_PERSISTED_MESSAGES = 50;

function trimMessagesForPersist(
  messagesByChat: Record<string, TelegramMessage[]>
): Record<string, TelegramMessage[]> {
  const entries = Object.entries(messagesByChat);
  // Keep only the most recently active chats (last N entries)
  const trimmed = entries.slice(-MAX_PERSISTED_CHATS);
  const result: Record<string, TelegramMessage[]> = {};
  for (const [chatId, msgs] of trimmed) {
    result[chatId] = msgs.slice(-MAX_PERSISTED_MESSAGES);
  }
  return result;
}

interface MessagesStore {
  // Messages indexed by chatId
  messagesByChat: Record<string, TelegramMessage[]>;
  isLoading: boolean;
  hasMore: Record<string, boolean>;
  /** Whether there are newer messages to load (when loaded around a target) */
  hasNewer: Record<string, boolean>;

  setMessages: (chatId: string, messages: TelegramMessage[]) => void;
  addMessage: (chatId: string, message: TelegramMessage) => void;
  prependMessages: (chatId: string, messages: TelegramMessage[]) => void;
  /** Append newer messages to the end with deduplication */
  appendMessages: (chatId: string, messages: TelegramMessage[]) => void;
  updateMessage: (
    chatId: string,
    messageId: number,
    updates: Partial<TelegramMessage>
  ) => void;
  deleteMessages: (chatId: string, messageIds: number[]) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (chatId: string, hasMore: boolean) => void;
  setHasNewer: (chatId: string, hasNewer: boolean) => void;
  clearChat: (chatId: string) => void;
  reset: () => void;
}

export const useMessagesStore = create<MessagesStore>()(
  persist(
    (set) => ({
      messagesByChat: {},
      isLoading: false,
      hasMore: {},
      hasNewer: {},

      setMessages: (chatId, messages) =>
        set((state) => ({
          messagesByChat: { ...state.messagesByChat, [chatId]: messages },
          isLoading: false,
        })),

      addMessage: (chatId, message) =>
        set((state) => {
          const existing = state.messagesByChat[chatId] || [];
          // Avoid duplicates
          if (existing.some((m) => m.id === message.id)) {
            return state;
          }
          return {
            messagesByChat: {
              ...state.messagesByChat,
              [chatId]: [...existing, message],
            },
          };
        }),

      prependMessages: (chatId, messages) =>
        set((state) => {
          const existing = state.messagesByChat[chatId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const newMessages = messages.filter((m) => !existingIds.has(m.id));
          return {
            messagesByChat: {
              ...state.messagesByChat,
              [chatId]: [...newMessages, ...existing],
            },
          };
        }),

      appendMessages: (chatId, messages) =>
        set((state) => {
          const existing = state.messagesByChat[chatId] || [];
          const existingIds = new Set(existing.map((m) => m.id));
          const newMessages = messages.filter((m) => !existingIds.has(m.id));
          if (newMessages.length === 0) return state;
          return {
            messagesByChat: {
              ...state.messagesByChat,
              [chatId]: [...existing, ...newMessages],
            },
          };
        }),

      updateMessage: (chatId, messageId, updates) =>
        set((state) => ({
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: (state.messagesByChat[chatId] || []).map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
          },
        })),

      deleteMessages: (chatId, messageIds) =>
        set((state) => {
          const idSet = new Set(messageIds);
          if (chatId) {
            // Known chat — only filter that chat
            return {
              messagesByChat: {
                ...state.messagesByChat,
                [chatId]: (state.messagesByChat[chatId] || []).filter(
                  (m) => !idSet.has(m.id)
                ),
              },
            };
          }
          // Unknown chat (non-channel delete) — search all chats
          const updated: Record<string, TelegramMessage[]> = {};
          let changed = false;
          for (const [cid, msgs] of Object.entries(state.messagesByChat)) {
            const filtered = msgs.filter((m) => !idSet.has(m.id));
            if (filtered.length !== msgs.length) changed = true;
            updated[cid] = filtered;
          }
          return changed ? { messagesByChat: updated } : state;
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      setHasMore: (chatId, hasMore) =>
        set((state) => ({
          hasMore: { ...state.hasMore, [chatId]: hasMore },
        })),

      setHasNewer: (chatId, hasNewer) =>
        set((state) => ({
          hasNewer: { ...state.hasNewer, [chatId]: hasNewer },
        })),

      clearChat: (chatId) =>
        set((state) => {
          const { [chatId]: _, ...rest } = state.messagesByChat;
          const { [chatId]: __, ...restHasNewer } = state.hasNewer;
          return { messagesByChat: rest, hasNewer: restHasNewer };
        }),

      reset: () => set({ messagesByChat: {}, isLoading: false, hasMore: {}, hasNewer: {} }),
    }),
    {
      name: "tg-messages",
      partialize: (state) => ({
        messagesByChat: trimMessagesForPersist(state.messagesByChat),
      }),
    }
  )
);
