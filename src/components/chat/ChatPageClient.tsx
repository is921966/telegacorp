"use client";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { useUIStore } from "@/store/ui";

export function ChatPageClient() {
  const { selectedChatId } = useUIStore();

  if (!selectedChatId) return null;

  return (
    <div className="flex h-full flex-col min-h-0 overflow-hidden">
      <ChatHeader />
      <SearchBar />
      <SearchResults />
      <MessageList />
      <MessageInput />
    </div>
  );
}
