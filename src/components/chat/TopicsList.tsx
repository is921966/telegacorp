"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TopicListItem } from "./TopicListItem";
import { useForumTopics } from "@/hooks/useForumTopics";
import { useUIStore } from "@/store/ui";
import { useChatsStore } from "@/store/chats";
import { ArrowLeft, Search, Loader2 } from "lucide-react";

/**
 * Full-screen mobile topics list for a forum group.
 * Shown when a forum chat is selected but no topic is selected.
 */
export function TopicsList() {
  const { selectedChatId, selectChat, selectTopic } = useUIStore();
  const { dialogs } = useChatsStore();
  const dialog = dialogs.find((d) => d.id === selectedChatId);
  const { topics, isLoading } = useForumTopics(
    selectedChatId,
    dialog?.isForum ?? false
  );
  const [filter, setFilter] = useState("");

  if (!dialog || !selectedChatId) return null;

  const filteredTopics = filter
    ? topics.filter((t) =>
        t.title.toLowerCase().includes(filter.toLowerCase())
      )
    : topics;

  // Filter out hidden topics (hidden General)
  const visibleTopics = filteredTopics.filter((t) => !t.isHidden);

  return (
    <div className="flex h-full flex-col min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
        <button
          onClick={() => selectChat(null)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium truncate">{dialog.title}</h2>
          <p className="text-xs text-muted-foreground">
            {topics.length > 0
              ? `${topics.length} тем`
              : isLoading
              ? "Загрузка..."
              : "Нет тем"}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск тем"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Topics list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))
        ) : visibleTopics.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {filter ? "Темы не найдены" : "Нет тем"}
          </div>
        ) : (
          visibleTopics.map((topic) => (
            <TopicListItem
              key={topic.id}
              topic={topic}
              isSelected={false}
              onClick={() => selectTopic(selectedChatId, topic.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
