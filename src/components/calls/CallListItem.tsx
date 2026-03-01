"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { TelegramCallRecord } from "@/types/telegram";
import { cn, safeDate } from "@/lib/utils";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video } from "lucide-react";

interface CallListItemProps {
  call: TelegramCallRecord;
  photoUrl?: string;
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

function formatCallDate(raw: Date | string): string {
  const date = safeDate(raw);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  if (days === 1) return "Вчера";
  if (days < 7) return date.toLocaleDateString("ru-RU", { weekday: "short" });
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} сек.`;
  return `${m} мин.${s > 0 ? ` ${s} сек.` : ""}`;
}

function getCallIcon(call: TelegramCallRecord) {
  const isMissed = call.reason === "missed" || call.reason === "busy";
  if (call.isVideo) return <Video className="h-4 w-4" />;
  if (isMissed) return <PhoneMissed className="h-4 w-4" />;
  if (call.isOutgoing) return <PhoneOutgoing className="h-4 w-4" />;
  return <PhoneIncoming className="h-4 w-4" />;
}

function getCallLabel(call: TelegramCallRecord): string {
  const isMissed = call.reason === "missed" || call.reason === "busy";
  if (isMissed && !call.isOutgoing) return "Пропущенный";
  if (isMissed && call.isOutgoing) return "Отменённый";
  if (call.isOutgoing) return "Исходящий";
  return "Входящий";
}

export function CallListItem({ call, photoUrl, onClick }: CallListItemProps) {
  const isMissed = call.reason === "missed" || call.reason === "busy";
  const initials = call.userName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/80"
    >
      <Avatar className="h-[3rem] w-[3rem] shrink-0">
        {photoUrl && <AvatarImage src={photoUrl} alt={call.userName} />}
        <AvatarFallback className={cn("text-white text-sm font-medium", getAvatarColor(call.userId))}>
          {initials || "?"}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={cn("truncate text-sm font-medium", isMissed && "text-red-500")}>
            {call.userName}
          </span>
          <span className="text-xs text-muted-foreground shrink-0 ml-2">
            {formatCallDate(call.date)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn(isMissed ? "text-red-500" : "text-green-500")}>
            {getCallIcon(call)}
          </span>
          <span>{getCallLabel(call)}</span>
          {call.duration > 0 && <span>({formatDuration(call.duration)})</span>}
          {call.isVideo && <span>видео</span>}
        </div>
      </div>

      <Phone className="h-5 w-5 shrink-0 text-blue-500" />
    </button>
  );
}
