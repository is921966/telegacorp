import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TelegramContact } from "../types/telegram";

interface ContactsStore {
  contacts: TelegramContact[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  lastFetchedAt: number;

  setContacts: (contacts: TelegramContact[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSearchQuery: (query: string) => void;
  reset: () => void;
}

export const useContactsStore = create<ContactsStore>()(
  persist(
    (set) => ({
      contacts: [],
      isLoading: false,
      error: null,
      searchQuery: "",
      lastFetchedAt: 0,

      setContacts: (contacts) => set({ contacts, isLoading: false, error: null, lastFetchedAt: Date.now() }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error, isLoading: false }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      reset: () => set({ contacts: [], isLoading: false, error: null, searchQuery: "", lastFetchedAt: 0 }),
    }),
    {
      name: "tg-contacts",
      partialize: (state) => ({ contacts: state.contacts, lastFetchedAt: state.lastFetchedAt }),
    }
  )
);
