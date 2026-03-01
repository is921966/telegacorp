"use client";

import { useEffect, useState } from "react";
import { useUIStore } from "@/store/ui";
import { useTelegramClient } from "@/hooks/useTelegramClient";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { TelegramMessage } from "@/types/telegram";

export function SearchResults() {
  const { searchQuery, selectedChatId, isSearchOpen } = useUIStore();
  const { client } = useTelegramClient();
  const [results, setResults] = useState<TelegramMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!searchQuery || !client || !selectedChatId || !isSearchOpen) {
      setResults([]);
      setError(null);
      return;
    }

    let cancelled = false;

    const debounce = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      // Race between search and a 10-second timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Search timed out")), 10000)
      );

      try {
        const { searchMessages } = await import("@/lib/telegram/search");
        const found = await Promise.race([
          searchMessages(client, selectedChatId, searchQuery),
          timeoutPromise,
        ]);
        if (!cancelled) setResults(found);
      } catch (err) {
        console.error("Search failed:", err);
        if (!cancelled) {
          setError(err instanceof Error && err.message.includes("timed out")
            ? "Search timed out. Please try again."
            : "Search failed. Check your connection.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [searchQuery, client, selectedChatId, isSearchOpen]);

  if (!isSearchOpen || !searchQuery) return null;

  return (
    <ScrollArea className="max-h-60 border-b">
      <div className="p-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-3 py-2">
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))
        ) : error ? (
          <p className="py-4 text-center text-sm text-destructive">
            {error}
          </p>
        ) : results.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No messages found
          </p>
        ) : (
          results.map((msg) => (
            <button
              key={msg.id}
              className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted transition-colors"
            >
              <p className="text-sm truncate">{msg.text}</p>
              <p className="text-xs text-muted-foreground">
                {msg.date.toLocaleDateString()} {msg.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </button>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
