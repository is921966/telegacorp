import { create } from "zustand";
import type { TelegramContact } from "@/types/telegram";

export type ViewType = "chats" | "contacts" | "calls" | "search" | "settings";

export interface CreateFlowState {
  isOpen: boolean;
  type: "group" | "channel";
  step: number;
  selectedMembers: TelegramContact[];
  title: string;
  about: string;
  photoFile: File | null;
  photoPreview: string | null;
  isPublic: boolean;
  publicLink: string;
  isCreating: boolean;
  error: string | null;
}

interface UIStore {
  currentView: ViewType;
  selectedChatId: string | null;
  /** Currently selected forum topic ID (null = no topic selected) */
  selectedTopicId: number | null;
  /** Desktop: expanded forum chat ID in chat list (inline topic expansion) */
  expandedForumChatId: string | null;
  isSearchOpen: boolean;
  searchQuery: string;
  isSidebarOpen: boolean;
  isGroupInfoOpen: boolean;
  isEditingGroupInfo: boolean;
  isMediaViewerOpen: boolean;
  mediaViewerUrl: string | null;
  mediaViewerType: "image" | "video";
  mediaViewerMessageId: number | null;
  mediaViewerChatId: string | null;
  replyToMessageId: number | null;
  editingMessageId: number | null;
  theme: "light" | "dark";
  commentThread: { chatId: string; messageId: number } | null;
  createFlow: CreateFlowState | null;

  setCurrentView: (view: ViewType) => void;
  selectChat: (chatId: string | null) => void;
  /** Select a forum topic — opens messages for that topic */
  selectTopic: (chatId: string, topicId: number | null) => void;
  /** Toggle forum expansion in desktop chat list */
  expandForum: (chatId: string | null) => void;
  toggleSearch: () => void;
  setSearchQuery: (query: string) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleGroupInfo: () => void;
  setEditingGroupInfo: (editing: boolean) => void;
  openMediaViewer: (url: string, type?: "image" | "video", messageId?: number, chatId?: string) => void;
  closeMediaViewer: () => void;
  setReplyTo: (messageId: number | null) => void;
  setEditing: (messageId: number | null) => void;
  setTheme: (theme: "light" | "dark") => void;
  openCommentThread: (chatId: string, messageId: number) => void;
  closeCommentThread: () => void;
  openCreateGroup: () => void;
  openCreateChannel: () => void;
  closeCreateFlow: () => void;
  setCreateFlowStep: (step: number) => void;
  toggleMember: (contact: TelegramContact) => void;
  setCreateFlowTitle: (title: string) => void;
  setCreateFlowAbout: (about: string) => void;
  setCreateFlowPhoto: (file: File | null, preview: string | null) => void;
  setCreateFlowPublic: (isPublic: boolean) => void;
  setCreateFlowLink: (link: string) => void;
  setCreateFlowCreating: (creating: boolean) => void;
  setCreateFlowError: (error: string | null) => void;
  reset: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  currentView: "chats" as ViewType,
  selectedChatId: null,
  selectedTopicId: null,
  expandedForumChatId: null,
  isSearchOpen: false,
  searchQuery: "",
  isSidebarOpen: true,
  isGroupInfoOpen: false,
  isEditingGroupInfo: false,
  isMediaViewerOpen: false,
  mediaViewerUrl: null,
  mediaViewerType: "image" as "image" | "video",
  mediaViewerMessageId: null,
  mediaViewerChatId: null,
  replyToMessageId: null,
  editingMessageId: null,
  theme: "dark",
  commentThread: null,
  createFlow: null,

  setCurrentView: (view) =>
    set((state) => ({
      currentView: view,
      // When switching away from chats, deselect the chat
      selectedChatId: view !== "chats" ? null : state.selectedChatId,
      selectedTopicId: view !== "chats" ? null : state.selectedTopicId,
      isGroupInfoOpen: false,
      isSearchOpen: false,
      searchQuery: "",
    })),

  selectChat: (chatId) => {
    if (chatId) {
      import("@/lib/chat-priority-tracker").then(({ recordChatOpen }) => {
        recordChatOpen(chatId);
      });
    }
    set({
      selectedChatId: chatId,
      selectedTopicId: null,
      currentView: "chats" as ViewType,
      isSidebarOpen: !chatId,
      isGroupInfoOpen: false,
      commentThread: null,
    });
  },

  selectTopic: (chatId, topicId) => {
    if (chatId) {
      import("@/lib/chat-priority-tracker").then(({ recordChatOpen }) => {
        recordChatOpen(chatId);
      });
    }
    set({
      selectedChatId: chatId,
      selectedTopicId: topicId,
      currentView: "chats" as ViewType,
      isSidebarOpen: false,
      isGroupInfoOpen: false,
      commentThread: null,
    });
  },

  expandForum: (chatId) =>
    set((state) => ({
      // Toggle: if same chatId → collapse, otherwise expand
      expandedForumChatId:
        state.expandedForumChatId === chatId ? null : chatId,
    })),

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
    set((state) => ({
      isGroupInfoOpen: !state.isGroupInfoOpen,
      isEditingGroupInfo: state.isGroupInfoOpen ? false : state.isEditingGroupInfo,
    })),

  setEditingGroupInfo: (editing) => set({ isEditingGroupInfo: editing }),

  openMediaViewer: (url, type = "image", messageId, chatId) =>
    set({
      isMediaViewerOpen: true,
      mediaViewerUrl: url,
      mediaViewerType: type,
      mediaViewerMessageId: messageId ?? null,
      mediaViewerChatId: chatId ?? null,
    }),

  closeMediaViewer: () =>
    set({
      isMediaViewerOpen: false,
      mediaViewerUrl: null,
      mediaViewerMessageId: null,
      mediaViewerChatId: null,
    }),

  setReplyTo: (messageId) => set({ replyToMessageId: messageId }),
  setEditing: (messageId) => set({ editingMessageId: messageId }),
  openCommentThread: (chatId, messageId) => set({ commentThread: { chatId, messageId } }),
  closeCommentThread: () => set({ commentThread: null }),

  openCreateGroup: () =>
    set({
      createFlow: {
        isOpen: true,
        type: "group",
        step: 1,
        selectedMembers: [],
        title: "",
        about: "",
        photoFile: null,
        photoPreview: null,
        isPublic: false,
        publicLink: "",
        isCreating: false,
        error: null,
      },
    }),

  openCreateChannel: () =>
    set({
      createFlow: {
        isOpen: true,
        type: "channel",
        step: 1,
        selectedMembers: [],
        title: "",
        about: "",
        photoFile: null,
        photoPreview: null,
        isPublic: false,
        publicLink: "",
        isCreating: false,
        error: null,
      },
    }),

  closeCreateFlow: () => set({ createFlow: null }),

  setCreateFlowStep: (step) =>
    set((state) => {
      if (!state.createFlow) return state;
      return { createFlow: { ...state.createFlow, step } };
    }),

  toggleMember: (contact) =>
    set((state) => {
      if (!state.createFlow) return state;
      const exists = state.createFlow.selectedMembers.find(
        (m) => m.id === contact.id
      );
      return {
        createFlow: {
          ...state.createFlow,
          selectedMembers: exists
            ? state.createFlow.selectedMembers.filter(
                (m) => m.id !== contact.id
              )
            : [...state.createFlow.selectedMembers, contact],
        },
      };
    }),

  setCreateFlowTitle: (title) =>
    set((state) => {
      if (!state.createFlow) return state;
      return { createFlow: { ...state.createFlow, title } };
    }),

  setCreateFlowAbout: (about) =>
    set((state) => {
      if (!state.createFlow) return state;
      return { createFlow: { ...state.createFlow, about } };
    }),

  setCreateFlowPhoto: (file, preview) =>
    set((state) => {
      if (!state.createFlow) return state;
      return {
        createFlow: {
          ...state.createFlow,
          photoFile: file,
          photoPreview: preview,
        },
      };
    }),

  setCreateFlowPublic: (isPublic) =>
    set((state) => {
      if (!state.createFlow) return state;
      return { createFlow: { ...state.createFlow, isPublic } };
    }),

  setCreateFlowLink: (publicLink) =>
    set((state) => {
      if (!state.createFlow) return state;
      return { createFlow: { ...state.createFlow, publicLink } };
    }),

  setCreateFlowCreating: (isCreating) =>
    set((state) => {
      if (!state.createFlow) return state;
      return { createFlow: { ...state.createFlow, isCreating } };
    }),

  setCreateFlowError: (error) =>
    set((state) => {
      if (!state.createFlow) return state;
      return { createFlow: { ...state.createFlow, error } };
    }),

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
      selectedTopicId: null,
      expandedForumChatId: null,
      isSearchOpen: false,
      searchQuery: "",
      isSidebarOpen: true,
      isGroupInfoOpen: false,
      isEditingGroupInfo: false,
      isMediaViewerOpen: false,
      mediaViewerUrl: null,
      mediaViewerMessageId: null,
      mediaViewerChatId: null,
      replyToMessageId: null,
      editingMessageId: null,
      commentThread: null,
      createFlow: null,
    }),
}));
