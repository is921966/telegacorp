import { create } from "zustand";
import type { TelegramFolder } from "@/types/telegram";

interface FoldersStore {
  folders: TelegramFolder[];
  selectedFolder: number;
  setFolders: (folders: TelegramFolder[]) => void;
  setSelectedFolder: (id: number) => void;
}

export const useFoldersStore = create<FoldersStore>((set) => ({
  folders: [],
  selectedFolder: 0,
  setFolders: (folders) => set({ folders }),
  setSelectedFolder: (id) => set({ selectedFolder: id }),
}));

// Debug: expose store on window for inspection
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__foldersStore = useFoldersStore;
}
