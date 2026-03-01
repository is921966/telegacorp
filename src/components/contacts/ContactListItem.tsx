"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TelegramContact } from "@/types/telegram";
import { cn, safeDate } from "@/lib/utils";
import { useLazyAvatar } from "@/hooks/useLazyAvatar";

interface ContactListItemProps {
  contact: TelegramContact;
  onClick: () => void;
}

const avatarColors = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500",
  "bg-teal-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500",
];

function getAvatarColor(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function getInitials(firstName: string, lastName?: string): string {
  const f = firstName?.[0] || "";
  const l = lastName?.[0] || "";
  return (f + l).toUpperCase() || "?";
}

function formatLastSeen(date?: Date, isOnline?: boolean): { text: string; isOnline: boolean } {
  if (isOnline) return { text: "online", isOnline: true };
  if (!date) return { text: "last seen a long time ago", isOnline: false };
  const d = safeDate(date);
  const now = Date.now();
  const diff = now - d.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return { text: "last seen just now", isOnline: false };
  if (minutes < 60) return { text: `last seen ${minutes} minute${minutes !== 1 ? "s" : ""} ago`, isOnline: false };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { text: `last seen ${hours} hour${hours !== 1 ? "s" : ""} ago`, isOnline: false };
  const days = Math.floor(hours / 24);
  if (days === 1) return { text: "last seen yesterday", isOnline: false };
  if (days < 7) return { text: `last seen ${days} days ago`, isOnline: false };
  return { text: `last seen ${d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })}`, isOnline: false };
}

export function ContactListItem({ contact, onClick }: ContactListItemProps) {
  const { ref: avatarRef, avatarUrl: photoUrl } = useLazyAvatar(contact.id);
  const status = formatLastSeen(contact.lastSeen, contact.isOnline);

  return (
    <button
      ref={avatarRef}
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-[6px] text-left transition-colors hover:bg-accent/50 active:bg-accent/80"
    >
      <Avatar className="h-10 w-10 shrink-0">
        {photoUrl && <AvatarImage src={photoUrl} alt={contact.firstName} />}
        <AvatarFallback className={cn("text-white text-sm font-medium", getAvatarColor(contact.id))}>
          {getInitials(contact.firstName, contact.lastName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 border-b border-border/30 py-[6px]">
        <span className="block truncate text-[15px] font-normal leading-tight">
          {contact.firstName} {contact.lastName || ""}
        </span>
        <span className={cn(
          "block truncate text-[13px] leading-tight mt-0.5",
          status.isOnline ? "text-blue-500" : "text-muted-foreground"
        )}>
          {status.text}
        </span>
      </div>
    </button>
  );
}
