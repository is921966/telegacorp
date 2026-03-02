"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import type { TelegramMessage } from "@/types/telegram";

/** Format ISO date key (YYYY-MM-DD) for date separator in Russian */
function formatDateSeparator(isoDate: string): string {
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

type VirtualItem =
  | { kind: "date"; date: string }
  | { kind: "message"; message: TelegramMessage; isGrouped: boolean; showSender: boolean };

export function MessageList() {
  const { selectedChatId } = useUIStore();
  const { dialogs } = useChatsStore();
  const { messages, isLoading, hasMore, loadMore } = useMessages(selectedChatId);
  const parentRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const prevCountRef = useRef(0);

  const dialog = dialogs.find((d) => d.id === selectedChatId);
  const isGroup = dialog?.type === "group" || dialog?.type === "channel";

  // Build flat virtual items list: date separators + messages
  const items: VirtualItem[] = useMemo(() => {
    const sorted = [...messages].sort(
      (a, b) => safeDate(a.date).getTime() - safeDate(b.date).getTime()
    );

    const result: VirtualItem[] = [];
    let currentDate = "";
    let prevMsg: TelegramMessage | null = null;

    for (const msg of sorted) {
      const md = safeDate(msg.date);
      const dateStr = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, "0")}-${String(md.getDate()).padStart(2, "0")}`;

      if (dateStr !== currentDate) {
        currentDate = dateStr;
        result.push({ kind: "date", date: dateStr });
        prevMsg = null; // reset grouping after date separator
      }

      const isGrouped =
        prevMsg !== null &&
        prevMsg.senderId === msg.senderId &&
        prevMsg.isOutgoing === msg.isOutgoing &&
        safeDate(msg.date).getTime() - safeDate(prevMsg.date).getTime() < 60000;

      result.push({
        kind: "message",
        message: msg,
        isGrouped,
        showSender: isGroup,
      });
      prevMsg = msg;
    }

    return result;
  }, [messages, isGroup]);

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = items[index];
      if (item.kind === "date") return 40;
      // Estimate message height based on content
      const msg = item.message;
      if (msg.media?.type === "photo" || msg.media?.type === "video") return 280;
      if (msg.media?.type === "sticker") return 210;
      if (msg.media?.type === "document") return 70;
      const textLen = msg.text?.length || 0;
      return Math.max(42, 42 + Math.floor(textLen / 40) * 20);
    },
    overscan: 15,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  // Auto-scroll to bottom on initial load or new message
  useEffect(() => {
    if (items.length === 0) return;

    if (prevCountRef.current === 0 && items.length > 0) {
      // Initial load — jump to bottom
      requestAnimationFrame(() => {
        virtualizer.scrollToIndex(items.length - 1, { align: "end" });
      });
    } else if (
      items.length > prevCountRef.current &&
      !isLoadingMoreRef.current
    ) {
      // New message at bottom — auto-scroll if near bottom
      const el = parentRef.current;
      if (el) {
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distFromBottom < 200) {
          requestAnimationFrame(() => {
            virtualizer.scrollToIndex(items.length - 1, { align: "end", behavior: "smooth" });
          });
        }
      }
    }

    if (isLoadingMoreRef.current && items.length > prevCountRef.current) {
      isLoadingMoreRef.current = false;
    }

    prevCountRef.current = items.length;
  }, [items.length, virtualizer]);

  // Reset on chat switch
  useEffect(() => {
    prevCountRef.current = 0;
    isLoadingMoreRef.current = false;
    setShowScrollBtn(false);
  }, [selectedChatId]);

  // Handle scroll: load more when near top, show/hide scroll button
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;

    if (el.scrollTop < 150 && hasMore && !isLoading && !isLoadingMoreRef.current) {
      isLoadingMoreRef.current = true;
      loadMore();
    }

    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 300);
  }, [hasMore, isLoading, loadMore]);

  const scrollToBottom = useCallback(() => {
    if (items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, { align: "end", behavior: "smooth" });
    }
  }, [items.length, virtualizer]);

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

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <PinnedBanner chatId={selectedChatId} />

      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto bg-[image:var(--chat-pattern)] bg-repeat bg-[length:400px]"
      >
        <div
          className="max-w-3xl mx-auto px-4 relative"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {/* Load more button at top */}
          {hasMore && (
            <div className="flex justify-center py-2 sticky top-0 z-10">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  isLoadingMoreRef.current = true;
                  loadMore();
                }}
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

          {virtualItems.map((vItem) => {
            const item = items[vItem.index];

            return (
              <div
                key={vItem.key}
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${vItem.start}px)`,
                }}
              >
                {item.kind === "date" ? (
                  <div className="flex justify-center my-3">
                    <span className="rounded-full bg-background/80 backdrop-blur-sm px-3 py-1 text-xs text-muted-foreground shadow-sm">
                      {formatDateSeparator(item.date)}
                    </span>
                  </div>
                ) : (
                  <MessageItem
                    message={item.message}
                    showSender={item.showSender}
                    isGrouped={item.isGrouped}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ScrollToBottom
        visible={showScrollBtn}
        unreadCount={dialog?.unreadCount}
        onClick={scrollToBottom}
      />
    </div>
  );
}
