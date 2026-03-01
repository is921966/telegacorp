"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface ScrollToBottomProps {
  visible: boolean;
  unreadCount?: number;
  onClick: () => void;
}

export function ScrollToBottom({ visible, unreadCount, onClick }: ScrollToBottomProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center",
        "rounded-full bg-background border shadow-lg transition-all",
        "hover:bg-accent active:scale-95"
      )}
    >
      <ChevronDown className="h-5 w-5" />
      {unreadCount && unreadCount > 0 ? (
        <span className="absolute -top-1.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}
