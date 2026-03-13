import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TelegramCallRecord } from "../types/telegram";

interface CallsStore {
  calls: TelegramCallRecord[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  lastFetchedAt: number;

  setCalls: (calls: TelegramCallRecord[]) => void;
  appendCalls: (calls: TelegramCallRecord[]) => void;
  setLoading: (loading: boolean) => void;
  setHasMore: (hasMore: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useCallsStore = create<CallsStore>()(
  persist(
    (set) => ({
      calls: [],
      isLoading: false,
      hasMore: true,
      error: null,
      lastFetchedAt: 0,

      setCalls: (calls) => set({ calls, isLoading: false, error: null, lastFetchedAt: Date.now() }),
      appendCalls: (newCalls) =>
        set((state) => {
          const existingIds = new Set(state.calls.map((c) => c.id));
          const unique = newCalls.filter((c) => !existingIds.has(c.id));
          return { calls: [...state.calls, ...unique] };
        }),
      setLoading: (loading) => set({ isLoading: loading }),
      setHasMore: (hasMore) => set({ hasMore }),
      setError: (error) => set({ error, isLoading: false }),
      reset: () => set({ calls: [], isLoading: false, hasMore: true, error: null, lastFetchedAt: 0 }),
    }),
    {
      name: "tg-calls",
      partialize: (state) => ({ calls: state.calls, lastFetchedAt: state.lastFetchedAt }),
    }
  )
);
