"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth";

export function useTelegramClient() {
  const [client, setClient] = useState<import("telegram").TelegramClient | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const restoreAttempted = useRef(false);
  const { isTelegramConnected, setTelegramConnected, setTelegramUser, supabaseUser } =
    useAuthStore();

  // Try to pick up the in-memory singleton on every render (no deps needed)
  useEffect(() => {
    import("@/lib/telegram/client").then(({ getExistingClient }) => {
      const existing = getExistingClient();
      if (existing && !client) {
        setClient(existing);
      }
    });
  }); // intentionally no deps — cheap check, runs on every render

  // Auto-restore from Supabase when supabaseUser becomes available
  useEffect(() => {
    if (restoreAttempted.current) return;
    if (!supabaseUser?.id) return; // wait for auth store to hydrate

    restoreAttempted.current = true;

    // Only restore if we don't already have a client
    import("@/lib/telegram/client").then(async ({ getExistingClient, connectClient }) => {
      if (getExistingClient()) return; // already connected

      try {
        const { loadTelegramSession } = await import("@/lib/supabase/session-store");
        const savedSession = await loadTelegramSession(
          supabaseUser.id,
          supabaseUser.id
        );
        if (savedSession) {
          const tgClient = await connectClient(savedSession);
          const { getMe } = await import("@/lib/telegram/auth");
          const me = await getMe(tgClient);
          setClient(tgClient);
          setTelegramUser(me);
          setTelegramConnected(true);
        }
      } catch {
        // Session expired or network error — silent fail
      }
    });
  }, [supabaseUser?.id, setTelegramConnected, setTelegramUser, client]);

  const connect = async (sessionString = "") => {
    setIsConnecting(true);
    try {
      const { connectClient } = await import("@/lib/telegram/client");
      const tgClient = await connectClient(sessionString);
      setClient(tgClient);
      setTelegramConnected(true);
      return tgClient;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    const { disconnectClient } = await import("@/lib/telegram/client");
    await disconnectClient();
    setClient(null);
    setTelegramConnected(false);
  };

  return {
    client,
    isConnected: isTelegramConnected,
    isConnecting,
    connect,
    disconnect,
  };
}
