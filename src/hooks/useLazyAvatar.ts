"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAvatarsStore } from "@/store/avatars";
import { getConnectionQuality, onConnectionChange } from "@/lib/network";

// ---------------------------------------------------------------------------
// Shared IntersectionObserver — one for all avatar elements
// ---------------------------------------------------------------------------
let observer: IntersectionObserver | null = null;
const observerCallbacks = new Map<Element, () => void>();

function getObserver(): IntersectionObserver {
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const cb = observerCallbacks.get(entry.target);
            if (cb) {
              cb();
              observerCallbacks.delete(entry.target);
              observer!.unobserve(entry.target);
            }
          }
        }
      },
      { rootMargin: "300px" } // Start loading 300px before visible
    );
  }
  return observer;
}

// ---------------------------------------------------------------------------
// Download queue — batches avatar downloads with concurrency limit
// ---------------------------------------------------------------------------
const downloadQueue: string[] = [];
let isProcessing = false;
const FAST_CONCURRENCY = 5;
const SLOW_CONCURRENCY = 2;
let concurrency = getConnectionQuality() === "slow" ? SLOW_CONCURRENCY : FAST_CONCURRENCY;

// React to connection quality changes
if (typeof window !== "undefined") {
  onConnectionChange((quality) => {
    concurrency = quality === "slow" ? SLOW_CONCURRENCY : FAST_CONCURRENCY;
  });
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (downloadQueue.length > 0) {
    const batch = downloadQueue.splice(0, concurrency);
    try {
      const { getConnectedClient } = await import("@/lib/telegram/client");
      const client = await getConnectedClient();
      if (!client) break;

      const { downloadAvatar } = await import("@/lib/telegram/photos");
      await Promise.allSettled(batch.map((id) => downloadAvatar(client, id)));
    } catch {
      // Non-critical — avatars will retry on next visibility
    }
  }

  isProcessing = false;
}

function queueDownload(entityId: string) {
  const { avatars } = useAvatarsStore.getState();
  if (avatars[entityId] !== undefined) return; // already cached
  if (downloadQueue.includes(entityId)) return; // already queued
  downloadQueue.push(entityId);
  processQueue();
}

// ---------------------------------------------------------------------------
// Hook: useLazyAvatar
// ---------------------------------------------------------------------------
/**
 * Lazy-loads an avatar for the given entity ID using Intersection Observer.
 * Returns a ref callback (attach to the element) and the avatar URL.
 * Avatar is only downloaded when the element scrolls into view.
 */
export function useLazyAvatar(entityId: string) {
  // Subscribe to avatar changes for this specific entity
  const avatarUrl = useAvatarsStore((s) => {
    const val = s.avatars[entityId];
    return val ? val : undefined; // "" (no photo) → undefined
  });

  const elementRef = useRef<HTMLElement | null>(null);
  const entityIdRef = useRef(entityId);
  entityIdRef.current = entityId;

  const refCallback = useCallback((el: HTMLElement | null) => {
    // Cleanup previous element
    if (elementRef.current) {
      observerCallbacks.delete(elementRef.current);
      getObserver().unobserve(elementRef.current);
    }

    elementRef.current = el;
    if (!el) return;

    // If already cached, no need to observe
    const cached = useAvatarsStore.getState().avatars[entityIdRef.current];
    if (cached !== undefined) return;

    // Start observing — download will be queued when visible
    observerCallbacks.set(el, () => {
      queueDownload(entityIdRef.current);
    });
    getObserver().observe(el);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (elementRef.current) {
        observerCallbacks.delete(elementRef.current);
        getObserver().unobserve(elementRef.current);
      }
    };
  }, []);

  return { ref: refCallback, avatarUrl };
}
