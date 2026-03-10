"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth";

export function useTelegramClient() {
  const [client, setClient] = useState<import("telegram").TelegramClient | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const { isTelegramConnected, setTelegramConnected } = useAuthStore();

  // Pick up the in-memory singleton from TelegramSessionProvider on every render
  useEffect(() => {
    import("@/lib/telegram/client").then(({ getExistingClient }) => {
      const existing = getExistingClient();
      if (existing && !client) {
        setClient(existing);
      }
    });
  }); // intentionally no deps — cheap check, runs on every render

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
