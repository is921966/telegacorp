"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useChatsStore } from "@/store/chats";
import { useUIStore } from "@/store/ui";
import { useCorporateStore } from "@/store/corporate";
import { useTopicsStore } from "@/store/topics";
import { Search, MoreVertical, ArrowLeft, Users, Settings, Trash2, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { useTelegramClient } from "@/hooks/useTelegramClient";
import { safeDate } from "@/lib/utils";
import { MonitoringToggle } from "./MonitoringToggle";

/** Format last seen in Russian */
function formatLastSeen(raw?: Date | string, isOnline?: boolean): string {
  if (isOnline) return "в сети";
  if (!raw) return "был(а) недавно";

  const date = safeDate(raw);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return "был(а) только что";
  if (mins < 60) return `был(а) ${mins} мин. назад`;
  if (hours < 24) {
    const timeStr = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `был(а) сегодня в ${timeStr}`;
  }
  if (days === 1) {
    const timeStr = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `был(а) вчера в ${timeStr}`;
  }
  return `был(а) ${date.toLocaleDateString("ru-RU")}`;
}

function formatParticipants(count?: number, type?: string): string {
  if (!count) return type === "channel" ? "канал" : "группа";
  if (type === "channel") {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M подписчиков`;
    if (count >= 1000) return `${Math.floor(count / 1000)}K подписчиков`;
    return `${count} подписчиков`;
  }
  if (count >= 1000) return `${Math.floor(count / 1000)}K участников`;
  return `${count} участников`;
}

export function ChatHeader() {
  const { selectedChatId, selectedTopicId, toggleSearch, toggleGroupInfo, setEditingGroupInfo, selectChat, selectTopic } = useUIStore();
  const { dialogs } = useChatsStore();
  const workspace = useCorporateStore((s) => s.workspace);
  const isManagedChat = useCorporateStore((s) => s.isManagedChat);
  const topicsByChat = useTopicsStore((s) => s.topicsByChat);
  const { client } = useTelegramClient();
  const dialog = dialogs.find((d) => d.id === selectedChatId);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const showMonitoring = workspace === "work" && selectedChatId && isManagedChat(selectedChatId);

  // Find the current topic if viewing a forum topic
  const currentTopic = selectedChatId && selectedTopicId
    ? topicsByChat[selectedChatId]?.find((t) => t.id === selectedTopicId)
    : null;

  // Load avatar photo for header
  useEffect(() => {
    if (!client || !selectedChatId) return;
    setPhotoUrl(undefined);
    (async () => {
      const { getCachedAvatar, downloadAvatar } = await import("@/lib/telegram/photos");
      const cached = getCachedAvatar(selectedChatId);
      if (cached) {
        setPhotoUrl(cached);
      } else {
        const url = await downloadAvatar(client, selectedChatId);
        if (url) setPhotoUrl(url);
      }
    })();
  }, [client, selectedChatId]);

  if (!dialog) return null;

  const initials = dialog.title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  // Status text
  let statusText: string;
  if (dialog.type === "user") {
    statusText = formatLastSeen(dialog.lastSeen, dialog.isOnline);
  } else {
    statusText = formatParticipants(dialog.participantsCount, dialog.type);
  }

  // Back navigation: when viewing a topic, go back to topic list
  const handleBack = () => {
    if (selectedTopicId && selectedChatId) {
      // Go back to forum topic list (mobile: shows TopicsList, desktop: expands inline)
      selectTopic(selectedChatId, null);
    } else {
      selectChat(null);
    }
  };

  // Header title and subtitle
  const headerTitle = currentTopic ? currentTopic.title : dialog.title;
  const headerSubtitle = currentTopic ? dialog.title : statusText;
  const subtitleClass = currentTopic
    ? "text-muted-foreground"
    : dialog.isOnline
      ? "text-blue-500"
      : "text-muted-foreground";

  return (
    <div className="flex h-14 items-center justify-between border-b px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className={selectedTopicId ? "" : "md:hidden"}
          onClick={handleBack}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {currentTopic ? (
          /* Topic emoji icon or colored circle fallback */
          currentTopic.iconEmojiUrl ? (
            <img
              src={currentTopic.iconEmojiUrl}
              alt=""
              className="h-9 w-9 shrink-0 object-contain"
            />
          ) : (
            <div
              className="h-9 w-9 rounded-full shrink-0 flex items-center justify-center"
              style={{ backgroundColor: `#${currentTopic.iconColor.toString(16).padStart(6, "0")}` }}
            >
              {currentTopic.isGeneral && (
                <span className="text-sm text-white font-bold">#</span>
              )}
            </div>
          )
        ) : (
          <div className="relative">
            <Avatar className="h-9 w-9">
              {photoUrl && <AvatarImage src={photoUrl} alt={dialog.title} />}
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            {dialog.isOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
            )}
          </div>
        )}
        <div>
          <h2 className="text-sm font-medium leading-none">{headerTitle}</h2>
          <p className={`text-xs mt-0.5 ${subtitleClass}`}>
            {headerSubtitle}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {/* AI Monitoring toggle — work workspace, managed chats only */}
        {showMonitoring && selectedChatId && (
          <MonitoringToggle chatId={selectedChatId} />
        )}
        <Button variant="ghost" size="icon" onClick={toggleSearch}>
          <Search className="h-4 w-4" />
        </Button>
        {(dialog.type === "group" || dialog.type === "channel") && !selectedTopicId && (
          <Button variant="ghost" size="icon" onClick={toggleGroupInfo}>
            <Users className="h-4 w-4" />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(dialog.type === "group" || dialog.type === "channel") && !selectedTopicId && (
              <DropdownMenuItem
                onClick={() => {
                  if (!useUIStore.getState().isGroupInfoOpen) {
                    toggleGroupInfo();
                  }
                  setTimeout(() => setEditingGroupInfo(true), 100);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Редактировать
              </DropdownMenuItem>
            )}
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Настройки
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Очистить чат
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
