/**
 * Prefetch Queue
 *
 * Priority queue with deduplication for background media prefetch.
 * Items are sorted by priority (descending) and deduped by chatId:messageId.
 * Tracks processed items to avoid re-downloading.
 */

import { getCachedThumb } from "@/lib/telegram/media-cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrefetchItem {
  chatId: string;
  messageId: number;
  mediaType: "photo" | "video";
  priority: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_QUEUE_SIZE = 500;
const MAX_PROCESSED_KEYS = 5000;
const PROCESSED_EVICT_COUNT = 1000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Sorted queue (highest priority first) */
const queue: PrefetchItem[] = [];

/** Set of keys currently in the queue (for fast dedup check) */
const queuedKeys = new Set<string>();

/** Set of keys already processed (downloaded or skipped) */
const processedKeys = new Set<string>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeKey(chatId: string, messageId: number): string {
  return `${chatId}:${messageId}`;
}

/**
 * Binary search for insertion index to maintain descending priority order.
 * Returns the index where the new item should be inserted.
 */
function findInsertIndex(priority: number): number {
  let lo = 0;
  let hi = queue.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (queue[mid].priority >= priority) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add an item to the prefetch queue.
 * Skips if:
 * - Already in the queue
 * - Already processed
 * - Already cached in memory (thumbCache)
 */
export function enqueue(item: PrefetchItem): void {
  const key = makeKey(item.chatId, item.messageId);

  // Skip if already queued, processed, or cached
  if (queuedKeys.has(key)) return;
  if (processedKeys.has(key)) return;
  if (getCachedThumb(item.chatId, item.messageId)) {
    processedKeys.add(key);
    return;
  }

  // Enforce queue size limit — drop lowest priority item
  if (queue.length >= MAX_QUEUE_SIZE) {
    const dropped = queue.pop();
    if (dropped) {
      queuedKeys.delete(makeKey(dropped.chatId, dropped.messageId));
    }
  }

  // Insert at correct position (binary search for descending order)
  const idx = findInsertIndex(item.priority);
  queue.splice(idx, 0, item);
  queuedKeys.add(key);
}

/** Remove and return the highest-priority item from the queue. */
export function dequeue(): PrefetchItem | null {
  const item = queue.shift();
  if (!item) return null;
  queuedKeys.delete(makeKey(item.chatId, item.messageId));
  return item;
}

/** Get current queue size. */
export function queueSize(): number {
  return queue.length;
}

/** Check if an item is already in the queue or processed. */
export function has(chatId: string, messageId: number): boolean {
  const key = makeKey(chatId, messageId);
  return queuedKeys.has(key) || processedKeys.has(key);
}

/** Mark an item as processed (won't be re-enqueued). */
export function markProcessed(chatId: string, messageId: number): void {
  const key = makeKey(chatId, messageId);
  processedKeys.add(key);

  // Evict oldest processed keys when over limit
  if (processedKeys.size > MAX_PROCESSED_KEYS) {
    const iter = processedKeys.values();
    for (let i = 0; i < PROCESSED_EVICT_COUNT; i++) {
      const next = iter.next();
      if (next.done) break;
      processedKeys.delete(next.value);
    }
  }
}

/** Clear the entire queue (does NOT clear processed set). */
export function clearQueue(): void {
  queue.length = 0;
  queuedKeys.clear();
}
