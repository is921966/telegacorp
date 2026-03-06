"use client";

import { useEffect, useCallback, useRef } from "react";
import { useTopicsStore } from "@/store/topics";
import { useTelegramClient } from "./useTelegramClient";
import type { TelegramForumTopic } from "@/types/telegram";

/** Stable empty array to avoid getSnapshot infinite loop */
const EMPTY_TOPICS: TelegramForumTopic[] = [];

/**
 * Hook to load and manage forum topics for a chat.
 * Only fetches topics if the chat is a forum (isForum = true).
 */
export function useForumTopics(chatId: string | null, isForum: boolean) {
  const { client, isConnected } = useTelegramClient();
  const topics = useTopicsStore(
    (s) => (chatId ? s.topicsByChat[chatId] : undefined) ?? EMPTY_TOPICS
  );
  const isLoading = useTopicsStore(
    (s) => chatId ? !!s.isLoadingTopics[chatId] : false
  );
  const setTopics = useTopicsStore((s) => s.setTopics);
  const setLoadingTopics = useTopicsStore((s) => s.setLoadingTopics);

  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!client || !isConnected || !chatId || !isForum) return;
    if (loadedRef.current === chatId) return;
    loadedRef.current = chatId;

    let cancelled = false;

    const load = async () => {
      setLoadingTopics(chatId, true);
      try {
        const { getForumTopics, fetchTopicEmojis } = await import("@/lib/telegram/topics");
        const result = await getForumTopics(client, chatId);
        if (!cancelled) {
          setTopics(chatId, result);

          // Async: download custom emoji icons (non-blocking)
          const emojiIds = result
            .map((t) => t.iconEmojiId)
            .filter((id): id is string => !!id);

          if (emojiIds.length > 0) {
            fetchTopicEmojis(client, emojiIds)
              .then((emojiMap) => {
                if (cancelled || emojiMap.size === 0) return;
                // Update topics with emoji URLs
                const updated = result.map((t) =>
                  t.iconEmojiId && emojiMap.has(t.iconEmojiId)
                    ? { ...t, iconEmojiUrl: emojiMap.get(t.iconEmojiId)! }
                    : t
                );
                setTopics(chatId, updated);
              })
              .catch(() => {
                // Non-critical: topics will use colored circles
              });
          }
        }
      } catch (err) {
        console.error("[useForumTopics] Failed to load topics:", err);
      } finally {
        if (!cancelled) {
          setLoadingTopics(chatId, false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [client, isConnected, chatId, isForum, setTopics, setLoadingTopics]);

  // Reset loadedRef when chatId changes so we reload for a new chat
  useEffect(() => {
    if (!chatId) {
      loadedRef.current = null;
    }
  }, [chatId]);

  const refresh = useCallback(async () => {
    if (!client || !isConnected || !chatId || !isForum) return;

    setLoadingTopics(chatId, true);
    try {
      const { getForumTopics } = await import("@/lib/telegram/topics");
      const result = await getForumTopics(client, chatId);
      setTopics(chatId, result);
    } catch (err) {
      console.error("[useForumTopics] Failed to refresh topics:", err);
    } finally {
      setLoadingTopics(chatId, false);
    }
  }, [client, isConnected, chatId, isForum, setTopics, setLoadingTopics]);

  return { topics, isLoading, refresh };
}
