import { create } from "zustand";
import type { TelegramAuthState, TelegramUser } from "@/types/telegram";

interface AuthStore {
  // Supabase auth
  supabaseUser: { id: string; email: string } | null;
  isSupabaseAuthenticated: boolean;

  // Telegram auth
  telegramUser: TelegramUser | null;
  isTelegramConnected: boolean;
  telegramAuthState: TelegramAuthState;

  // Loading
  isLoading: boolean;

  // Actions
  setSupabaseUser: (user: { id: string; email: string } | null) => void;
  setTelegramUser: (user: TelegramUser | null) => void;
  setTelegramConnected: (connected: boolean) => void;
  setTelegramAuthState: (state: Partial<TelegramAuthState>) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialTelegramAuthState: TelegramAuthState = {
  step: "phone",
};

export const useAuthStore = create<AuthStore>((set) => ({
  supabaseUser: null,
  isSupabaseAuthenticated: false,
  telegramUser: null,
  isTelegramConnected: false,
  telegramAuthState: initialTelegramAuthState,
  isLoading: true,

  setSupabaseUser: (user) =>
    set({ supabaseUser: user, isSupabaseAuthenticated: !!user }),

  setTelegramUser: (user) => set({ telegramUser: user }),

  setTelegramConnected: (connected) =>
    set({ isTelegramConnected: connected }),

  setTelegramAuthState: (state) =>
    set((prev) => ({
      telegramAuthState: { ...prev.telegramAuthState, ...state },
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  reset: () =>
    set({
      supabaseUser: null,
      isSupabaseAuthenticated: false,
      telegramUser: null,
      isTelegramConnected: false,
      telegramAuthState: initialTelegramAuthState,
      isLoading: false,
    }),
}));
