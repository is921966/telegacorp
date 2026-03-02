import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TelegramDialog } from "@/types/telegram";

interface ChatsStore {
  dialogs: TelegramDialog[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  lastFetchedAt: number;

  setDialogs: (dialogs: TelegramDialog[]) => void;
  /** Append new dialogs to the end, assigning apiOrder continuation */
  appendDialogs: (newDialogs: TelegramDialog[]) => void;
  updateDialog: (id: string, updates: Partial<TelegramDialog>) => void;
  /**
   * Update dialog's lastMessage and optionally increment unreadCount.
   * Moves non-pinned dialogs to the top of the list (right after pinned).
   */
  bumpDialog: (
    chatId: string,
    lastMessage: TelegramDialog["lastMessage"],
    incrementUnread: boolean
  ) => void;
  setLoading: (loading: boolean) => void;
  setLoadingMore: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useChatsStore = create<ChatsStore>()(
  persist(
    (set) => ({
      dialogs: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: true,
      error: null,
      lastFetchedAt: 0,

      setDialogs: (dialogs) => set({ dialogs, isLoading: false, error: null, lastFetchedAt: Date.now() }),

      appendDialogs: (newDialogs) =>
        set((state) => {
          const existingIds = new Set(state.dialogs.map((d) => d.id));
          const unique = newDialogs.filter((d) => !existingIds.has(d.id));
          if (unique.length === 0) return state;
          const startOrder = state.dialogs.length;
          const withOrder = unique.map((d, i) => ({ ...d, apiOrder: startOrder + i }));
          return { dialogs: [...state.dialogs, ...withOrder], lastFetchedAt: Date.now() };
        }),

      updateDialog: (id, updates) =>
        set((state) => ({
          dialogs: state.dialogs.map((d) =>
            d.id === id ? { ...d, ...updates } : d
          ),
        })),

      bumpDialog: (chatId, lastMessage, incrementUnread) =>
        set((state) => {
          const idx = state.dialogs.findIndex((d) => d.id === chatId);
          if (idx === -1) return state; // unknown chat — skip

          const dialog = state.dialogs[idx];
          const updated: TelegramDialog = {
            ...dialog,
            lastMessage,
            unreadCount: incrementUnread
              ? dialog.unreadCount + 1
              : dialog.unreadCount,
          };

          // Pinned dialogs stay in place — just update lastMessage
          if (dialog.isPinned) {
            const newDialogs = [...state.dialogs];
            newDialogs[idx] = updated;
            return { dialogs: newDialogs };
          }

          // Non-pinned: move to top of non-pinned section, re-assign apiOrder
          const pinned = state.dialogs.filter((d) => d.isPinned);
          const nonPinned = state.dialogs.filter(
            (d) => !d.isPinned && d.id !== chatId
          );
          const result = [...pinned, updated, ...nonPinned].map((d, i) => ({
            ...d,
            apiOrder: i,
          }));

          return { dialogs: result };
        }),

      setLoading: (loading) => set({ isLoading: loading }),
      setLoadingMore: (loading) => set({ isLoadingMore: loading }),
      setHasMore: (hasMore) => set({ hasMore }),
      setError: (error) => set({ error, isLoading: false }),
      reset: () => set({ dialogs: [], isLoading: false, isLoadingMore: false, hasMore: true, error: null, lastFetchedAt: 0 }),
    }),
    {
      name: "tg-dialogs",
      partialize: (state) => ({ dialogs: state.dialogs, lastFetchedAt: state.lastFetchedAt }),
    }
  )
);

// Debug: expose store on window for inspection
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__chatsStore = useChatsStore;
}
