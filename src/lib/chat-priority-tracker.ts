/**
 * Chat Priority Tracker
 *
 * Tracks how frequently the user opens each chat and computes
 * an exponentially-decayed priority score for prefetch ordering.
 * Persists to localStorage for cross-session continuity.
 */

import type { TelegramDialog } from "@/types/telegram";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = "tg-chat-frequency";
const DECAY_LAMBDA = 0.1; // ~10 day half-life
const PRUNE_AGE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface ChatEntry {
  opens: number;
  lastOpened: number; // timestamp
  decayedScore: number;
}

interface FrequencyData {
  chats: Record<string, ChatEntry>;
  lastPruned: number;
}

let data: FrequencyData = { chats: {}, lastPruned: 0 };
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// Load from localStorage on module init
if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      data = JSON.parse(raw);
    }
  } catch {
    // Corrupted — start fresh
  }
  pruneStaleEntries();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Record a chat open event. Debounced flush to localStorage. */
export function recordChatOpen(chatId: string): void {
  const now = Date.now();
  const entry = data.chats[chatId];

  if (entry) {
    const daysSinceLast = (now - entry.lastOpened) / MS_PER_DAY;
    // Decay old accumulated score, then add 1.0 for this open
    entry.decayedScore =
      entry.decayedScore * Math.exp(-DECAY_LAMBDA * daysSinceLast) + 1.0;
    entry.opens++;
    entry.lastOpened = now;
  } else {
    data.chats[chatId] = { opens: 1, lastOpened: now, decayedScore: 1.0 };
  }

  schedulePersist();
}

/** Get the priority score for a chat (higher = more important). */
export function getChatPriority(chatId: string): number {
  const entry = data.chats[chatId];
  if (!entry) return 0;

  // Apply decay from last open to now
  const daysSinceLast = (Date.now() - entry.lastOpened) / MS_PER_DAY;
  return entry.decayedScore * Math.exp(-DECAY_LAMBDA * daysSinceLast);
}

/**
 * Rank chats by prefetch priority.
 * Returns chatIds sorted: unread first (by unreadCount desc), then by frequency score desc.
 */
export function rankChatsForPrefetch(dialogs: TelegramDialog[]): string[] {
  const unread = dialogs.filter((d) => (d.unreadCount ?? 0) > 0);
  const read = dialogs.filter((d) => (d.unreadCount ?? 0) === 0);

  // Sort unread by unreadCount descending
  unread.sort((a, b) => (b.unreadCount ?? 0) - (a.unreadCount ?? 0));

  // Sort read by frequency score descending
  read.sort((a, b) => getChatPriority(b.id) - getChatPriority(a.id));

  return [...unread.map((d) => d.id), ...read.map((d) => d.id)];
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/** Remove entries not opened in the last 30 days. */
function pruneStaleEntries(): void {
  const now = Date.now();
  if (now - data.lastPruned < MS_PER_DAY) return; // Prune at most once per day

  const cutoff = now - PRUNE_AGE_DAYS * MS_PER_DAY;
  for (const chatId of Object.keys(data.chats)) {
    if (data.chats[chatId].lastOpened < cutoff) {
      delete data.chats[chatId];
    }
  }
  data.lastPruned = now;
  schedulePersist();
}

/** Debounced write to localStorage. */
function schedulePersist(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage full — non-critical
    }
  }, 2000);
}
