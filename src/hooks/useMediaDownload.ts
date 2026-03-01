"use client";

import { useState, useCallback } from "react";
import { useTelegramClient } from "./useTelegramClient";

export function useMediaDownload() {
  const { client } = useTelegramClient();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [urls, setUrls] = useState<Record<string, string>>({});

  const download = useCallback(
    async (chatId: string, messageId: string, message: unknown) => {
      const key = `${chatId}:${messageId}`;

      // Return cached URL if available
      if (urls[key]) return urls[key];

      if (!client) throw new Error("Client not connected");

      const { getMediaWithFallback } = await import("@/lib/supabase/media-cache");
      const { downloadMedia } = await import("@/lib/telegram/media");
      const msg = message as import("telegram").Api.Message;

      const url = await getMediaWithFallback(chatId, messageId, async () => {
        const buffer = await downloadMedia(client, msg, (received, total) => {
          setProgress((prev) => ({
            ...prev,
            [key]: total > 0 ? Math.round((received / total) * 100) : 0,
          }));
        });
        return new Uint8Array(buffer);
      });

      setUrls((prev) => ({ ...prev, [key]: url }));
      setProgress((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });

      return url;
    },
    [client, urls]
  );

  return { download, progress, urls };
}
