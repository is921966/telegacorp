"use client";

import dynamic from "next/dynamic";
import { useUIStore } from "@/store/ui";
import { ChatPageClient } from "./ChatPageClient";
import { MessageSquare } from "lucide-react";

const SettingsView = dynamic(
  () => import("@/components/settings/SettingsView").then((m) => ({ default: m.SettingsView })),
  { ssr: false }
);

const ContactsPageClient = dynamic(
  () => import("@/components/contacts/ContactsPageClient").then((m) => ({ default: m.ContactsPageClient })),
  { ssr: false }
);

const CallsPageClient = dynamic(
  () => import("@/components/calls/CallsPageClient").then((m) => ({ default: m.CallsPageClient })),
  { ssr: false }
);

const SearchPageClient = dynamic(
  () => import("@/components/search/SearchPageClient").then((m) => ({ default: m.SearchPageClient })),
  { ssr: false }
);

export function ViewRouter() {
  const { currentView, selectedChatId } = useUIStore();

  // If a chat is selected, always show the chat view
  if (selectedChatId) {
    return <ChatPageClient />;
  }

  switch (currentView) {
    case "contacts":
      return <ContactsPageClient />;
    case "calls":
      return <CallsPageClient />;
    case "search":
      return <SearchPageClient />;
    case "settings":
      return <SettingsView />;
    case "chats":
    default:
      return (
        <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
          <MessageSquare className="h-16 w-16 mb-4 opacity-20" />
          <h2 className="text-xl font-medium mb-1">Telegram Corp</h2>
          <p className="text-sm">Select a chat to start messaging</p>
          <p className="text-[10px] text-muted-foreground/40 mt-4">
            v{process.env.NEXT_PUBLIC_APP_VERSION} | {process.env.NEXT_PUBLIC_BUILD_DATE}
          </p>
        </div>
      );
  }
}
