"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Loader2, MessageSquare } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useTelegramClient } from "@/hooks/useTelegramClient";
import { MessageItem } from "./MessageItem";
import type { TelegramMessage } from "@/types/telegram";

export function CommentThread() {
  const { commentThread, closeCommentThread } = useUIStore();
  const { client, isConnected } = useTelegramClient();
  const [comments, setComments] = useState<TelegramMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<string | null>(null);

  const chatId = commentThread?.chatId ?? null;
  const messageId = commentThread?.messageId ?? null;

  // Load comments when thread opens
  useEffect(() => {
    if (!client || !isConnected || !chatId || !messageId) return;

    const key = `${chatId}:${messageId}`;
    if (loadedRef.current === key) return;
    loadedRef.current = key;

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setComments([]);
      try {
        const { getComments } = await import("@/lib/telegram/messages");
        const result = await getComments(client, chatId, messageId, 50);
        if (!cancelled) {
          setComments(result);
          setHasMore(result.length >= 50);
        }
      } catch (err) {
        console.error("Failed to load comments", err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [client, isConnected, chatId, messageId]);

  // Reset when thread closes
  useEffect(() => {
    if (!commentThread) {
      loadedRef.current = null;
      setComments([]);
    }
  }, [commentThread]);

  // Load older comments on scroll up
  const loadMore = useCallback(async () => {
    if (!client || !chatId || !messageId || !hasMore || isLoading) return;
    if (comments.length === 0) return;

    const oldestId = Math.min(...comments.map((m) => m.id));
    setIsLoading(true);
    try {
      const { getComments } = await import("@/lib/telegram/messages");
      const older = await getComments(client, chatId, messageId, 50, oldestId);
      if (older.length > 0) {
        setComments((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const unique = older.filter((m) => !existingIds.has(m.id));
          return [...unique, ...prev];
        });
      }
      setHasMore(older.length >= 50);
    } catch (err) {
      console.error("Failed to load more comments", err);
    } finally {
      setIsLoading(false);
    }
  }, [client, chatId, messageId, hasMore, isLoading, comments]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop < 100 && hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  if (!commentThread) return null;

  return (
    <div className="flex flex-col w-[380px] min-w-[320px] border-l border-border bg-background h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-400" />
          <span className="font-medium text-sm">
            Комментарии
            {comments.length > 0 && (
              <span className="text-muted-foreground ml-1">({comments.length})</span>
            )}
          </span>
        </div>
        <button
          onClick={closeCommentThread}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Comments list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0"
      >
        {isLoading && comments.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-sm">Нет комментариев</span>
          </div>
        )}

        {isLoading && comments.length > 0 && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {comments.map((msg, i) => (
          <MessageItem
            key={msg.id}
            message={msg}
            showSender={
              i === 0 || comments[i - 1]?.senderId !== msg.senderId
            }
          />
        ))}
      </div>
    </div>
  );
}
