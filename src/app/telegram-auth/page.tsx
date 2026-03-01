"use client";

import dynamic from "next/dynamic";

const TelegramAuthFlow = dynamic(
  () => import("@/components/auth/TelegramAuthFlow").then((m) => ({ default: m.TelegramAuthFlow })),
  { ssr: false }
);

export default function Page() {
  return <TelegramAuthFlow />;
}
