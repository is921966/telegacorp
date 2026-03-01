"use client";

import dynamic from "next/dynamic";

const AuthPage = dynamic(
  () => import("@/components/auth/LoginForm").then((m) => ({ default: m.LoginForm })),
  { ssr: false }
);

export default function Page() {
  return <AuthPage />;
}
