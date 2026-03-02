"use client";

import { ChatList } from "@/components/chat/ChatList";
import { MediaViewer } from "@/components/chat/MediaViewer";
import { GroupInfo } from "@/components/group/GroupInfo";
import { BottomNav } from "@/components/chat/BottomNav";
import { FolderSidebar } from "@/components/chat/FolderSidebar";
import { ViewRouter } from "@/components/chat/ViewRouter";
import { useViewUrlSync } from "@/hooks/useViewUrlSync";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";

export function ChatLayoutClient() {
  const { isSidebarOpen, selectedChatId, currentView } = useUIStore();
  useViewUrlSync();
  useRealtimeUpdates();

  // On mobile, hide the sidebar when:
  // 1. A chat is selected (and sidebar is closed) — original behavior
  // 2. A non-chat view is active (contacts, calls, search, settings)
  const hideSidebarOnMobile =
    (!isSidebarOpen && selectedChatId) || (currentView !== "chats");

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Vertical folder sidebar — desktop only */}
        <FolderSidebar />

        {/* Chat list sidebar */}
        <div
          className={cn(
            "h-full border-r bg-background transition-all duration-200",
            "w-[24rem] shrink-0",
            "max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-30 max-md:w-full",
            hideSidebarOnMobile && "max-md:hidden"
          )}
        >
          <ChatList />
        </div>

        {/* Main content area — ViewRouter handles which view to show */}
        <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
          <ViewRouter />
        </div>

        {/* Group info sidebar */}
        <GroupInfo />

        {/* Media viewer overlay */}
        <MediaViewer />
      </div>

      {/* Bottom navigation bar (mobile only) */}
      <BottomNav />
    </div>
  );
}
