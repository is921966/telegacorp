"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Skeleton } from "@/components/ui/skeleton";
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
  | { kind: "unread-divider"; count: number }
  | { kind: "message"; message: TelegramMessage; isGrouped: boolean; showSender: boolean };

export function MessageList() {
  const { selectedChatId } = useUIStore();
  const { dialogs } = useChatsStore();
  const {
    messages,
    isLoading,
    hasMore,
    hasNewer,
    loadMore,
    loadNewer,
    loadMessages,
    markChatAsRead,
  } = useMessages(selectedChatId);
  const parentRef = useRef<HTMLDivElement>(null);
  const isLoadingMoreRef = useRef(false);
  const isLoadingNewerRef = useRef(false);
  /** Suppress scroll-triggered pagination during initial scroll-to-divider */
  const initialScrollDoneRef = useRef(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const prevCountRef = useRef(0);
  /** Debounce timer for progressive mark-as-read */
  const markAsReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Highest message ID for which markAsRead has been sent — prevents duplicate calls */
  const markedUpToRef = useRef(0);
  /** Frozen unread state at chat-open time — prevents divider from vanishing when markAsRead fires */
  const frozenUnreadRef = useRef<{
    chatId: string | null;
    readInboxMaxId?: number;
    unreadCount: number;
  }>({ chatId: null, unreadCount: 0 });

  const dialog = dialogs.find((d) => d.id === selectedChatId);
  const isGroup = dialog?.type === "group" || dialog?.type === "channel";
  const readInboxMaxId = dialog?.readInboxMaxId;
  const unreadCount = dialog?.unreadCount ?? 0;

  // Freeze unread state when chat changes so the divider persists after markAsRead
  if (selectedChatId !== frozenUnreadRef.current.chatId) {
    frozenUnreadRef.current = {
      chatId: selectedChatId,
      readInboxMaxId,
      unreadCount,
    };
  } else if (
    frozenUnreadRef.current.unreadCount === 0 &&
    unreadCount > 0 &&
    readInboxMaxId
  ) {
    // Dialog data arrived after initial render
    frozenUnreadRef.current = { chatId: selectedChatId, readInboxMaxId, unreadCount };
  }

  // Build flat virtual items list: date separators + unread divider + messages
  const items: VirtualItem[] = useMemo(() => {
    const sorted = [...messages].sort(
      (a, b) => safeDate(a.date).getTime() - safeDate(b.date).getTime()
    );

    const result: VirtualItem[] = [];
    let currentDate = "";
    let prevMsg: TelegramMessage | null = null;
    let unreadDividerInserted = false;

    for (const msg of sorted) {
      const md = safeDate(msg.date);
      const dateStr = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, "0")}-${String(md.getDate()).padStart(2, "0")}`;

      if (dateStr !== currentDate) {
        currentDate = dateStr;
        result.push({ kind: "date", date: dateStr });
        prevMsg = null; // reset grouping after date separator
      }

      // Insert unread divider before the first unread message (using frozen values
      // so the divider persists after markAsRead sets live unreadCount to 0)
      if (
        !unreadDividerInserted &&
        frozenUnreadRef.current.readInboxMaxId &&
        frozenUnreadRef.current.unreadCount > 0 &&
        msg.id > frozenUnreadRef.current.readInboxMaxId &&
        !msg.isOutgoing
      ) {
        unreadDividerInserted = true;
        result.push({ kind: "unread-divider", count: frozenUnreadRef.current.unreadCount });
        prevMsg = null; // reset grouping after divider
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- frozenUnreadRef is intentionally stable
  }, [messages, isGroup]);

  // Index of the unread divider (for initial scroll targeting)
  const unreadDividerIndex = useMemo(
    () => items.findIndex((i) => i.kind === "unread-divider"),
    [items]
  );

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = items[index];
      if (item.kind === "date") return 40;
      if (item.kind === "unread-divider") return 36;
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

  // Auto-scroll on initial load or new message
  useEffect(() => {
    if (items.length === 0) {
      // When messages are cleared (e.g. before "around" API call),
      // reset so the NEXT data arrival triggers initial scroll positioning.
      prevCountRef.current = 0;
      return;
    }

    if (prevCountRef.current === 0 && items.length > 0) {
      // Initial load — scroll to unread divider or bottom.
      // Multiple attempts needed because virtualizer uses estimated sizes
      // initially; real measurements arrive asynchronously after render.
      // Suppress scroll-triggered pagination until initial positioning is done
      initialScrollDoneRef.current = false;

      if (unreadDividerIndex >= 0) {
        // Use virtualizer.scrollToIndex first to get roughly close,
        // then fall back to DOM scrollIntoView for pixel-perfect positioning
        // (virtualizer estimates can be inaccurate for media-heavy chats).
        virtualizer.scrollToIndex(unreadDividerIndex, { align: "start" });
        const scrollViaDom = () => {
          const el = parentRef.current?.querySelector(
            `[data-index="${unreadDividerIndex}"]`
          );
          if (el) {
            el.scrollIntoView({ block: "start" });
            // Add small offset so divider isn't hidden behind pinned banner
            if (parentRef.current) parentRef.current.scrollTop -= 8;
          }
        };
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollViaDom();
            setTimeout(scrollViaDom, 150);
            setTimeout(() => {
              scrollViaDom();
              initialScrollDoneRef.current = true;
            }, 400);
          });
        });
      } else {
        // No unread — scroll to bottom
        virtualizer.scrollToIndex(items.length - 1, { align: "end" });
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            virtualizer.scrollToIndex(items.length - 1, { align: "end" });
            initialScrollDoneRef.current = true;
          });
        });
      }
    } else if (
      items.length > prevCountRef.current &&
      !isLoadingMoreRef.current &&
      !isLoadingNewerRef.current
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
    if (isLoadingNewerRef.current && items.length > prevCountRef.current) {
      isLoadingNewerRef.current = false;
    }

    prevCountRef.current = items.length;
  }, [items.length, virtualizer, unreadDividerIndex]);

  // Failsafe: reset loading refs when isLoading goes false.
  // Prevents refs from getting stuck if loadMore/loadNewer returns 0 results.
  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        isLoadingMoreRef.current = false;
        isLoadingNewerRef.current = false;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Reset on chat switch
  useEffect(() => {
    prevCountRef.current = 0;
    isLoadingMoreRef.current = false;
    isLoadingNewerRef.current = false;
    initialScrollDoneRef.current = false;
    markedUpToRef.current = 0;
    setShowScrollBtn(false);
    if (markAsReadTimerRef.current) {
      clearTimeout(markAsReadTimerRef.current);
      markAsReadTimerRef.current = null;
    }
  }, [selectedChatId]);

  // Handle scroll: load more/newer, show/hide scroll button, mark as read
  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;

    // Load older messages when near top (skip during initial scroll-to-divider)
    if (initialScrollDoneRef.current && el.scrollTop < 150 && hasMore && !isLoading && !isLoadingMoreRef.current) {
      isLoadingMoreRef.current = true;
      loadMore();
    }

    // Load newer messages when near bottom (when in middle of history)
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (initialScrollDoneRef.current && distFromBottom < 150 && hasNewer && !isLoading && !isLoadingNewerRef.current) {
      isLoadingNewerRef.current = true;
      loadNewer();
    }

    setShowScrollBtn(distFromBottom > 300);

    // Progressive mark-as-read: determine the highest visible unread message
    // and mark everything up to it as read (with debounce to avoid API spam).
    if (initialScrollDoneRef.current && unreadCount > 0 && readInboxMaxId) {
      // At the very bottom with no newer → mark ALL as read
      if (distFromBottom < 50 && !hasNewer) {
        if (markAsReadTimerRef.current) clearTimeout(markAsReadTimerRef.current);
        markedUpToRef.current = Infinity;
        markAsReadTimerRef.current = setTimeout(() => {
          markChatAsRead();
        }, 300);
      } else {
        // Find the highest ACTUALLY visible unread message ID.
        // getVirtualItems() includes overscan — filter to viewport only.
        const scrollTop = el.scrollTop;
        const viewportBottom = scrollTop + el.clientHeight;
        let maxVisibleUnreadId = 0;
        for (const vItem of virtualizer.getVirtualItems()) {
          // Skip items outside the actual viewport (overscan)
          if (vItem.end < scrollTop || vItem.start > viewportBottom) continue;
          const item = items[vItem.index];
          if (
            item.kind === "message" &&
            !item.message.isOutgoing &&
            item.message.id > readInboxMaxId
          ) {
            maxVisibleUnreadId = Math.max(maxVisibleUnreadId, item.message.id);
          }
        }
        // Only send markAsRead if we've scrolled past new unread messages
        if (maxVisibleUnreadId > 0 && maxVisibleUnreadId > markedUpToRef.current) {
          const targetId = maxVisibleUnreadId;
          markedUpToRef.current = targetId;
          if (markAsReadTimerRef.current) clearTimeout(markAsReadTimerRef.current);
          markAsReadTimerRef.current = setTimeout(() => {
            // Guard: skip if a newer mark already happened (e.g. from rapid scrolling)
            if (markedUpToRef.current > targetId) return;
            markChatAsRead(targetId);
          }, 500);
        }
      }
    }
  }, [hasMore, hasNewer, isLoading, loadMore, loadNewer, unreadCount, readInboxMaxId, markChatAsRead, virtualizer, items]);

  const scrollToBottom = useCallback(() => {
    if (hasNewer) {
      // If we're in the middle of history, reload from bottom
      loadMessages("bottom");
    } else if (items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, { align: "end", behavior: "smooth" });
    }
    // Mark all as read when explicitly jumping to bottom
    if (unreadCount > 0) {
      markChatAsRead();
    }
  }, [items.length, virtualizer, hasNewer, loadMessages, unreadCount, markChatAsRead]);

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
          {/* Loading spinner at top during infinite scroll */}
          {hasMore && isLoading && (
            <div className="flex justify-center py-2 sticky top-0 z-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
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
                ) : item.kind === "unread-divider" ? (
                  <div className="flex items-center gap-3 my-2 px-2">
                    <div className="flex-1 h-px bg-blue-500/50" />
                    <span className="text-xs font-medium text-blue-500 whitespace-nowrap">
                      Непрочитанные сообщения
                    </span>
                    <div className="flex-1 h-px bg-blue-500/50" />
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

          {/* Loading spinner at bottom during newer messages load */}
          {hasNewer && isLoading && (
            <div className="flex justify-center py-2 sticky bottom-0 z-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
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
