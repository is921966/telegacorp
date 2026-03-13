"use client";

import { useCallback, useEffect, useRef } from "react";
import { useChatsStore } from "../store/chats";
import { useTelegramClient } from "./useTelegramClient";
import { isSlowConnection } from "../adapters/network";
import type { TelegramClient } from "telegram";

// Adaptive limits — reduced when slow connection is detected
const FAST_LIMITS = { initial: 100, batchSize: 200, maxTotal: 2000 };
const SLOW_LIMITS = { initial: 30, batchSize: 50, maxTotal: 500 };
/** Connection is considered slow if first batch takes > 3s */
const SLOW_THRESHOLD_MS = 3000;
/** Consider cached data stale after 10 minutes */
const STALE_TIMEOUT = 10 * 60 * 1000;

/** Detected connection speed — initialized from Network Information API, refined by timing */
let detectedLimits = isSlowConnection() ? SLOW_LIMITS : FAST_LIMITS;

/** Helper: find the OLDEST lastMessage.date (ms) among non-pinned dialogs */
function findOldestDateMs(
  dialogs: { isPinned?: boolean; lastMessage?: { date?: Date | string | number } }[]
): number {
  let oldest = Infinity;
  for (const d of dialogs) {
    if (d.isPinned) continue;
    const raw = d.lastMessage?.date;
    if (!raw) continue;
    const ms = raw instanceof Date ? raw.getTime() : new Date(raw as string | number).getTime();
    if (ms > 0 && ms < oldest) oldest = ms;
  }
  return oldest;
}

/**
 * Background batch load: progressively load ALL dialogs in batches.
 * GramJS can TIMEOUT on huge single requests (limit=2000), so we
 * paginate with offsetDate in smaller chunks, calling syncDialogs
 * after each batch to progressively populate the store.
 */
async function runBackgroundLoad(
  client: TelegramClient,
  startingDialogCount: number,
  cancelled: { current: boolean }
) {
  const { getDialogs } = await import("../telegram/dialogs");
  const BATCH = detectedLimits.batchSize;
  const MAX = detectedLimits.maxTotal;

  if (startingDialogCount >= MAX) return;

  // Start from the oldest dialog currently in the store
  let offsetMs = findOldestDateMs(useChatsStore.getState().dialogs);
  let batchOffset = offsetMs < Infinity ? Math.floor(offsetMs / 1000) : undefined;
  let totalInStore = startingDialogCount;

  while (totalInStore < MAX && !cancelled.current) {
    const batch = await getDialogs(client, BATCH, batchOffset);
    if (cancelled.current) break;

    if (batch.length === 0) {
      useChatsStore.getState().setHasMore(false);
      break;
    }

    useChatsStore.getState().syncDialogs(batch);
    const prevTotal = totalInStore;
    totalInStore = useChatsStore.getState().dialogs.length;

    // If no new dialogs were added after syncing, we've exhausted all dialogs.
    // This is more reliable than `batch.length < BATCH` because the Telegram API
    // can return fewer results than `limit` even when more dialogs exist.
    if (totalInStore <= prevTotal) {
      useChatsStore.getState().setHasMore(false);
      break;
    }

    const batchOldestMs = findOldestDateMs(batch);
    if (batchOldestMs < Infinity) {
      batchOffset = Math.floor(batchOldestMs / 1000);
    } else {
      break;
    }
  }
}

export function useDialogs() {
  const { client, isConnected } = useTelegramClient();
  const {
    dialogs, isLoading, isLoadingMore, hasMore, error, lastFetchedAt,
    setDialogs, syncDialogs, appendDialogs, setLoading, setLoadingMore, setHasMore, setError, updateDialog,
  } = useChatsStore();
  const loadInProgress = useRef(false);
  const bgLoadCancelled = useRef({ current: false });

  // --- Initial / stale-while-revalidate load + background batch load ---
  const loadDialogs = useCallback(async () => {
    if (!client || !isConnected) return;
    if (loadInProgress.current) return;
    loadInProgress.current = true;

    const hasCachedData = dialogs.length > 0;
    if (!hasCachedData) setLoading(true);

    try {
      const { getDialogs } = await import("../telegram/dialogs");

      const t0 = performance.now();
      const first = await getDialogs(client, detectedLimits.initial);
      const elapsed = performance.now() - t0;

      if (elapsed > SLOW_THRESHOLD_MS && detectedLimits === FAST_LIMITS) {
        detectedLimits = SLOW_LIMITS;
        console.log(`[useDialogs] Slow connection detected (${Math.round(elapsed)}ms), using reduced limits`);
      }

      if (hasCachedData) {
        syncDialogs(first);
      } else {
        setDialogs(first);
      }

      if (first.length < detectedLimits.initial) {
        setHasMore(false);
      } else {
        // Kick off background batch load to get remaining dialogs
        const storeCount = useChatsStore.getState().dialogs.length;
        if (storeCount < detectedLimits.maxTotal) {
          // Cancel any previous background load
          bgLoadCancelled.current.current = true;
          const cancelToken = { current: false };
          bgLoadCancelled.current = cancelToken;
          runBackgroundLoad(client, storeCount, cancelToken).catch((err) =>
            console.warn("[useDialogs] bgLoad error:", err)
          );
        }
      }
    } catch (err) {
      if (!hasCachedData) {
        setError(err instanceof Error ? err.message : "Failed to load dialogs");
      }
    } finally {
      loadInProgress.current = false;
    }
  }, [client, isConnected, dialogs.length, setDialogs, syncDialogs, setLoading, setError, setHasMore]);

  // --- Load more dialogs (infinite scroll) ---
  const loadMore = useCallback(async () => {
    if (!client || !isConnected || isLoadingMore || !hasMore) return;
    if (dialogs.length === 0) return;

    setLoadingMore(true);
    try {
      const { getDialogs } = await import("../telegram/dialogs");

      let offsetDate: number | undefined;
      const oldestMs = findOldestDateMs(dialogs);
      if (oldestMs < Infinity) {
        offsetDate = Math.floor(oldestMs / 1000);
      }

      const more = await getDialogs(client, detectedLimits.batchSize, offsetDate);

      if (more.length === 0) {
        setHasMore(false);
      } else {
        appendDialogs(more);
        if (more.length < detectedLimits.batchSize) {
          setHasMore(false);
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingMore(false);
    }
  }, [client, isConnected, isLoadingMore, hasMore, dialogs, appendDialogs, setLoadingMore, setHasMore]);

  // --- Trigger load when connected ---
  useEffect(() => {
    if (!isConnected || !client) return;

    const hasCachedData = dialogs.length > 0;
    const isStale = Date.now() - lastFetchedAt > STALE_TIMEOUT;

    if (!hasCachedData || isStale) {
      // No cache or stale — full reload (shows spinner only when no cache)
      loadDialogs();
    } else if (dialogs.length < detectedLimits.maxTotal) {
      // Cache is fresh but incomplete — continue background load
      bgLoadCancelled.current.current = true;
      const cancelToken = { current: false };
      bgLoadCancelled.current = cancelToken;
      runBackgroundLoad(client, dialogs.length, cancelToken).catch((err) =>
        console.warn("[useDialogs] bgLoad error:", err)
      );
    }

    return () => {
      bgLoadCancelled.current.current = true;
    };
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
