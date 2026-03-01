"use client";

import { useState, useEffect } from "react";
import { useTelegramClient } from "@/hooks/useTelegramClient";
import { useChatsStore } from "@/store/chats";
import { X, Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PinnedBannerProps {
  chatId: string;
  onClickMessage?: (messageId: number) => void;
}

export function PinnedBanner({ chatId, onClickMessage }: PinnedBannerProps) {
  const { client, isConnected } = useTelegramClient();
  const { dialogs } = useChatsStore();
  const [pinned, setPinned] = useState<{ id: number; text: string; senderName?: string }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const dialog = dialogs.find((d) => d.id === chatId);

  useEffect(() => {
    if (!client || !isConnected || !chatId) return;
    setPinned([]);
    setCurrentIndex(0);
    setDismissed(false);

    (async () => {
      const { getPinnedMessages } = await import("@/lib/telegram/dialogs");
      const msgs = await getPinnedMessages(client, chatId);
      setPinned(msgs);
    })();
  }, [client, isConnected, chatId]);

  if (dismissed || pinned.length === 0) return null;

  const current = pinned[currentIndex] || pinned[0];

  const initials = (dialog?.title || "?")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className="flex items-center gap-2.5 border-b bg-background/80 backdrop-blur-sm px-4 py-2 cursor-pointer"
      onClick={() => {
        if (pinned.length > 1) {
          setCurrentIndex((i) => (i + 1) % pinned.length);
        }
        onClickMessage?.(current.id);
      }}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {dialog?.photoUrl && (
          <AvatarImage src={dialog.photoUrl} alt={dialog.title} />
        )}
        <AvatarFallback className="text-[10px] bg-blue-500 text-white">
          {initials}
        </AvatarFallback>
      </Avatar>

      <Pin className="h-4 w-4 text-blue-500 shrink-0 rotate-45" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-blue-500">
          Закреплённое сообщение
          {pinned.length > 1 && (
            <span className="text-muted-foreground font-normal">
              {" "}#{currentIndex + 1} из {pinned.length}
            </span>
          )}
        </p>
        <p className="text-sm truncate text-foreground">{current.text || "Медиа"}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          setDismissed(true);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
