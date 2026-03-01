"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useUIStore } from "@/store/ui";

export default function ChatIdPage() {
  const params = useParams();
  const chatId = params.chatId as string;
  const { selectChat, setSidebarOpen } = useUIStore();

  useEffect(() => {
    if (chatId) {
      selectChat(chatId);
      setSidebarOpen(false);
    }
  }, [chatId, selectChat, setSidebarOpen]);

  // Rendering is handled by ViewRouter in ChatLayoutClient
  return null;
}
