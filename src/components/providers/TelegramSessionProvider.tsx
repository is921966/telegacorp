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
  const { isTelegramConnected, setSupabaseUser, setTelegramConnected, setTelegramUser, setLoading, setWorkCompanies } =
    useAuthStore();

  // Suppress GramJS internal TIMEOUT errors (unhandled promise rejections from _updateLoop).
  // These are benign — they fire when WebSocket disconnects (e.g. sign out, network change).
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || "");
      if (msg === "TIMEOUT" || msg.includes("TIMEOUT")) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

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
          email: session.user.email ?? null,
        });

        // Fast cache: load work companies from localStorage for instant render
        try {
          const raw = localStorage.getItem("tg-work-companies");
          if (raw) setWorkCompanies(JSON.parse(raw));
        } catch {
          // ignore
        }

        // 2. Check if client already exists (e.g. from HomeRedirect)
        const { getExistingClient, connectClient } = await import("@/lib/telegram/client");
        if (getExistingClient()) {
          setTelegramConnected(true);
          // Sync work companies from Supabase table if telegramUser is known
          const telegramUser = useAuthStore.getState().telegramUser;
          if (telegramUser?.id) {
            import("@/lib/supabase/work-companies")
              .then(({ loadWorkCompanies }) => loadWorkCompanies(telegramUser.id))
              .then((companies) => { if (companies.length > 0) setWorkCompanies(companies); })
              .catch(() => {});
          }
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

        // Upsert user profile to telegram_users directory
        import("@/lib/supabase/telegram-users")
          .then(({ upsertTelegramUser }) => upsertTelegramUser(me))
          .catch(() => {});

        // Save telegram_id to user_metadata (for middleware admin lookup)
        import("@/lib/supabase/auth")
          .then(({ getSession: gs }) => gs())
          .then(() => import("@/lib/supabase/client"))
          .then(({ supabase }) => supabase.auth.updateUser({ data: { telegram_id: me.id } }))
          .catch(() => {});

        // Source of truth: load work companies from Supabase table by Telegram ID
        try {
          const { loadWorkCompanies } = await import("@/lib/supabase/work-companies");
          const companies = await loadWorkCompanies(me.id);
          if (companies.length > 0) {
            setWorkCompanies(companies);
          } else {
            // One-time migration: localStorage → Supabase table
            const currentCompanies = useAuthStore.getState().workCompanies;
            if (currentCompanies.length > 0) {
              const { saveWorkCompanies } = await import("@/lib/supabase/work-companies");
              saveWorkCompanies(me.id, currentCompanies).catch(() => {});
            }
          }
        } catch {
          // localStorage data remains as fallback
        }
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
  }, [isTelegramConnected, setSupabaseUser, setTelegramConnected, setTelegramUser, setLoading, setWorkCompanies, pathname, router]);

  return <>{children}</>;
}
