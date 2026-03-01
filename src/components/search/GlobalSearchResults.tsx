"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUIStore } from "@/store/ui";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { GlobalSearchResults as GlobalSearchResultsType } from "@/types/telegram";
import { cn } from "@/lib/utils";
import { MessageCircle, Users, FileText } from "lucide-react";

interface Props {
  results: GlobalSearchResultsType;
  isLoading: boolean;
  error: string | null;
  query: string;
  photoMap: Record<string, string>;
}

const avatarColors = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500",
  "bg-teal-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500",
];

function getAvatarColor(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

export function GlobalSearchResults({ results, isLoading, error, query, photoMap }: Props) {
  const { selectChat } = useUIStore();

  if (!query.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FileText className="h-12 w-12 mb-3 opacity-20" />
        <p className="text-sm">Введите запрос для поиска</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-2 py-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="py-8 text-center text-sm text-destructive">{error}</p>;
  }

  const hasResults = results.contacts.length > 0 || results.messages.length > 0;

  if (!hasResults) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Ничего не найдено</p>;
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-1 py-2">
        {/* Contacts section */}
        {results.contacts.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
              <Users className="h-3.5 w-3.5" />
              Контакты и пользователи
            </div>
            {results.contacts.slice(0, 5).map((contact) => (
              <button
                key={contact.id}
                onClick={() => selectChat(contact.id)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent/80 transition-colors"
              >
                <Avatar className="h-9 w-9">
                  {photoMap[contact.id] && <AvatarImage src={photoMap[contact.id]} />}
                  <AvatarFallback className={cn("text-white text-xs", getAvatarColor(contact.id))}>
                    {(contact.firstName?.[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium truncate block">
                    {contact.firstName} {contact.lastName || ""}
                  </span>
                  {contact.username && (
                    <span className="text-xs text-muted-foreground">@{contact.username}</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Messages section */}
        {results.messages.length > 0 && (
          <div>
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase">
              <MessageCircle className="h-3.5 w-3.5" />
              Сообщения
            </div>
            {results.messages.map((msg) => (
              <button
                key={`${msg.chatId}-${msg.messageId}`}
                onClick={() => selectChat(msg.chatId)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent/80 transition-colors"
              >
                <Avatar className="h-9 w-9">
                  {photoMap[msg.chatId] && <AvatarImage src={photoMap[msg.chatId]} />}
                  <AvatarFallback className={cn("text-white text-xs", getAvatarColor(msg.chatId))}>
                    {(msg.chatTitle?.[0] || "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{msg.chatTitle}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {msg.date.toLocaleDateString("ru-RU")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{msg.text}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
