"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { MessageCircle, Folder, FolderOpen, SlidersHorizontal } from "lucide-react";
import { useFoldersStore } from "@/store/folders";
import { useChatsStore } from "@/store/chats";
import { useCorporateStore } from "@/store/corporate";
import type { TelegramFolder } from "@/types/telegram";

function formatUnread(count: number): string {
  if (count >= 1000) return Math.floor(count / 1000) + "K";
  return count.toString();
}


/** Check if folder is the special "Unread" folder */
function isUnreadFolder(folder: TelegramFolder): boolean {
  const title = folder.title.toLowerCase();
  return title.includes("unread") || title.includes("непрочит");
}

export function FolderSidebar() {
  const { folders, selectedFolder, setSelectedFolder } = useFoldersStore();
  const { dialogs } = useChatsStore();
  const workspace = useCorporateStore((s) => s.workspace);
  const managedChatIds = useCorporateStore((s) => s.managedChatIds);

  // Compute unread counts per folder from loaded dialogs
  const foldersWithUnreads = useMemo(() => {
    if (folders.length === 0 || dialogs.length === 0) return folders;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { dialogMatchesFolder } = require("@/lib/telegram/dialogs");

    return folders.map((folder: TelegramFolder) => {
      if (folder.id === 0) return folder;
      // Telegram shows number of CHATS with unread, not total message count
      const unreadCount = dialogs
        .filter((d) => dialogMatchesFolder(d, folder) && d.unreadCount > 0 && !d.isMuted)
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

    return foldersWithUnreads.filter((folder: TelegramFolder) => {
      if (folder.id === 0) return true; // "Все чаты" always shown
      // Use dialogMatchesFolder to check actual membership (handles both includePeerIds AND flags)
      const matchingDialogs = dialogs.filter((d) => dialogMatchesFolder(d, folder));
      const hasManagedChats = matchingDialogs.some((d) => managedChatIds.has(d.id));
      const hasPersonalChats = matchingDialogs.some((d) => !managedChatIds.has(d.id));
      // Mixed folders show in both workspaces
      if (hasManagedChats && hasPersonalChats) return true;
      return workspace === "work" ? hasManagedChats : hasPersonalChats;
    });
  }, [foldersWithUnreads, workspace, managedChatIds, dialogs]);

  if (workspaceFolders.length <= 1) return null;

  return (
    <div className="hidden md:flex h-full w-[3.75rem] shrink-0 flex-col border-r bg-background">
      {/* Folder list — scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none py-1">
        {workspaceFolders.map((folder: TelegramFolder) => {
          const isSelected = selectedFolder === folder.id;
          const unread = folder.unreadCount && folder.unreadCount > 0 ? folder.unreadCount : 0;
          const isAllChats = folder.id === 0;
          const isWork = workspace === "work";
          const badgeColor = isWork ? "bg-teal-500" : "bg-blue-500";
          const accentColor = isWork ? "text-teal-500" : "text-blue-500";

          return (
            <button
              key={folder.id}
              onClick={() => setSelectedFolder(folder.id)}
              title={folder.title}
              className={cn(
                "relative flex w-full flex-col items-center py-1.5 px-1 transition-colors group"
              )}
            >
              {/* Icon — no circle background, just the icon */}
              <div className="relative flex h-6 w-8 items-center justify-center">
                {isAllChats ? (
                  <MessageCircle
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isSelected ? accentColor : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                ) : isUnreadFolder(folder) ? (
                  <FolderOpen
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isSelected ? accentColor : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                ) : (
                  <Folder
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isSelected ? accentColor : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                )}

                {/* Unread badge — positioned at top-right of the icon */}
                {unread > 0 && (
                  <span className={cn(
                    "absolute -top-1 -right-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white leading-none",
                    badgeColor
                  )}>
                    {formatUnread(unread)}
                  </span>
                )}
              </div>

              {/* Label */}
              <span className={cn(
                "text-[9px] leading-tight text-center max-w-[3.5rem] truncate block mt-0.5",
                isSelected ? `font-semibold ${accentColor}` : "text-muted-foreground"
              )}>
                {folder.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Settings button at bottom — sliders icon */}
      <div className="border-t py-2 flex justify-center">
        <button className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
          workspace === "work"
            ? "bg-teal-500/15 text-teal-500 hover:bg-teal-500/25"
            : "bg-blue-500/15 text-blue-500 hover:bg-blue-500/25"
        )}>
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
