"use client";

import type { TelegramForumTopic } from "@/types/telegram";
import { cn, safeDate } from "@/lib/utils";
import { Pin, Lock } from "lucide-react";

interface TopicListItemProps {
  topic: TelegramForumTopic;
  isSelected: boolean;
  onClick: () => void;
}

/** Format time matching Telegram: 24h for today, short date for older */
function formatTime(raw: Date | string): string {
  const date = safeDate(raw);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (days === 1) return "Вчера";
  if (days < 7) {
    return date.toLocaleDateString("ru-RU", { weekday: "short" });
  }
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

/** Convert 0xRRGGBB to CSS color */
function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function TopicListItem({
  topic,
  isSelected,
  onClick,
}: TopicListItemProps) {
  const lastMsg = topic.lastMessage;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg pl-8 pr-3 py-1.5 md:py-2 text-left transition-colors overflow-hidden",
        "hover:bg-accent/80",
        isSelected && "bg-blue-500/15 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:hover:bg-blue-500/25"
      )}
    >
      {/* Topic icon: custom emoji or colored circle fallback */}
      {topic.iconEmojiUrl ? (
        <img
          src={topic.iconEmojiUrl}
          alt=""
          className="h-5 w-5 shrink-0 object-contain"
          loading="lazy"
        />
      ) : (
        <div
          className="h-5 w-5 rounded-full shrink-0 flex items-center justify-center"
          style={{ backgroundColor: hexColor(topic.iconColor) }}
        >
          {topic.isGeneral && (
            <span className="text-[10px] text-white font-bold">#</span>
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        {/* Row 1: Topic name + icons + time */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="truncate text-sm font-medium">
              {topic.title}
            </span>
            {topic.isPinned && (
              <Pin className="h-3 w-3 shrink-0 text-muted-foreground/60 rotate-45" />
            )}
            {topic.isClosed && (
              <Lock className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {lastMsg && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatTime(lastMsg.date)}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Preview + unread badge */}
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0 flex-1">
            {lastMsg ? (
              <p className="text-sm text-muted-foreground truncate leading-[1.3]">
                {lastMsg.senderName && (
                  <span className="text-foreground font-medium">
                    {lastMsg.senderName.split(" ")[0]}:{" "}
                  </span>
                )}
                {lastMsg.text || "Медиа"}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground truncate">
                Нет сообщений
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {topic.unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold bg-green-500 text-white">
                {topic.unreadCount > 99 ? "99+" : topic.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
