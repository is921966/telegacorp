import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TelegramDialog } from "@/types/telegram";

/** Safely convert various date representations to milliseconds */
function dateToMs(d: Date | string | number | undefined | null): number {
  if (!d) return 0;
  if (d instanceof Date) return d.getTime();
  if (typeof d === "number") return d;
  return new Date(d).getTime();
}

interface ChatsStore {
  dialogs: TelegramDialog[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  lastFetchedAt: number;

  setDialogs: (dialogs: TelegramDialog[]) => void;
  /**
   * Merge incoming dialogs with existing store data, preserving real-time
   * updates (lastMessage, unreadCount) when the store version is newer.
   * Used for background loads that shouldn't overwrite bumpDialog changes.
   * REPLACES the entire dialog array — use only when incoming contains ALL dialogs.
   */
  mergeDialogs: (incoming: TelegramDialog[]) => void;
  /**
   * Sync a partial batch of dialogs with the store (e.g., top 100).
   * Updates existing dialogs in-place if the incoming version is newer,
   * adds new dialogs, but NEVER removes dialogs not in the batch.
   * Used for periodic catch-up syncs.
   */
  syncDialogs: (incoming: TelegramDialog[]) => void;
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
  /**
   * Update read state after markAsRead API call.
   * maxId=0 means all read, otherwise partial read up to maxId.
   * remainingUnread is the count of messages still unread after this mark.
   */
  updateReadState: (chatId: string, maxId: number, remainingUnread?: number) => void;
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

      mergeDialogs: (incoming) =>
        set((state) => {
          // Build lookup of existing dialogs (may have real-time bumps)
          const existingMap = new Map(state.dialogs.map((d) => [d.id, d]));

          const merged = incoming.map((inc, i) => {
            const existing = existingMap.get(inc.id);
            if (!existing) return { ...inc, apiOrder: i };

            const incTime = dateToMs(inc.lastMessage?.date);
            const exTime = dateToMs(existing.lastMessage?.date);

            // If existing dialog has a newer lastMessage (from real-time bump),
            // preserve its lastMessage & unreadCount but take everything else
            // from the fresh API data (name, avatar, isPinned, etc.)
            if (exTime > incTime) {
              return {
                ...inc,
                apiOrder: i,
                lastMessage: existing.lastMessage,
                unreadCount: Math.max(inc.unreadCount, existing.unreadCount),
              };
            }

            return { ...inc, apiOrder: i };
          });

          return { dialogs: merged, lastFetchedAt: Date.now() };
        }),

      syncDialogs: (incoming) =>
        set((state) => {
          // Build a map of incoming updates
          const incomingMap = new Map(incoming.map((d) => [d.id, d]));
          let changed = false;

          // Update existing dialogs in-place
          const updated = state.dialogs.map((existing) => {
            const inc = incomingMap.get(existing.id);
            if (!inc) return existing; // not in this batch — keep as-is

            incomingMap.delete(existing.id); // mark as processed

            const incTime = dateToMs(inc.lastMessage?.date);
            const exTime = dateToMs(existing.lastMessage?.date);

            // If incoming has newer data, use it (update lastMessage, unreadCount, etc.)
            if (incTime > exTime) {
              changed = true;
              // If our local readInboxMaxId is ahead (we've locally marked messages
              // as read but the server sync hasn't caught up yet), keep our local
              // unread count to avoid the counter jumping back up temporarily.
              const localReadAhead = (existing.readInboxMaxId ?? 0) > (inc.readInboxMaxId ?? 0);
              return {
                ...existing,
                lastMessage: inc.lastMessage,
                unreadCount: localReadAhead ? Math.min(existing.unreadCount, inc.unreadCount) : inc.unreadCount,
                readInboxMaxId: localReadAhead ? existing.readInboxMaxId : inc.readInboxMaxId,
                isPinned: inc.isPinned,
                isMuted: inc.isMuted,
              };
            }

            // If unreadCount changed (e.g., marked as read on another device)
            if (inc.unreadCount !== existing.unreadCount || inc.readInboxMaxId !== existing.readInboxMaxId) {
              // If our local readInboxMaxId is ahead, keep our local read state
              const localReadAhead = (existing.readInboxMaxId ?? 0) > (inc.readInboxMaxId ?? 0);
              if (localReadAhead) {
                // Only update if server has a lower unread count (read on another device)
                if (inc.unreadCount < existing.unreadCount) {
                  changed = true;
                  return { ...existing, unreadCount: inc.unreadCount };
                }
                return existing;
              }
              changed = true;
              return { ...existing, unreadCount: inc.unreadCount, readInboxMaxId: inc.readInboxMaxId };
            }

            return existing;
          });

          // Add any new dialogs not already in the store
          const newDialogs: TelegramDialog[] = [];
          for (const [, inc] of incomingMap) {
            newDialogs.push({ ...inc, apiOrder: updated.length + newDialogs.length });
          }

          if (!changed && newDialogs.length === 0) return state;

          return {
            dialogs: newDialogs.length > 0 ? [...updated, ...newDialogs] : updated,
            lastFetchedAt: Date.now(),
          };
        }),

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

      updateReadState: (chatId, maxId, remainingUnread) =>
        set((state) => ({
          dialogs: state.dialogs.map((d) => {
            if (d.id !== chatId) return d;
            if (maxId === 0) {
              // Mark all as read
              return { ...d, unreadCount: 0, readInboxMaxId: undefined };
            }
            // Partial read — update readInboxMaxId and unread count
            return {
              ...d,
              readInboxMaxId: Math.max(maxId, d.readInboxMaxId ?? 0),
              unreadCount: remainingUnread ?? 0,
            };
          }),
        })),

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
