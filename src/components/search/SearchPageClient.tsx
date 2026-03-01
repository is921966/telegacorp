"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlobalSearchResults } from "@/components/search/GlobalSearchResults";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import { ArrowLeft, Search, X } from "lucide-react";

export function SearchPageClient() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const { setCurrentView } = useUIStore();
  const { query, setQuery, results, isLoading, error, clearSearch } = useGlobalSearch();
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});

  // Load avatars for search results (get client from module singleton)
  useEffect(() => {
    if (!isTelegramConnected) return;
    const ids = [
      ...results.contacts.map((c) => c.id),
      ...results.messages.map((m) => m.chatId),
    ];
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const { getConnectedClient } = await import("@/lib/telegram/client");
      const client = await getConnectedClient();
      if (!client || cancelled) return;

      const { downloadAvatar, getCachedAvatar } = await import("@/lib/telegram/photos");
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
  }, [isTelegramConnected, results]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="mx-auto w-full max-w-lg px-4 py-3 flex flex-col flex-1 min-h-0">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <Button variant="ghost" size="icon" onClick={() => setCurrentView("chats")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-semibold">Поиск</h1>
          </div>

          {/* Search input */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по чатам и сообщениям..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
              autoFocus
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Results */}
          <GlobalSearchResults
            results={results}
            isLoading={isLoading}
            error={error}
            query={query}
            photoMap={photoMap}
          />
        </div>
      </div>

    </div>
  );
}
