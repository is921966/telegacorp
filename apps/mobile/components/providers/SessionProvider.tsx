import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import {
  useAuthStore,
  initSupabaseClient,
  supabase,
  connectClient,
  getExistingClient,
  getMe,
  saveSession,
  disconnectClient,
  loadTelegramSession,
  saveTelegramSession,
} from "@corp/shared";

// ─── Constants ────────────────────────────────────────────────────────
const SUPABASE_URL = "https://idmrxfuasotzbnkpdbme.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkbXJ4ZnVhc290emJua3BkYm1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2MTM2MjYsImV4cCI6MjA1OTE4OTYyNn0.uyPz-ztVDcKb4xfFi84S4_2F91g_nPIqgzeSbGWkFmc";
const SESSION_ENCRYPTION_KEY = "tgcorp-mobile-session-v1";
const SECURE_STORE_SESSION_KEY = "tg_session_backup";

// ─── Context ──────────────────────────────────────────────────────────
interface SessionContextValue {
  /** true while restoring session on launch */
  isRestoring: boolean;
  /** true when Supabase anonymous auth is done */
  isSupabaseReady: boolean;
  /** true when Telegram is connected */
  isTelegramReady: boolean;
  /** Sign out from everything */
  signOut: () => Promise<void>;
  /** Save current Telegram session after auth */
  persistSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  isRestoring: true,
  isSupabaseReady: false,
  isTelegramReady: false,
  signOut: async () => {},
  persistSession: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

// ─── Provider ─────────────────────────────────────────────────────────
export function SessionProvider({ children }: { children: ReactNode }) {
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSupabaseReady, setIsSupabaseReady] = useState(false);
  const [isTelegramReady, setIsTelegramReady] = useState(false);

  const {
    setSupabaseUser,
    setTelegramUser,
    setTelegramConnected,
    setLoading,
    reset,
  } = useAuthStore();

  // ── Initialize Supabase + restore session ──
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // 1. Initialize Supabase client
        initSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            // AsyncStorage handled by @supabase/supabase-js RN adapter
          },
        });

        // 2. Check existing Supabase session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          if (mounted) {
            setSupabaseUser({ id: session.user.id, email: session.user.email ?? null });
            setIsSupabaseReady(true);
          }

          // 3. Try to restore Telegram session
          await restoreTelegramSession(session.user.id, mounted);
        } else {
          // No Supabase session — do anonymous auth
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          if (data?.user && mounted) {
            setSupabaseUser({ id: data.user.id, email: null });
            setIsSupabaseReady(true);
          }
        }
      } catch (err) {
        console.error("[Session] Init error:", err);
      } finally {
        if (mounted) {
          setIsRestoring(false);
          setLoading(false);
        }
      }
    }

    init();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Restore Telegram session from Supabase + SecureStore backup ──
  async function restoreTelegramSession(userId: string, mounted: boolean) {
    try {
      // Try loading from Supabase first
      let sessionString = await loadTelegramSession(userId, SESSION_ENCRYPTION_KEY);

      // Fallback: local SecureStore backup
      if (!sessionString) {
        sessionString = await SecureStore.getItemAsync(SECURE_STORE_SESSION_KEY);
      }

      if (!sessionString) {
        console.log("[Session] No saved Telegram session found");
        return;
      }

      console.log("[Session] Restoring Telegram session...");
      const client = await connectClient(sessionString);
      const me = await getMe(client);

      if (mounted) {
        setTelegramUser(me);
        setTelegramConnected(true);
        setIsTelegramReady(true);
      }

      console.log("[Session] Telegram restored:", me.firstName);
    } catch (err) {
      console.warn("[Session] Telegram restore failed:", err);
      // Clear invalid session
      await SecureStore.deleteItemAsync(SECURE_STORE_SESSION_KEY);
    }
  }

  // ── Persist session after fresh auth ──
  const persistSession = useCallback(async () => {
    try {
      const client = getExistingClient();
      if (!client) return;

      // Get session string from GramJS
      const sessionString = saveSession();
      if (!sessionString) return;

      // Save to SecureStore (instant local backup)
      await SecureStore.setItemAsync(SECURE_STORE_SESSION_KEY, sessionString);

      // Save to Supabase (cloud backup)
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await saveTelegramSession(
          session.user.id,
          sessionString,
          SESSION_ENCRYPTION_KEY
        );
      }

      console.log("[Session] Session persisted successfully");
    } catch (err) {
      console.error("[Session] Persist error:", err);
    }
  }, []);

  // ── Sign out ──
  const signOut = useCallback(async () => {
    try {
      // Disconnect Telegram
      await disconnectClient();

      // Clear secure store
      await SecureStore.deleteItemAsync(SECURE_STORE_SESSION_KEY);

      // Clear Supabase session data
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { deleteTelegramSession } = await import("@corp/shared");
        await deleteTelegramSession(session.user.id);
      }

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Reset all stores
      reset();
      setIsSupabaseReady(false);
      setIsTelegramReady(false);

      console.log("[Session] Signed out");
    } catch (err) {
      console.error("[Session] Sign out error:", err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SessionContext.Provider
      value={{
        isRestoring,
        isSupabaseReady,
        isTelegramReady,
        signOut,
        persistSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
