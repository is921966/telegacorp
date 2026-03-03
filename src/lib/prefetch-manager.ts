/**
 * Prefetch Manager
 *
 * Orchestrates background media thumbnail prefetching:
 * - Subscribes to messages store for new incoming media
 * - Computes priority via ChatPriorityTracker
 * - Feeds items into PrefetchQueue
 * - Schedules downloads via requestIdleCallback (with Safari fallback)
 * - Pauses on slow/offline networks
 * - Seeds queue with existing high-priority chats on init
 */

import { useMessagesStore } from "@/store/messages";
import { useChatsStore } from "@/store/chats";
import { useUIStore } from "@/store/ui";
import { getChatPriority, rankChatsForPrefetch } from "@/lib/chat-priority-tracker";
import { enqueue, dequeue, queueSize, markProcessed, clearQueue } from "@/lib/prefetch-queue";
import { downloadThumb } from "@/lib/telegram/media-cache";
import { onConnectionChange } from "@/lib/network";
import { onProfileChange } from "@/lib/network-profiler";
import type { TelegramMessage } from "@/types/telegram";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Boost added to unread chat priority so they always rank above read chats */
const UNREAD_PRIORITY_BOOST = 10_000;

/** Delay between consecutive downloads (ms) — ~5 thumbs/sec */
const DOWNLOAD_INTERVAL_MS = 200;

/** Max chats to seed from on startup */
const SEED_MAX_CHATS = 100;

/** Max recent media messages to seed per chat */
const SEED_MAX_MESSAGES_PER_CHAT = 3;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let paused = false;
let schedulerHandle: number | ReturnType<typeof setTimeout> | null = null;
let initialized = false;

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

const requestIdle: (cb: () => void) => number | ReturnType<typeof setTimeout> =
  typeof requestIdleCallback !== "undefined"
    ? (cb) => requestIdleCallback(cb, { timeout: 2000 })
    : (cb) => setTimeout(cb, 200);

const cancelIdle: (handle: number | ReturnType<typeof setTimeout>) => void =
  typeof cancelIdleCallback !== "undefined"
    ? (h) => cancelIdleCallback(h as number)
    : (h) => clearTimeout(h as ReturnType<typeof setTimeout>);

async function processNext(): Promise<void> {
  schedulerHandle = null;

  if (paused || queueSize() === 0) return;

  const item = dequeue();
  if (!item) return;

  try {
    const { getExistingClient } = await import("@/lib/telegram/client");
    const client = getExistingClient();
    if (!client) {
      // No client — re-enqueue and pause
      enqueue(item);
      return;
    }

    await downloadThumb(client, item.chatId, item.messageId);
  } catch {
    // Non-critical — skip this item
  } finally {
    markProcessed(item.chatId, item.messageId);
  }

  // Schedule next with a delay
  if (queueSize() > 0 && !paused) {
    schedulerHandle = setTimeout(() => {
      schedulerHandle = requestIdle(processNext);
    }, DOWNLOAD_INTERVAL_MS);
  }
}

function kickScheduler(): void {
  if (paused || schedulerHandle !== null || queueSize() === 0) return;
  schedulerHandle = requestIdle(processNext);
}

// ---------------------------------------------------------------------------
// Network awareness
// ---------------------------------------------------------------------------

function handleConnectionChange(quality: "fast" | "slow" | "offline"): void {
  if (quality === "offline" || quality === "slow") {
    paused = true;
    if (schedulerHandle !== null) {
      cancelIdle(schedulerHandle);
      schedulerHandle = null;
    }
  } else {
    paused = false;
    kickScheduler();
  }
}

function handleProfileChange(stats: { profile: string }): void {
  // Pause on profiles A and B (very bad / bad network: <=512kbps)
  if (stats.profile === "A" || stats.profile === "B") {
    paused = true;
    if (schedulerHandle !== null) {
      cancelIdle(schedulerHandle);
      schedulerHandle = null;
    }
  } else {
    paused = false;
    kickScheduler();
  }
}

// ---------------------------------------------------------------------------
// New message detection
// ---------------------------------------------------------------------------

function hasMedia(msg: TelegramMessage): "photo" | "video" | null {
  if (!msg.media) return null;
  if (msg.media.type === "photo") return "photo";
  if (msg.media.type === "video") return "video";
  return null;
}

function computePriority(chatId: string): number {
  const dialogs = useChatsStore.getState().dialogs;
  const dialog = dialogs.find((d) => d.id === chatId);
  const unreadBoost = (dialog?.unreadCount ?? 0) > 0 ? UNREAD_PRIORITY_BOOST : 0;
  return unreadBoost + getChatPriority(chatId);
}

// ---------------------------------------------------------------------------
// Seed existing chats on startup
// ---------------------------------------------------------------------------

function seedExistingChats(): void {
  const dialogs = useChatsStore.getState().dialogs;
  const messagesByChat = useMessagesStore.getState().messagesByChat;

  // Rank chats by priority (unread first, then frequency)
  const ranked = rankChatsForPrefetch(dialogs).slice(0, SEED_MAX_CHATS);

  for (const chatId of ranked) {
    const msgs = messagesByChat[chatId];
    if (!msgs || msgs.length === 0) continue;

    const priority = computePriority(chatId);

    // Find last N messages with media (iterate from end)
    let found = 0;
    for (let i = msgs.length - 1; i >= 0 && found < SEED_MAX_MESSAGES_PER_CHAT; i--) {
      const mediaType = hasMedia(msgs[i]);
      if (mediaType) {
        enqueue({
          chatId,
          messageId: msgs[i].id,
          mediaType,
          priority,
        });
        found++;
      }
    }
  }

  kickScheduler();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the background prefetch manager.
 * Returns a cleanup function to unsubscribe from all listeners.
 *
 * Should be called once after the Telegram client is connected
 * and dialogs are loaded (e.g., in useRealtimeUpdates).
 */
export function initPrefetchManager(): () => void {
  if (initialized) return () => {};
  initialized = true;

  const cleanups: Array<() => void> = [];

  // 1. Subscribe to network changes
  cleanups.push(onConnectionChange(handleConnectionChange));
  cleanups.push(onProfileChange(handleProfileChange));

  // 2. Track previous message counts per chat to detect new messages
  let prevMessageCounts: Record<string, number> = {};

  // Initialize counts from current state
  const currentMsgs = useMessagesStore.getState().messagesByChat;
  for (const [chatId, msgs] of Object.entries(currentMsgs)) {
    prevMessageCounts[chatId] = msgs.length;
  }

  // 3. Subscribe to messages store changes
  const unsubMessages = useMessagesStore.subscribe((state) => {
    const newCounts: Record<string, number> = {};

    for (const [chatId, msgs] of Object.entries(state.messagesByChat)) {
      const currentCount = msgs.length;
      newCounts[chatId] = currentCount;
      const prevCount = prevMessageCounts[chatId] ?? 0;

      if (currentCount > prevCount) {
        // New messages were added — check the newest ones for media
        const newMsgs = msgs.slice(prevCount);
        const priority = computePriority(chatId);

        // Skip if user is currently viewing this chat (will load naturally)
        const selectedChatId = useUIStore.getState().selectedChatId;
        if (chatId === selectedChatId) continue;

        for (const msg of newMsgs) {
          const mediaType = hasMedia(msg);
          if (mediaType) {
            enqueue({
              chatId,
              messageId: msg.id,
              mediaType,
              priority,
            });
          }
        }
      }
    }

    prevMessageCounts = newCounts;
    kickScheduler();
  });
  cleanups.push(unsubMessages);

  // 4. Seed queue with existing high-priority chats
  // Defer to avoid blocking the subscription setup
  setTimeout(seedExistingChats, 1000);

  // Return cleanup function
  return () => {
    initialized = false;
    for (const cleanup of cleanups) {
      cleanup();
    }

    if (schedulerHandle !== null) {
      cancelIdle(schedulerHandle);
      schedulerHandle = null;
    }

    clearQueue();
    paused = false;
  };
}
