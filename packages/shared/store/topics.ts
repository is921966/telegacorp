import { create } from "zustand";
import type { TelegramForumTopic } from "../types/telegram";

interface TopicsStore {
  /** chatId → topics[] */
  topicsByChat: Record<string, TelegramForumTopic[]>;
  /** chatId → loading state */
  isLoadingTopics: Record<string, boolean>;

  /** Set topics for a chat */
  setTopics: (chatId: string, topics: TelegramForumTopic[]) => void;

  /** Set loading state for a chat */
  setLoadingTopics: (chatId: string, loading: boolean) => void;

  /** Update unread count for a specific topic */
  updateTopicUnread: (
    chatId: string,
    topicId: number,
    unreadCount: number
  ) => void;

  /** Update last message for a specific topic */
  updateTopicLastMessage: (
    chatId: string,
    topicId: number,
    msg: NonNullable<TelegramForumTopic["lastMessage"]>
  ) => void;

  /** Clear topics for a chat */
  clearTopics: (chatId: string) => void;
}

export const useTopicsStore = create<TopicsStore>((set) => ({
  topicsByChat: {},
  isLoadingTopics: {},

  setTopics: (chatId, topics) =>
    set((state) => ({
      topicsByChat: { ...state.topicsByChat, [chatId]: topics },
    })),

  setLoadingTopics: (chatId, loading) =>
    set((state) => ({
      isLoadingTopics: { ...state.isLoadingTopics, [chatId]: loading },
    })),

  updateTopicUnread: (chatId, topicId, unreadCount) =>
    set((state) => {
      const topics = state.topicsByChat[chatId];
      if (!topics) return state;

      return {
        topicsByChat: {
          ...state.topicsByChat,
          [chatId]: topics.map((t) =>
            t.id === topicId ? { ...t, unreadCount } : t
          ),
        },
      };
    }),

  updateTopicLastMessage: (chatId, topicId, msg) =>
    set((state) => {
      const topics = state.topicsByChat[chatId];
      if (!topics) return state;

      return {
        topicsByChat: {
          ...state.topicsByChat,
          [chatId]: topics.map((t) =>
            t.id === topicId ? { ...t, lastMessage: msg } : t
          ),
        },
      };
    }),

  clearTopics: (chatId) =>
    set((state) => {
      const { [chatId]: _, ...rest } = state.topicsByChat;
      const { [chatId]: __, ...restLoading } = state.isLoadingTopics;
      return {
        topicsByChat: rest,
        isLoadingTopics: restLoading,
      };
    }),
}));
