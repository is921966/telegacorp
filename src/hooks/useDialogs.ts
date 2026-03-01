"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChatsStore } from "@/store/chats";
import { useTelegramClient } from "./useTelegramClient";

// Adaptive limits — reduced when slow connection is detected
const FAST_LIMITS = { initial: 100, background: 2000, loadMore: 200 };
const SLOW_LIMITS = { initial: 30, background: 500, loadMore: 50 };
/** Connection is considered slow if first batch takes > 3s */
const SLOW_THRESHOLD_MS = 3000;
/** Consider cached data stale after 10 minutes */
const STALE_TIMEOUT = 10 * 60 * 1000;

/** Detected connection speed — persists for the session */
let detectedLimits = FAST_LIMITS;

export function useDialogs() {
  const { client, isConnected } = useTelegramClient();
  const {
    dialogs, isLoading, isLoadingMore, hasMore, error, lastFetchedAt,
    setDialogs, appendDialogs, setLoading, setLoadingMore, setHasMore, setError, updateDialog,
  } = useChatsStore();
  const extendedLoadDone = useRef(false);
  const loadInProgress = useRef(false);

  const loadDialogs = useCallback(async () => {
    if (!client || !isConnected) return;
    if (loadInProgress.current) return;
    loadInProgress.current = true;

    const hasCachedData = dialogs.length > 0;
    // Only show loading spinner if no cached data
    if (!hasCachedData) setLoading(true);

    try {
      const { getDialogs } = await import("@/lib/telegram/dialogs");

      // Measure first batch time to detect slow connection
      const t0 = performance.now();
      const first = await getDialogs(client, detectedLimits.initial);
      const elapsed = performance.now() - t0;

      // Adapt limits for slow connections
      if (elapsed > SLOW_THRESHOLD_MS && detectedLimits === FAST_LIMITS) {
        detectedLimits = SLOW_LIMITS;
        console.info(`[useDialogs] Slow connection detected (${Math.round(elapsed)}ms), using reduced limits`);
      }

      setDialogs(first);

      // Background: load extended set so folder filtering covers all contacts
      if (first.length >= detectedLimits.initial && !extendedLoadDone.current) {
        extendedLoadDone.current = true;
        (async () => {
          try {
            const all = await getDialogs(client, detectedLimits.background);
            if (all.length > first.length) {
              setDialogs(all);
            }
            if (all.length < detectedLimits.background) {
              setHasMore(false);
            }
          } catch {
            // Non-critical
          }
        })();
      } else if (first.length < detectedLimits.initial) {
        setHasMore(false);
      }
    } catch (err) {
      // If we have cached data, silently ignore the error
      if (!hasCachedData) {
        setError(err instanceof Error ? err.message : "Failed to load dialogs");
      }
    } finally {
      loadInProgress.current = false;
    }
  }, [client, isConnected, dialogs.length, setDialogs, setLoading, setError, setHasMore]);

  // Load more dialogs (infinite scroll)
  const loadMore = useCallback(async () => {
    if (!client || !isConnected || isLoadingMore || !hasMore) return;
    if (dialogs.length === 0) return;

    setLoadingMore(true);
    try {
      const { getDialogs } = await import("@/lib/telegram/dialogs");

      // Use the last dialog's message date as offset
      // Handle Date prototype loss from Zustand persist
      const lastDialog = dialogs[dialogs.length - 1];
      const rawDate = lastDialog.lastMessage?.date;
      let offsetDate: number | undefined;
      if (rawDate) {
        const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
        offsetDate = Math.floor(d.getTime() / 1000);
      }

      const more = await getDialogs(client, detectedLimits.loadMore, offsetDate);

      if (more.length === 0) {
        setHasMore(false);
      } else {
        appendDialogs(more);
        if (more.length < detectedLimits.loadMore) {
          setHasMore(false);
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingMore(false);
    }
  }, [client, isConnected, isLoadingMore, hasMore, dialogs, appendDialogs, setLoadingMore, setHasMore]);

  // Stale-while-revalidate: show cached data immediately, refresh in background
  useEffect(() => {
    if (!isConnected || !client) return;

    const hasCachedData = dialogs.length > 0;
    const isStale = Date.now() - lastFetchedAt > STALE_TIMEOUT;

    // Load if: no cached data, OR cache is stale
    if (!hasCachedData || isStale) {
      loadDialogs();
    }
  }, [isConnected, client]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    dialogs,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadDialogs,
    loadMore,
    updateDialog,
  };
}
