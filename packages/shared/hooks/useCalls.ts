"use client";

import { useCallback, useEffect, useRef } from "react";
import { useCallsStore } from "../store/calls";
import { useAuthStore } from "../store/auth";

const CALLS_LIMIT = 50;
/** Consider cached data stale after 10 minutes */
const STALE_TIMEOUT = 10 * 60 * 1000;

export function useCalls() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const {
    calls, isLoading, hasMore, error, lastFetchedAt,
    setCalls, appendCalls, setLoading, setHasMore, setError,
  } = useCallsStore();
  const loadInProgress = useRef(false);

  const loadCalls = useCallback(async () => {
    if (!isTelegramConnected) return;
    if (loadInProgress.current) return;
    loadInProgress.current = true;

    const { getConnectedClient } = await import("../telegram/client");
    const client = await getConnectedClient();
    if (!client) {
      loadInProgress.current = false;
      return;
    }

    const hasCached = calls.length > 0;
    if (!hasCached) setLoading(true);

    try {
      const { getCallHistory } = await import("../telegram/calls");
      const result = await getCallHistory(client, CALLS_LIMIT);
      setCalls(result);
      setHasMore(result.length >= CALLS_LIMIT);
    } catch (err) {
      console.error("Failed to load calls:", err);
      if (!hasCached) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить звонки");
      }
    } finally {
      if (!hasCached) setLoading(false);
      loadInProgress.current = false;
    }
  }, [isTelegramConnected, calls.length, setCalls, setLoading, setHasMore, setError]);

  const loadMore = useCallback(async () => {
    if (!isTelegramConnected || isLoading || !hasMore || calls.length === 0) return;

    const { getConnectedClient } = await import("../telegram/client");
    const client = await getConnectedClient();
    if (!client) return;

    setLoading(true);
    try {
      const { getCallHistory } = await import("../telegram/calls");
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

  // Stale-while-revalidate: show cached calls, refresh in background
  useEffect(() => {
    if (!isTelegramConnected) return;

    const hasCached = calls.length > 0;
    const isStale = Date.now() - lastFetchedAt > STALE_TIMEOUT;

    if (!hasCached || isStale) {
      loadCalls();
    }
  }, [isTelegramConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  return { calls, isLoading, hasMore, error, loadCalls, loadMore };
}
