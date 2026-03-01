"use client";

import dynamic from "next/dynamic";

const ChatLayoutClient = dynamic(
  () => import("@/components/chat/ChatLayoutClient").then((m) => ({ default: m.ChatLayoutClient })),
  { ssr: false }
);

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ChatLayoutClient />
      {/* children kept for Next.js routing but hidden — all views render inside ChatLayoutClient */}
      <div className="hidden">{children}</div>
    </>
  );
}
