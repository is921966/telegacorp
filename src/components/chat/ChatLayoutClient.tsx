"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatList } from "@/components/chat/ChatList";
import { TopicsList } from "@/components/chat/TopicsList";
import { MediaViewer } from "@/components/chat/MediaViewer";
import { GroupInfo } from "@/components/group/GroupInfo";
import { CreateGroupFlow } from "@/components/group/CreateGroupFlow";
import { CreateChannelFlow } from "@/components/group/CreateChannelFlow";
import { BottomNav } from "@/components/chat/BottomNav";
import { FolderSidebar } from "@/components/chat/FolderSidebar";
import { ViewRouter } from "@/components/chat/ViewRouter";
import { AgentInfoPanel } from "@/components/chat/AgentInfoPanel";
import { useViewUrlSync } from "@/hooks/useViewUrlSync";
import { useRealtimeUpdates } from "@/hooks/useRealtimeUpdates";
import { useUIStore } from "@/store/ui";
import { useChatsStore } from "@/store/chats";
import { useAuthStore } from "@/store/auth";
import { useCorporateStore } from "@/store/corporate";
import { cn } from "@/lib/utils";

export function ChatLayoutClient() {
  const { isSidebarOpen, selectedChatId, selectedTopicId, currentView } = useUIStore();
  const { dialogs } = useChatsStore();
  const telegramUser = useAuthStore((s) => s.telegramUser);
  const loadConfig = useCorporateStore((s) => s.loadConfig);
  const loadWorkspaceTime = useCorporateStore((s) => s.loadWorkspaceTime);
  const syncWorkspaceTime = useCorporateStore((s) => s.syncWorkspaceTime);
  const flushElapsed = useCorporateStore((s) => s.flushElapsed);
  const [agentPanelId, setAgentPanelId] = useState<string | null>(null);
  useViewUrlSync();
  useRealtimeUpdates();

  // Load corporate config + workspace time on mount (scoped to telegram_id)
  useEffect(() => {
    loadConfig();
    if (telegramUser?.id) {
      loadWorkspaceTime(telegramUser.id);
    }
  }, [loadConfig, loadWorkspaceTime, telegramUser?.id]);

  // Sync workspace time every 60s + on page close
  useEffect(() => {
    const interval = setInterval(() => {
      syncWorkspaceTime();
    }, 60_000);

    const handleBeforeUnload = () => {
      flushElapsed();
      const state = useCorporateStore.getState();
      const payload = JSON.stringify({
        personalSeconds: state.personalSeconds,
        workSeconds: state.workSeconds,
      });
      navigator.sendBeacon("/api/workspace-time", payload);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [syncWorkspaceTime, flushElapsed]);

  // Check if selected chat is a forum (for mobile routing)
  const selectedDialog = selectedChatId
    ? dialogs.find((d) => d.id === selectedChatId)
    : null;
  const isForumSelected = selectedDialog?.isForum ?? false;

  // Mobile: show topics list when a forum is selected but no topic is chosen
  const showMobileTopicsList =
    isForumSelected && selectedChatId && !selectedTopicId;

  // On mobile, hide the sidebar when:
  // 1. A chat is selected (and sidebar is closed) — original behavior
  // 2. A non-chat view is active (contacts, calls, search, settings)
  // 3. Showing topics list for a forum
  const hideSidebarOnMobile =
    (!isSidebarOpen && selectedChatId) ||
    currentView !== "chats" ||
    showMobileTopicsList;

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

        {/* Mobile: Topics list overlay for forum groups */}
        {showMobileTopicsList && (
          <div className="md:hidden absolute inset-y-0 left-0 z-30 w-full">
            <TopicsList />
          </div>
        )}

        {/* Main content area — ViewRouter handles which view to show */}
        <div className="flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden">
          <ViewRouter />
        </div>

        {/* Group info sidebar */}
        <GroupInfo />

        {/* Agent info panel — slides from right */}
        <AgentInfoPanel
          agentId={agentPanelId ?? ""}
          isOpen={!!agentPanelId}
          onClose={() => setAgentPanelId(null)}
        />

        {/* Media viewer overlay */}
        <MediaViewer />

        {/* Creation flows */}
        <CreateGroupFlow />
        <CreateChannelFlow />
      </div>

      {/* Bottom navigation bar (mobile only) */}
      <BottomNav />
    </div>
  );
}
