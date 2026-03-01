"use client";

import { cn } from "@/lib/utils";
import { MessageCircle, Phone, Users, Settings, Search } from "lucide-react";
import { useChatsStore } from "@/store/chats";
import { useUIStore, type ViewType } from "@/store/ui";

const tabs: { id: ViewType; label: string; icon: React.ElementType }[] = [
  { id: "contacts", label: "Контакты", icon: Users },
  { id: "calls", label: "Звонки", icon: Phone },
  { id: "chats", label: "Чаты", icon: MessageCircle },
  { id: "settings", label: "Настройки", icon: Settings },
  { id: "search", label: "Поиск", icon: Search },
];

export function BottomNav() {
  const { currentView, selectedChatId, setCurrentView, selectChat } = useUIStore();
  const dialogs = useChatsStore((s) => s.dialogs);

  // Count total chats with unread messages (unmuted)
  const totalUnread = dialogs.filter((d) => d.unreadCount > 0 && !d.isMuted).length;

  // Active tab: if a chat is selected, "chats" is active
  const activeTab = selectedChatId ? "chats" : currentView;

  return (
    <div className="flex items-center justify-around border-t bg-background py-1 md:hidden">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.id === "chats") {
                selectChat(null);
                setCurrentView("chats");
              } else {
                setCurrentView(tab.id);
              }
            }}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors min-w-0 relative",
              isActive ? "text-blue-500" : "text-muted-foreground"
            )}
          >
            <div className="relative">
              <tab.icon className="h-[22px] w-[22px]" />
              {/* Unread badge on Chats tab */}
              {tab.id === "chats" && totalUnread > 0 && (
                <span className="absolute -top-1.5 -right-3 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white leading-none">
                  {totalUnread > 999 ? `${Math.floor(totalUnread / 1000)}K` : totalUnread}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
