"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "../store/auth";
import type { GlobalSearchResults } from "../types/telegram";

const EMPTY_RESULTS: GlobalSearchResults = { contacts: [], messages: [] };

export function useGlobalSearch() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!query.trim() || !isTelegramConnected) {
      setResults(EMPTY_RESULTS);
      setError(null);
      return;
    }

    cancelledRef.current = true; // cancel previous
    let localCancelled = false;
    cancelledRef.current = false;

    const debounce = setTimeout(async () => {
      const { getConnectedClient } = await import("../telegram/client");
      const client = await getConnectedClient();
      if (!client || localCancelled) return;

      setIsLoading(true);
      setError(null);

      try {
        const { searchGlobalStructured } = await import("../telegram/search");
        const found = await searchGlobalStructured(client, query.trim());
        if (!localCancelled && !cancelledRef.current) {
          setResults(found);
        }
      } catch (err) {
        if (!localCancelled) {
          console.error("Global search failed:", err);
          setError(err instanceof Error ? err.message : "Ошибка поиска");
        }
      } finally {
        if (!localCancelled) setIsLoading(false);
      }
    }, 400);

    return () => {
      localCancelled = true;
      clearTimeout(debounce);
    };
  }, [query, isTelegramConnected]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults(EMPTY_RESULTS);
    setError(null);
  }, []);

  return { query, setQuery, results, isLoading, error, clearSearch };
}
