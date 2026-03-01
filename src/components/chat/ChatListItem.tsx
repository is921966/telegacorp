"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TelegramDialog } from "@/types/telegram";
import { cn, safeDate } from "@/lib/utils";
import {
  Pin,
  Check,
  CheckCheck,
  BellOff,
  BadgeCheck,
  Star,
  Image,
  Video,
  FileText,
  Mic,
  Music,
  MapPin,
  Contact,
  BarChart3,
  Film,
  Hash,
} from "lucide-react";

interface ChatListItemProps {
  dialog: TelegramDialog;
  isSelected: boolean;
  onClick: () => void;
  photoUrl?: string;
}

function getInitials(title: string): string {
  return title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
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

const avatarColors = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-green-500",
  "bg-teal-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-purple-500",
];

function getAvatarColor(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

/** Media type icon and label for preview */
function getMediaLabel(
  mediaType: NonNullable<TelegramDialog["lastMessage"]>["mediaType"]
): { icon: React.ReactNode; label: string } | null {
  if (!mediaType) return null;
  const size = "h-3.5 w-3.5";
  switch (mediaType) {
    case "photo":
      return { icon: <Image className={size} />, label: "Фото" };
    case "video":
      return { icon: <Video className={size} />, label: "Видео" };
    case "document":
      return { icon: <FileText className={size} />, label: "Файл" };
    case "voice":
      return { icon: <Mic className={size} />, label: "Голосовое" };
    case "audio":
      return { icon: <Music className={size} />, label: "Аудио" };
    case "sticker":
      return { icon: null, label: "Стикер" };
    case "gif":
      return { icon: <Film className={size} />, label: "GIF" };
    case "contact":
      return { icon: <Contact className={size} />, label: "Контакт" };
    case "location":
      return { icon: <MapPin className={size} />, label: "Геопозиция" };
    case "poll":
      return { icon: <BarChart3 className={size} />, label: "Опрос" };
    default:
      return null;
  }
}

export function ChatListItem({
  dialog,
  isSelected,
  onClick,
  photoUrl,
}: ChatListItemProps) {
  const lastMsg = dialog.lastMessage;
  const mediaLabel = lastMsg?.mediaType ? getMediaLabel(lastMsg.mediaType) : null;

  const renderPreview = () => {
    // Draft takes priority
    if (dialog.hasDraft && dialog.draftText !== undefined) {
      return (
        <p className="text-sm line-clamp-2 leading-[1.3]">
          <span className="text-red-500 font-medium">Черновик: </span>
          <span className="text-muted-foreground">{dialog.draftText}</span>
        </p>
      );
    }

    if (!lastMsg) {
      return (
        <p className="truncate text-sm text-muted-foreground">Нет сообщений</p>
      );
    }

    return (
      <p className="text-sm text-muted-foreground line-clamp-2 leading-[1.3]">
        {/* Sender name for groups */}
        {lastMsg.senderName && dialog.type !== "user" && (
          <span className="text-foreground font-medium">
            {lastMsg.senderName.split(" ")[0]}:{" "}
          </span>
        )}
        {lastMsg.isOutgoing && dialog.type === "user" && (
          <span className="text-foreground font-medium">Вы: </span>
        )}
        {/* Media type indicator */}
        {mediaLabel && (
          <span className="inline-flex items-center gap-0.5 text-blue-400">
            {mediaLabel.icon}
            {mediaLabel.label}
            {lastMsg.text ? " " : ""}
          </span>
        )}
        {/* Message text */}
        {lastMsg.text}
      </p>
    );
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-1.5 md:py-2.5 text-left transition-colors overflow-hidden",
        "hover:bg-accent/80",
        isSelected && "bg-blue-500/15 hover:bg-blue-500/20 dark:bg-blue-500/20 dark:hover:bg-blue-500/25"
      )}
    >
      {/* Avatar with online indicator */}
      <div className="relative shrink-0">
        <Avatar className="h-[3.125rem] w-[3.125rem] md:h-[3.375rem] md:w-[3.375rem]">
          {photoUrl && (
            <AvatarImage src={photoUrl} alt={dialog.title} />
          )}
          <AvatarFallback
            className={cn(
              "text-white text-sm font-medium",
              getAvatarColor(dialog.id)
            )}
          >
            {getInitials(dialog.title)}
          </AvatarFallback>
        </Avatar>
        {/* Online dot */}
        {dialog.isOnline && (
          <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background bg-green-500" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {/* Row 1: Name + verified/forum + muted + time */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className="truncate text-sm font-medium">
              {dialog.title}
            </span>
            {dialog.isPremium && !dialog.isVerified && (
              <Star className="h-3.5 w-3.5 shrink-0 text-violet-500 fill-violet-500" />
            )}
            {dialog.isVerified && (
              <BadgeCheck className="h-4 w-4 shrink-0 text-blue-500" />
            )}
            {dialog.isForum && (
              <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            )}
            {dialog.isMuted && (
              <BellOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {/* Outgoing read status */}
            {lastMsg?.isOutgoing && !dialog.hasDraft && (
              lastMsg.isRead ? (
                <CheckCheck className="h-4 w-4 text-blue-500" />
              ) : (
                <Check className="h-4 w-4 text-muted-foreground" />
              )
            )}
            {lastMsg && (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatTime(lastMsg.date)}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Preview + badge/pin/OPEN */}
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0 flex-1">{renderPreview()}</div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {/* Bot OPEN button */}
            {dialog.isBot && dialog.hasBotApp && (
              <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-500 uppercase">
                Open
              </span>
            )}
            {/* Unread mentions badge */}
            {dialog.unreadMentionsCount > 0 && (
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                  dialog.isMuted
                    ? "bg-muted-foreground/30 text-muted-foreground"
                    : "bg-blue-500 text-white"
                )}
              >
                @
              </span>
            )}
            {/* Unread count badge */}
            {dialog.unreadCount > 0 && (
              <span
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                  dialog.isMuted
                    ? "bg-muted-foreground/30 text-muted-foreground"
                    : "bg-green-500 text-white"
                )}
              >
                {dialog.unreadCount > 999
                  ? `${Math.floor(dialog.unreadCount / 1000)}K`
                  : dialog.unreadCount > 99
                  ? "99+"
                  : dialog.unreadCount}
              </span>
            )}
            {/* Pin icon (only when no unread badge) */}
            {dialog.isPinned && dialog.unreadCount === 0 && !dialog.hasBotApp && (
              <Pin className="h-4 w-4 text-muted-foreground/60 rotate-45" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
