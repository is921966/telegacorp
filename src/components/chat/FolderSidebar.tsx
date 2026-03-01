"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { MessageCircle, Folder, FolderOpen, SlidersHorizontal } from "lucide-react";
import { useFoldersStore } from "@/store/folders";
import { useChatsStore } from "@/store/chats";
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

  if (foldersWithUnreads.length <= 1) return null;

  return (
    <div className="hidden md:flex h-full w-[3.75rem] shrink-0 flex-col border-r bg-background">
      {/* Folder list — scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none py-1">
        {foldersWithUnreads.map((folder: TelegramFolder) => {
          const isSelected = selectedFolder === folder.id;
          const unread = folder.unreadCount && folder.unreadCount > 0 ? folder.unreadCount : 0;
          const isAllChats = folder.id === 0;
          const badgeColor = "bg-blue-500";

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
                      isSelected ? "text-blue-500" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                ) : isUnreadFolder(folder) ? (
                  <FolderOpen
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isSelected ? "text-blue-500" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                ) : (
                  <Folder
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isSelected ? "text-blue-500" : "text-muted-foreground group-hover:text-foreground"
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
                isSelected ? "font-semibold text-blue-500" : "text-muted-foreground"
              )}>
                {folder.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Settings button at bottom — sliders icon with blue highlight */}
      <div className="border-t py-2 flex justify-center">
        <button className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 transition-colors">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
