"use client";

import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { CommentThread } from "@/components/chat/CommentThread";
import { useUIStore } from "@/store/ui";

export function ChatPageClient() {
  const { selectedChatId, commentThread } = useUIStore();

  if (!selectedChatId) return null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <ChatHeader />
        <SearchBar />
        <SearchResults />
        <MessageList />
        <MessageInput />
      </div>
      {commentThread && <CommentThread />}
    </div>
  );
}
