"use client";

import { cn } from "@/lib/utils";
import { useCorporateStore } from "@/store/corporate";
import type { TelegramFolder } from "@/types/telegram";

interface FolderTabsProps {
  folders: TelegramFolder[];
  selectedFolder: number;
  onSelectFolder: (folderId: number) => void;
}

function formatUnread(count: number): string {
  if (count >= 1000) return Math.floor(count / 1000) + "K";
  return count.toString();
}

/** Horizontal folder tabs — shown only on mobile (hidden on md+) */
export function FolderTabs({ folders, selectedFolder, onSelectFolder }: FolderTabsProps) {
  const isWorkMode = useCorporateStore((s) => s.workspace) === "work";
  const accentColor = isWorkMode ? "text-teal-500" : "text-blue-500";
  const accentBg = isWorkMode ? "bg-teal-500" : "bg-blue-500";

  if (folders.length <= 1) return null;

  return (
    <div className="flex md:hidden items-center overflow-x-auto border-b scrollbar-none">
      {folders.map((folder) => (
        <button
          key={folder.id}
          onClick={() => onSelectFolder(folder.id)}
          className={cn(
            "shrink-0 relative px-3 py-2 text-[13px] font-medium transition-colors whitespace-nowrap",
            selectedFolder === folder.id
              ? accentColor
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="flex items-center gap-1">
            {folder.title}
            {folder.unreadCount && folder.unreadCount > 0 ? (
              <span
                className={cn(
                  "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                  selectedFolder === folder.id
                    ? `${accentBg} text-white`
                    : "bg-muted-foreground/30 text-muted-foreground"
                )}
              >
                {formatUnread(folder.unreadCount)}
              </span>
            ) : null}
          </span>
          {/* Underline indicator */}
          {selectedFolder === folder.id && (
            <span className={cn("absolute bottom-0 left-2 right-2 h-[2px] rounded-full", accentBg)} />
          )}
        </button>
      ))}
    </div>
  );
}
