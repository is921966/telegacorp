import { create } from "zustand";
import type { TelegramAuthState, TelegramUser } from "../types/telegram";
import { getPlatformStorage } from "./platform";

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
  step: "qr",
};

const WORK_COMPANIES_KEY = "tg-work-companies";

/** Load work companies from platform storage */
function loadWorkCompaniesLocal(): WorkCompany[] {
  try {
    const raw = getPlatformStorage().getItem(WORK_COMPANIES_KEY);
    if (raw && typeof raw === "string") {
      return JSON.parse(raw);
    }
    return [];
  } catch {
    return [];
  }
}

/** Persist work_companies to platform storage (cache) + Supabase table (source of truth) */
function persistWorkCompanies(companies: WorkCompany[], telegramId: string | null) {
  // Cache: platform storage (instant, always works)
  try {
    getPlatformStorage().setItem(WORK_COMPANIES_KEY, JSON.stringify(companies));
  } catch {
    // Storage full or blocked
  }
  // Source of truth: Supabase work_companies table by telegram_id
  if (telegramId) {
    import("../supabase/work-companies")
      .then(({ saveWorkCompanies }) => saveWorkCompanies(telegramId, companies))
      .catch((err) => console.error("[WorkCompanies] persist failed:", err));
  }
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

  setWorkCompanies: (companies) => {
    set({ workCompanies: companies });
    // Sync to storage as backup
    if (companies.length > 0) {
      try {
        getPlatformStorage().setItem(WORK_COMPANIES_KEY, JSON.stringify(companies));
      } catch { /* ignore */ }
    }
  },

  addWorkCompany: async (email) => {
    const existing = get().workCompanies;
    if (existing.some((c) => c.email === email)) return;
    const updated = [...existing, { email, enabled: true }];
    set({ workCompanies: updated });
    persistWorkCompanies(updated, get().telegramUser?.id ?? null);
  },

  toggleWorkCompany: async (email) => {
    const updated = get().workCompanies.map((c) =>
      c.email === email ? { ...c, enabled: !c.enabled } : c
    );
    set({ workCompanies: updated });
    persistWorkCompanies(updated, get().telegramUser?.id ?? null);
  },

  removeWorkCompany: async (email) => {
    const updated = get().workCompanies.filter((c) => c.email !== email);
    set({ workCompanies: updated });
    persistWorkCompanies(updated, get().telegramUser?.id ?? null);
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
