"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MessageItem } from "./MessageItem";
import { ScrollToBottom } from "./ScrollToBottom";
import { PinnedBanner } from "./PinnedBanner";
import { useMessages } from "@/hooks/useMessages";
import { useUIStore } from "@/store/ui";
import { safeDate } from "@/lib/utils";
import { useChatsStore } from "@/store/chats";
import { Loader2 } from "lucide-react";

/** Format ISO date key (YYYY-MM-DD) for date separator in Russian */
function formatDateSeparator(isoDate: string): string {
  // Parse from ISO format: "2026-02-28" — universally supported
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = today.getTime() - date.getTime();
  const days = Math.round(diff / 86400000);

  if (days === 0) return "Сегодня";
  if (days === 1) return "Вчера";

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export function MessageList() {
  const { selectedChatId } = useUIStore();
  const { dialogs } = useChatsStore();
  const { messages, isLoading, hasMore, loadMore } = useMessages(selectedChatId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const dialog = dialogs.find((d) => d.id === selectedChatId);
  const isGroup = dialog?.type === "group";

  // Helper to get the scroll viewport element
  const getViewport = useCallback(() => {
    const scrollRoot = scrollRef.current;
    if (!scrollRoot) return null;
    return scrollRoot.querySelector("[data-slot='scroll-area-viewport']") as HTMLElement | null;
  }, []);

  // Handle scroll position after messages change
  useEffect(() => {
    if (isLoadingMoreRef.current && messages.length > prevMessageCount.current) {
      // Older messages were prepended — restore scroll position
      const viewport = getViewport();
      if (viewport) {
        const addedHeight = viewport.scrollHeight - prevScrollHeightRef.current;
        viewport.scrollTop = addedHeight;
      }
      isLoadingMoreRef.current = false;
    } else if (prevMessageCount.current === 0 && messages.length > 0) {
      // Initial load after chat switch — scroll to bottom
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView();
      });
    } else if (messages.length > prevMessageCount.current && prevMessageCount.current > 0) {
      // New message arrived at the bottom — auto-scroll only if near bottom
      const viewport = getViewport();
      if (viewport) {
        const distFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
        if (distFromBottom < 200) {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, getViewport]);

  // Scroll to bottom on chat switch
  useEffect(() => {
    bottomRef.current?.scrollIntoView();
    prevMessageCount.current = 0;
    isLoadingMoreRef.current = false;
    setShowScrollBtn(false);
  }, [selectedChatId]);

  // Wrapped loadMore that saves scroll state before loading
  const handleLoadMore = useCallback(() => {
    const viewport = getViewport();
    if (viewport) {
      prevScrollHeightRef.current = viewport.scrollHeight;
      isLoadingMoreRef.current = true;
    }
    loadMore();
  }, [loadMore, getViewport]);

  // Attach scroll listener to the ScrollArea viewport
  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const onScroll = () => {
      // Load more when near top
      if (viewport.scrollTop < 100 && hasMore && !isLoading && !isLoadingMoreRef.current) {
        handleLoadMore();
      }
      // Show/hide scroll-to-bottom button
      const distFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setShowScrollBtn(distFromBottom > 300);
    };

    viewport.addEventListener("scroll", onScroll);
    return () => viewport.removeEventListener("scroll", onScroll);
  }, [hasMore, isLoading, handleLoadMore, getViewport]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (!selectedChatId) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Выберите чат для начала общения
      </div>
    );
  }

  if (isLoading && messages.length === 0) {
    return (
      <div className="flex-1 p-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <Skeleton className="h-12 w-48 rounded-2xl" />
          </div>
        ))}
      </div>
    );
  }

  // Sort messages by date ascending for display
  const sorted = [...messages].sort(
    (a, b) => safeDate(a.date).getTime() - safeDate(b.date).getTime()
  );

  // Group messages by date
  const dateGroups: { date: string; messages: typeof sorted }[] = [];
  let currentDate = "";
  for (const msg of sorted) {
    const md = safeDate(msg.date);
    const dateStr = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, "0")}-${String(md.getDate()).padStart(2, "0")}`;
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      dateGroups.push({ date: dateStr, messages: [] });
    }
    dateGroups[dateGroups.length - 1].messages.push(msg);
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Pinned message banner */}
      <PinnedBanner chatId={selectedChatId} />

      <ScrollArea
        className="flex-1 min-h-0 bg-[image:var(--chat-pattern)] bg-repeat bg-[length:400px]"
        ref={scrollRef}
      >
        <div className="p-4 max-w-3xl mx-auto">
          {hasMore && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Загрузить ранее"
                )}
              </Button>
            </div>
          )}

          {dateGroups.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="rounded-full bg-background/80 backdrop-blur-sm px-3 py-1 text-xs text-muted-foreground shadow-sm">
                  {formatDateSeparator(group.date)}
                </span>
              </div>
              {group.messages.map((msg, idx) => {
                // Check if grouped with previous message
                const prev = idx > 0 ? group.messages[idx - 1] : null;
                const isGrouped =
                  prev !== null &&
                  prev.senderId === msg.senderId &&
                  prev.isOutgoing === msg.isOutgoing &&
                  safeDate(msg.date).getTime() - safeDate(prev.date).getTime() < 60000; // within 1 min

                return (
                  <MessageItem
                    key={`${msg.id}-${safeDate(msg.date).getTime()}`}
                    message={msg}
                    showSender={isGroup || dialog?.type === "channel"}
                    isGrouped={isGrouped}
                  />
                );
              })}
            </div>
          ))}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      <ScrollToBottom
        visible={showScrollBtn}
        unreadCount={dialog?.unreadCount}
        onClick={scrollToBottom}
      />
    </div>
  );
}
