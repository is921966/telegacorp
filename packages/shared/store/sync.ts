import { create } from "zustand";

interface SyncStore {
  tabId: string;
  isLeader: boolean;
  activeTabs: string[];

  setTabId: (tabId: string) => void;
  setIsLeader: (isLeader: boolean) => void;
  setActiveTabs: (tabs: string[]) => void;
  reset: () => void;
}

export const useSyncStore = create<SyncStore>((set) => ({
  tabId: typeof crypto !== "undefined"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2),
  isLeader: false,
  activeTabs: [],

  setTabId: (tabId) => set({ tabId }),
  setIsLeader: (isLeader) => set({ isLeader }),
  setActiveTabs: (tabs) => set({ activeTabs: tabs }),
  reset: () => set({ isLeader: false, activeTabs: [] }),
}));
