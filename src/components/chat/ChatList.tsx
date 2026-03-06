"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatListItem } from "./ChatListItem";
import { TopicListItem } from "./TopicListItem";
import { SidebarHeader } from "./SidebarHeader";
import { FolderTabs } from "./FolderTabs";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { useDialogs } from "@/hooks/useDialogs";
import { useForumTopics } from "@/hooks/useForumTopics";
import { useUIStore } from "@/store/ui";
import { useFoldersStore } from "@/store/folders";
import { useCorporateStore } from "@/store/corporate";
import { useTelegramClient } from "@/hooks/useTelegramClient";
import type { TelegramDialog, TelegramForumTopic } from "@/types/telegram";
import { Search, Loader2, Users, Phone, MessageCircle, Settings, SlidersHorizontal } from "lucide-react";

/** Flat list item type: either a dialog row or a topic row */
type FlatItem =
  | { kind: "dialog"; dialog: TelegramDialog }
  | { kind: "topic"; topic: TelegramForumTopic; chatId: string };

export function ChatList() {
  const { dialogs, isLoading, isLoadingMore, hasMore, loadMore } = useDialogs();
  const {
    selectedChatId,
    selectedTopicId,
    expandedForumChatId,
    selectChat,
    selectTopic,
    expandForum,
    currentView,
    setCurrentView,
  } = useUIStore();
  const { client, isConnected } = useTelegramClient();
  const workspace = useCorporateStore((s) => s.workspace);
  const managedChatIds = useCorporateStore((s) => s.managedChatIds);
  const [filter, setFilter] = useState("");

  // Find the expanded forum dialog to get isForum flag
  const expandedDialog = expandedForumChatId
    ? dialogs.find((d) => d.id === expandedForumChatId)
    : null;

  // Load topics for expanded forum
  const { topics: expandedTopics, isLoading: isTopicsLoading } = useForumTopics(
    expandedForumChatId,
    expandedDialog?.isForum ?? false
  );

  // Shared folder state
  const { folders, selectedFolder, setFolders, setSelectedFolder } = useFoldersStore();

  const parentRef = useRef<HTMLDivElement>(null);

  // Load folders
  useEffect(() => {
    if (!client || !isConnected) return;

    (async () => {
      const { getDialogFilters } = await import("@/lib/telegram/dialogs");
      const filters = await getDialogFilters(client);
      if (filters.length > 0) {
        setFolders(filters);
      }
    })();
  }, [client, isConnected, setFolders]);

  // Reset folder selection when workspace changes
  useEffect(() => {
    setSelectedFolder(0);
  }, [workspace, setSelectedFolder]);

  // Compute folders with unread counts
  const foldersWithUnreads = useMemo(() => {
    if (folders.length === 0 || dialogs.length === 0) return folders;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { dialogMatchesFolder } = require("@/lib/telegram/dialogs");

    return folders.map((folder) => {
      if (folder.id === 0) return folder;
      // Telegram shows number of CHATS with unread messages, not total message count
      const unreadCount = dialogs
        .filter((d: typeof dialogs[0]) => dialogMatchesFolder(d, folder) && d.unreadCount > 0 && !d.isMuted)
        .length;
      return { ...folder, unreadCount };
    });
  }, [folders, dialogs]);

  // Filter folders by workspace using actual dialog membership:
  // - folder with ONLY managed chats → work only
  // - folder with ONLY non-managed chats → personal only
  // - folder with BOTH → shown in both workspaces
  const workspaceFolders = useMemo(() => {
    if (managedChatIds.size === 0) return foldersWithUnreads;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { dialogMatchesFolder } = require("@/lib/telegram/dialogs");

    return foldersWithUnreads.filter((folder) => {
      if (folder.id === 0) return true; // "Все чаты" always shown
      // Use dialogMatchesFolder to check actual membership (handles both includePeerIds AND flags)
      const matchingDialogs = dialogs.filter((d: typeof dialogs[0]) => dialogMatchesFolder(d, folder));
      const hasManagedChats = matchingDialogs.some((d: typeof dialogs[0]) => managedChatIds.has(d.id));
      const hasPersonalChats = matchingDialogs.some((d: typeof dialogs[0]) => !managedChatIds.has(d.id));
      // Mixed folders show in both workspaces
      if (hasManagedChats && hasPersonalChats) return true;
      return workspace === "work" ? hasManagedChats : hasPersonalChats;
    });
  }, [foldersWithUnreads, workspace, managedChatIds, dialogs]);

  // Filter dialogs by workspace, folder, and search text
  const filtered = useMemo(() => {
    let result = dialogs;

    // Workspace filtering: "work" shows only managed chats, "personal" hides them
    if (managedChatIds.size > 0) {
      if (workspace === "work") {
        result = result.filter((d) => managedChatIds.has(d.id));
      } else {
        result = result.filter((d) => !managedChatIds.has(d.id));
      }
    }

    if (selectedFolder !== 0 && folders.length > 0) {
      const folder = folders.find((f) => f.id === selectedFolder);
      if (folder) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { dialogMatchesFolder } = require("@/lib/telegram/dialogs");
        result = result.filter((d: typeof dialogs[0]) => dialogMatchesFolder(d, folder));
      }
    }

    if (filter) {
      result = result.filter((d) =>
        d.title.toLowerCase().includes(filter.toLowerCase())
      );
    }
    return result;
  }, [dialogs, filter, selectedFolder, folders, workspace, managedChatIds]);

  // Sort matching Telegram's behavior
  const sorted = useMemo(() => {
    const currentFolder = folders.find((f) => f.id === selectedFolder);
    const pinnedIds = currentFolder?.pinnedPeerIds || [];

    const getTime = (d: typeof filtered[0]): number => {
      const raw = d.lastMessage?.date;
      if (!raw) return 0;
      return raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
    };

    if (selectedFolder === 0 || pinnedIds.length === 0) {
      return [...filtered].sort((a, b) => {
        if (a.isPinned && b.isPinned) return a.apiOrder - b.apiOrder;
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const timeDiff = getTime(b) - getTime(a);
        return timeDiff !== 0 ? timeDiff : a.apiOrder - b.apiOrder;
      });
    }

    return [...filtered].sort((a, b) => {
      const aPinIdx = pinnedIds.indexOf(a.id);
      const bPinIdx = pinnedIds.indexOf(b.id);
      const aIsFolderPinned = aPinIdx !== -1;
      const bIsFolderPinned = bPinIdx !== -1;

      if (aIsFolderPinned !== bIsFolderPinned) return aIsFolderPinned ? -1 : 1;
      if (aIsFolderPinned && bIsFolderPinned) return aPinIdx - bPinIdx;
      const timeDiff = getTime(b) - getTime(a);
      return timeDiff !== 0 ? timeDiff : a.apiOrder - b.apiOrder;
    });
  }, [filtered, selectedFolder, folders]);

  // Build flat list with expanded forum topics inline (desktop only)
  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    for (const dialog of sorted) {
      items.push({ kind: "dialog", dialog });
      // If this forum is expanded, insert its topics after the dialog
      if (
        dialog.isForum &&
        expandedForumChatId === dialog.id &&
        expandedTopics.length > 0
      ) {
        for (const topic of expandedTopics) {
          if (topic.isHidden) continue; // Skip hidden General topic
          items.push({ kind: "topic", topic, chatId: dialog.id });
        }
      }
    }
    return items;
  }, [sorted, expandedForumChatId, expandedTopics]);

  // Virtualizer for performant list rendering
  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const item = flatItems[index];
      return item?.kind === "topic" ? 56 : 68;
    },
    overscan: 10,
  });

  // Infinite scroll: load more when near end of virtual list
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;
    if (
      lastItem.index >= flatItems.length - 10 &&
      hasMore &&
      !filter &&
      selectedFolder === 0 &&
      !isLoadingMore
    ) {
      loadMore();
    }
  }, [virtualItems, flatItems.length, hasMore, filter, selectedFolder, isLoadingMore, loadMore]);

  /** Handle click on a dialog in the list */
  const handleDialogClick = (dialog: TelegramDialog) => {
    if (dialog.isForum) {
      // Desktop: toggle inline expansion; Mobile: selectChat to show TopicsList
      const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
      if (isMobile) {
        selectChat(dialog.id);
      } else {
        expandForum(dialog.id);
      }
    } else {
      selectChat(dialog.id);
    }
  };

  /** Handle click on a topic */
  const handleTopicClick = (chatId: string, topicId: number) => {
    selectTopic(chatId, topicId);
  };

  return (
    <div className="flex h-full flex-col min-h-0">
      <SidebarHeader />

      {/* Workspace switcher (only visible when user has managed chats) */}
      <div className="px-2 pt-1 md:px-2">
        <WorkspaceSwitcher />
      </div>

      <div className="px-2 py-1 md:p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9 pr-14"
          />
          {!filter && (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded border border-border/50 font-mono pointer-events-none hidden md:inline-block">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      {/* Horizontal folder tabs — mobile only */}
      <FolderTabs
        folders={workspaceFolders}
        selectedFolder={selectedFolder}
        onSelectFolder={setSelectedFolder}
      />

      <div
        ref={parentRef}
        className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 [&:hover::-webkit-scrollbar-thumb]:bg-foreground/35"
      >
        <div className="px-1">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5 md:py-2.5">
                <Skeleton className="h-[3.125rem] w-[3.125rem] md:h-[3.375rem] md:w-[3.375rem] rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))
          ) : flatItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {filter ? "Чаты не найдены" : "Нет диалогов"}
            </div>
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
              {virtualItems.map((virtualRow) => {
                const item = flatItems[virtualRow.index];
                if (!item) return null;

                return (
                  <div
                    key={
                      item.kind === "dialog"
                        ? item.dialog.id
                        : `topic-${item.chatId}-${item.topic.id}`
                    }
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {item.kind === "dialog" ? (
                      <ChatListItem
                        dialog={item.dialog}
                        isSelected={
                          selectedChatId === item.dialog.id && !selectedTopicId
                        }
                        onClick={() => handleDialogClick(item.dialog)}
                        isForumExpanded={
                          item.dialog.isForum &&
                          expandedForumChatId === item.dialog.id
                        }
                      />
                    ) : (
                      <TopicListItem
                        topic={item.topic}
                        isSelected={
                          selectedChatId === item.chatId &&
                          selectedTopicId === item.topic.id
                        }
                        onClick={() =>
                          handleTopicClick(item.chatId, item.topic.id)
                        }
                      />
                    )}
                  </div>
                );
              })}
              {isLoadingMore && (
                <div
                  style={{ position: "absolute", top: `${virtualizer.getTotalSize()}px`, width: "100%" }}
                  className="py-2 flex justify-center"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Version info */}
      <div className="px-3 py-1 text-[10px] text-muted-foreground/50 text-center select-none">
        v{process.env.NEXT_PUBLIC_APP_VERSION} | {process.env.NEXT_PUBLIC_BUILD_DATE}
      </div>

      {/* Desktop bottom navigation bar — matches Telegram desktop */}
      <div className="hidden md:flex items-center justify-around border-t bg-background py-1.5">
        <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors" title="Фильтры">
          <SlidersHorizontal className="h-[18px] w-[18px]" />
        </button>
        <button
          className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${currentView === "contacts" ? "text-blue-500" : "text-muted-foreground"}`}
          title="Контакты"
          onClick={() => setCurrentView("contacts")}
        >
          <Users className="h-[18px] w-[18px]" />
        </button>
        <button
          className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${currentView === "calls" ? "text-blue-500" : "text-muted-foreground"}`}
          title="Звонки"
          onClick={() => setCurrentView("calls")}
        >
          <Phone className="h-[18px] w-[18px]" />
        </button>
        <button
          className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${currentView === "chats" && !selectedChatId ? "text-blue-500" : currentView === "chats" ? "text-blue-500" : "text-muted-foreground"}`}
          title="Чаты"
          onClick={() => { selectChat(null); setCurrentView("chats"); }}
        >
          <MessageCircle className="h-[18px] w-[18px]" />
        </button>
        <button
          className={`p-1.5 rounded-lg hover:bg-accent transition-colors ${currentView === "settings" ? "text-blue-500" : "text-muted-foreground"}`}
          title="Настройки"
          onClick={() => setCurrentView("settings")}
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  );
}
