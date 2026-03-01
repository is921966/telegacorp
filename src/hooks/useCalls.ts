"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCallsStore } from "@/store/calls";
import { useAuthStore } from "@/store/auth";

const CALLS_LIMIT = 50;

export function useCalls() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const {
    calls, isLoading, hasMore, error,
    setCalls, appendCalls, setLoading, setHasMore, setError,
  } = useCallsStore();
  const loaded = useRef(false);

  const loadCalls = useCallback(async () => {
    if (!isTelegramConnected) return;

    const { getConnectedClient } = await import("@/lib/telegram/client");
    const client = await getConnectedClient();
    if (!client) return;

    setLoading(true);
    try {
      const { getCallHistory } = await import("@/lib/telegram/calls");
      const result = await getCallHistory(client, CALLS_LIMIT);
      setCalls(result);
      setHasMore(result.length >= CALLS_LIMIT);
      loaded.current = true;
    } catch (err) {
      console.error("Failed to load calls:", err);
      setError(err instanceof Error ? err.message : "Не удалось загрузить звонки");
    } finally {
      setLoading(false);
    }
  }, [isTelegramConnected, setCalls, setLoading, setHasMore, setError]);

  const loadMore = useCallback(async () => {
    if (!isTelegramConnected || isLoading || !hasMore || calls.length === 0) return;

    const { getConnectedClient } = await import("@/lib/telegram/client");
    const client = await getConnectedClient();
    if (!client) return;

    setLoading(true);
    try {
      const { getCallHistory } = await import("@/lib/telegram/calls");
      const lastCall = calls[calls.length - 1];
      const more = await getCallHistory(client, CALLS_LIMIT, lastCall.id);
      if (more.length === 0) {
        setHasMore(false);
      } else {
        appendCalls(more);
        setHasMore(more.length >= CALLS_LIMIT);
      }
    } catch {
      // Non-critical, don't break UI
    } finally {
      setLoading(false);
    }
  }, [isTelegramConnected, isLoading, hasMore, calls, appendCalls, setLoading, setHasMore]);

  useEffect(() => {
    if (isTelegramConnected && !loaded.current && calls.length === 0) {
      loadCalls();
    }
  }, [isTelegramConnected, calls.length, loadCalls]);

  return { calls, isLoading, hasMore, error, loadCalls, loadMore };
}
