"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";

const PUBLIC_PATHS = ["/auth", "/telegram-auth"];

/**
 * Global provider that restores the Telegram session on any page.
 * Reads Supabase session from localStorage, then loads the saved
 * Telegram session string from Supabase and connects the client.
 * This runs once — subsequent navigations reuse the in-memory singleton.
 *
 * Also acts as an auth guard: if no Supabase session is found on
 * a protected route (e.g. /chat), redirects to /auth. This is critical
 * for iOS standalone PWA which has separate storage from Safari.
 */
export function TelegramSessionProvider({ children }: { children: React.ReactNode }) {
  const attempted = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const { isTelegramConnected, setSupabaseUser, setTelegramConnected, setTelegramUser, setLoading } =
    useAuthStore();

  useEffect(() => {
    if (attempted.current || isTelegramConnected) return;
    attempted.current = true;

    (async () => {
      try {
        // 1. Check Supabase session
        const { getSession } = await import("@/lib/supabase/auth");
        const session = await getSession();

        if (!session) {
          // No session — redirect to login on protected routes
          const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/";
          if (!isPublic) {
            router.replace("/auth");
          }
          return;
        }

        setSupabaseUser({
          id: session.user.id,
          email: session.user.email!,
        });

        // 2. Check if client already exists (e.g. from HomeRedirect)
        const { getExistingClient, connectClient } = await import("@/lib/telegram/client");
        if (getExistingClient()) {
          setTelegramConnected(true);
          return;
        }

        // 3. Restore Telegram session from Supabase
        const { loadTelegramSession } = await import("@/lib/supabase/session-store");
        const savedSession = await loadTelegramSession(
          session.user.id,
          session.user.id
        );
        if (!savedSession) {
          router.replace("/telegram-auth");
          return;
        }

        const client = await connectClient(savedSession);
        const { getMe } = await import("@/lib/telegram/auth");
        const me = await getMe(client);
        setTelegramUser(me);
        setTelegramConnected(true);
      } catch {
        // Session expired or network error — redirect to login on protected routes
        const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/";
        if (!isPublic) {
          router.replace("/auth");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [isTelegramConnected, setSupabaseUser, setTelegramConnected, setTelegramUser, setLoading, pathname, router]);

  return <>{children}</>;
}
