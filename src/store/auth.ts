import { create } from "zustand";
import type { TelegramAuthState, TelegramUser } from "@/types/telegram";

export interface WorkCompany {
  email: string;
  enabled: boolean;
}

interface AuthStore {
  // Supabase auth
  supabaseUser: { id: string; email: string | null } | null;
  isSupabaseAuthenticated: boolean;

  // Telegram auth
  telegramUser: TelegramUser | null;
  isTelegramConnected: boolean;
  telegramAuthState: TelegramAuthState;

  // Work companies
  workCompanies: WorkCompany[];

  // Loading
  isLoading: boolean;

  // Actions
  setSupabaseUser: (user: { id: string; email: string | null } | null) => void;
  setTelegramUser: (user: TelegramUser | null) => void;
  setTelegramConnected: (connected: boolean) => void;
  setTelegramAuthState: (state: Partial<TelegramAuthState>) => void;
  setLoading: (loading: boolean) => void;

  // Work companies actions
  setWorkCompanies: (companies: WorkCompany[]) => void;
  addWorkCompany: (email: string) => Promise<void>;
  toggleWorkCompany: (email: string) => Promise<void>;
  removeWorkCompany: (email: string) => Promise<void>;

  reset: () => void;
}

const initialTelegramAuthState: TelegramAuthState = {
  step: "phone",
};

/** Persist work_companies to Supabase user_metadata */
async function persistWorkCompanies(companies: WorkCompany[]) {
  const { updateWorkCompanies } = await import("@/lib/supabase/auth");
  await updateWorkCompanies(companies);
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  supabaseUser: null,
  isSupabaseAuthenticated: false,
  telegramUser: null,
  isTelegramConnected: false,
  telegramAuthState: initialTelegramAuthState,
  workCompanies: [],
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

  setWorkCompanies: (companies) => set({ workCompanies: companies }),

  addWorkCompany: async (email) => {
    const existing = get().workCompanies;
    if (existing.some((c) => c.email === email)) return;
    const updated = [...existing, { email, enabled: true }];
    set({ workCompanies: updated });
    await persistWorkCompanies(updated);
  },

  toggleWorkCompany: async (email) => {
    const updated = get().workCompanies.map((c) =>
      c.email === email ? { ...c, enabled: !c.enabled } : c
    );
    set({ workCompanies: updated });
    await persistWorkCompanies(updated);
  },

  removeWorkCompany: async (email) => {
    const updated = get().workCompanies.filter((c) => c.email !== email);
    set({ workCompanies: updated });
    await persistWorkCompanies(updated);
  },

  reset: () =>
    set({
      supabaseUser: null,
      isSupabaseAuthenticated: false,
      telegramUser: null,
      isTelegramConnected: false,
      telegramAuthState: initialTelegramAuthState,
      workCompanies: [],
      isLoading: false,
    }),
}));
