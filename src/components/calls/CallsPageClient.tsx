"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { CallListItem } from "@/components/calls/CallListItem";
import { useCalls } from "@/hooks/useCalls";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import { ArrowLeft, Phone, Loader2 } from "lucide-react";

export function CallsPageClient() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const { selectChat, setCurrentView } = useUIStore();
  const { calls, isLoading, hasMore, error, loadMore } = useCalls();
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  // Load avatars for call participants (get client from module singleton)
  useEffect(() => {
    if (!isTelegramConnected || calls.length === 0) return;
    let cancelled = false;
    (async () => {
      const { getConnectedClient } = await import("@/lib/telegram/client");
      const client = await getConnectedClient();
      if (!client || cancelled) return;

      const { downloadAvatar, getCachedAvatar } = await import("@/lib/telegram/photos");
      const uniqueIds = [...new Set(calls.map((c) => c.userId))];
      const toLoad = uniqueIds.filter((id) => getCachedAvatar(id) === undefined);

      if (toLoad.length === 0) {
        const newMap: Record<string, string> = {};
        for (const id of uniqueIds) {
          const url = getCachedAvatar(id);
          if (url) newMap[id] = url;
        }
        setPhotoMap(newMap);
        return;
      }

      const BATCH_SIZE = 5;
      for (let i = 0; i < toLoad.length; i += BATCH_SIZE) {
        if (cancelled) break;
        await Promise.allSettled(toLoad.slice(i, i + BATCH_SIZE).map((id) => downloadAvatar(client, id)));
        if (!cancelled) {
          const newMap: Record<string, string> = {};
          for (const id of uniqueIds) {
            const url = getCachedAvatar(id);
            if (url) newMap[id] = url;
          }
          setPhotoMap(newMap);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isTelegramConnected, calls.length]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMoreRef.current(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [calls.length]);

  // Group calls by date
  const groupedCalls = (() => {
    const groups: Record<string, typeof calls> = {};
    for (const call of calls) {
      const dateKey = new Date(call.date).toLocaleDateString("ru-RU", {
        day: "numeric", month: "long", year: "numeric",
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(call);
    }
    return groups;
  })();

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="mx-auto w-full max-w-lg px-4 py-3 flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView("chats")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Звонки</h1>
          </div>

          {/* Content */}
          {isLoading && calls.length === 0 ? (
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
                Повторить
              </Button>
            </div>
          ) : calls.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Phone className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-sm">Нет звонков</p>
            </div>
          ) : (
            <ScrollArea className="flex-1 min-h-0">
              {Object.entries(groupedCalls).map(([dateLabel, dateCalls]) => (
                <div key={dateLabel}>
                  <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-3 py-1.5">
                    <span className="text-xs font-semibold text-muted-foreground">{dateLabel}</span>
                  </div>
                  {dateCalls.map((call) => (
                    <CallListItem
                      key={call.id}
                      call={call}
                      photoUrl={photoMap[call.userId]}
                      onClick={() => selectChat(call.userId)}
                    />
                  ))}
                </div>
              ))}
              {/* Infinite scroll sentinel */}
              {hasMore && (
                <div ref={sentinelRef} className="py-2 flex justify-center">
                  {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                </div>
              )}
            </ScrollArea>
          )}
        </div>
      </div>

    </div>
  );
}
