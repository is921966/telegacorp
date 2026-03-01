import { create } from "zustand";

export type ViewType = "chats" | "contacts" | "calls" | "search" | "settings";

interface UIStore {
  currentView: ViewType;
  selectedChatId: string | null;
  isSearchOpen: boolean;
  searchQuery: string;
  isSidebarOpen: boolean;
  isGroupInfoOpen: boolean;
  isMediaViewerOpen: boolean;
  mediaViewerUrl: string | null;
  replyToMessageId: number | null;
  editingMessageId: number | null;
  theme: "light" | "dark";

  setCurrentView: (view: ViewType) => void;
  selectChat: (chatId: string | null) => void;
  toggleSearch: () => void;
  setSearchQuery: (query: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleGroupInfo: () => void;
  openMediaViewer: (url: string) => void;
  closeMediaViewer: () => void;
  setReplyTo: (messageId: number | null) => void;
  setEditing: (messageId: number | null) => void;
  setTheme: (theme: "light" | "dark") => void;
  reset: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  currentView: "chats" as ViewType,
  selectedChatId: null,
  isSearchOpen: false,
  searchQuery: "",
  isSidebarOpen: true,
  isGroupInfoOpen: false,
  isMediaViewerOpen: false,
  mediaViewerUrl: null,
  replyToMessageId: null,
  editingMessageId: null,
  theme: "dark",

  setCurrentView: (view) =>
    set((state) => ({
      currentView: view,
      // When switching away from chats, deselect the chat
      selectedChatId: view !== "chats" ? null : state.selectedChatId,
      isGroupInfoOpen: false,
      isSearchOpen: false,
      searchQuery: "",
    })),

  selectChat: (chatId) =>
    set({
      selectedChatId: chatId,
      currentView: "chats" as ViewType,
      isSidebarOpen: !chatId,
      isGroupInfoOpen: false,
    }),

  toggleSearch: () =>
    set((state) => ({
      isSearchOpen: !state.isSearchOpen,
      searchQuery: state.isSearchOpen ? "" : state.searchQuery,
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),

  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),

  setSidebarOpen: (open) => set({ isSidebarOpen: open }),

  toggleGroupInfo: () =>
    set((state) => ({ isGroupInfoOpen: !state.isGroupInfoOpen })),

  openMediaViewer: (url) =>
    set({ isMediaViewerOpen: true, mediaViewerUrl: url }),

  closeMediaViewer: () =>
    set({ isMediaViewerOpen: false, mediaViewerUrl: null }),

  setReplyTo: (messageId) => set({ replyToMessageId: messageId }),
  setEditing: (messageId) => set({ editingMessageId: messageId }),
  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.classList.toggle("light", theme === "light");
    }
    set({ theme });
  },
  reset: () =>
    set({
      currentView: "chats" as ViewType,
      selectedChatId: null,
      isSearchOpen: false,
      searchQuery: "",
      isSidebarOpen: true,
      isGroupInfoOpen: false,
      isMediaViewerOpen: false,
      mediaViewerUrl: null,
      replyToMessageId: null,
      editingMessageId: null,
    }),
}));
