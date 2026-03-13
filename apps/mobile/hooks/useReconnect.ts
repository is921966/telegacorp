import { useCallback } from "react";
import { useAppState } from "./useAppState";

/**
 * Auto-reconnects GramJS client when app returns from background.
 * GramJS WebSocket may disconnect during iOS background suspension.
 */
export function useReconnect() {
  const handleForeground = useCallback(async () => {
    try {
      const { getTelegramClient } = await import(
        "@corp/shared/telegram/client"
      );
      const client = getTelegramClient();
      if (client && !client.connected) {
        console.log("[Reconnect] App foregrounded — reconnecting GramJS...");
        await client.connect();
        console.log("[Reconnect] GramJS reconnected");
      }
    } catch (err) {
      console.error("[Reconnect] Error:", err);
    }
  }, []);

  useAppState({ onForeground: handleForeground });
}
