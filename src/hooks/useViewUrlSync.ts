"use client";

import { useEffect, useRef } from "react";
import { useUIStore, type ViewType } from "@/store/ui";

const viewToPath: Record<ViewType, string> = {
  chats: "/chat",
  contacts: "/contacts",
  calls: "/calls",
  search: "/search",
  settings: "/settings",
};

function pathToView(pathname: string): { view: ViewType; chatId: string | null } {
  if (pathname.startsWith("/chat/")) {
    return { view: "chats", chatId: pathname.slice(6) };
  }
  if (pathname.startsWith("/contacts")) return { view: "contacts", chatId: null };
  if (pathname.startsWith("/calls")) return { view: "calls", chatId: null };
  if (pathname.startsWith("/search")) return { view: "search", chatId: null };
  if (pathname.startsWith("/settings")) return { view: "settings", chatId: null };
  return { view: "chats", chatId: null };
}

export function useViewUrlSync() {
  const { currentView, selectedChatId, setCurrentView, selectChat } = useUIStore();
  const isInternalUpdate = useRef(false);

  // Sync store → URL (replaceState to avoid triggering Next.js navigation)
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }

    const targetPath = selectedChatId
      ? `/chat/${selectedChatId}`
      : viewToPath[currentView];

    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath);
    }
  }, [currentView, selectedChatId]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;

      // Only handle our routes — ignore auth/telegram-auth
      if (!pathname.startsWith("/chat") && !pathname.startsWith("/contacts") &&
          !pathname.startsWith("/calls") && !pathname.startsWith("/search") &&
          !pathname.startsWith("/settings")) {
        return;
      }

      isInternalUpdate.current = true;
      const { view, chatId } = pathToView(pathname);

      if (chatId) {
        selectChat(chatId);
      } else {
        selectChat(null);
        setCurrentView(view);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setCurrentView, selectChat]);
}
