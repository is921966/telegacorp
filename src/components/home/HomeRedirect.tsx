"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Skeleton } from "@/components/ui/skeleton";

export function HomeRedirect() {
  const router = useRouter();
  const { setSupabaseUser, setTelegramConnected, setTelegramUser, setLoading } =
    useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const { getSession } = await import("@/lib/supabase/auth");
        const session = await getSession();

        if (!session) {
          router.replace("/auth");
          return;
        }

        setSupabaseUser({
          id: session.user.id,
          email: session.user.email!,
        });

        // Try to restore Telegram session
        const { loadTelegramSession } = await import(
          "@/lib/supabase/session-store"
        );
        const savedSession = await loadTelegramSession(
          session.user.id,
          session.user.id
        );

        if (savedSession) {
          try {
            const { connectClient } = await import("@/lib/telegram/client");
            const client = await connectClient(savedSession);
            const { getMe } = await import("@/lib/telegram/auth");
            const me = await getMe(client);
            setTelegramUser(me);
            setTelegramConnected(true);
            router.replace("/chat");
          } catch {
            // Session expired or invalid
            router.replace("/telegram-auth");
          }
        } else {
          router.replace("/telegram-auth");
        }
      } catch {
        router.replace("/auth");
      } finally {
        setLoading(false);
        setChecking(false);
      }
    };

    init();
  }, [router, setSupabaseUser, setTelegramConnected, setTelegramUser, setLoading]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-primary-foreground"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-4">
            v{process.env.NEXT_PUBLIC_APP_VERSION} | {process.env.NEXT_PUBLIC_BUILD_DATE}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
