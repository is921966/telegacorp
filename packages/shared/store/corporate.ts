import { create } from "zustand";
import type { PolicyConfig } from "../types/admin";
import { getPlatformStorage, getPlatformConfig } from "./platform";

export type Workspace = "personal" | "work";

/** Storage key scoped to telegram_id (so different users don't share timers) */
function getWsTimeKey(telegramId: string): string {
  return `tg-workspace-time-${telegramId}`;
}

interface WorkspaceTimeData {
  personalSeconds: number;
  workSeconds: number;
}

interface CorporateConfig {
  managedChatIds: string[];
  policies: Record<string, PolicyConfig>;
  archiveChatIds: string[];
  templates: { id: string; name: string; description: string | null }[];
}

interface CorporateStore {
  workspace: Workspace;
  managedChatIds: Set<string>;
  policies: Map<string, PolicyConfig>;
  archiveChatIds: Set<string>;
  templates: { id: string; name: string; description: string | null }[];
  isLoaded: boolean;
  isLoading: boolean;

  // Workspace time tracking
  telegramId: string | null;
  personalSeconds: number;
  workSeconds: number;
  workspaceSwitchedAt: number;

  /** Switch between personal and work workspace */
  switchWorkspace: (ws: Workspace) => void;

  /** Load corporate config from API */
  loadConfig: () => Promise<void>;

  /**
   * Load workspace time: fetch from server first, then merge with storage.
   * Must be called with telegramId so data is scoped per user.
   */
  loadWorkspaceTime: (telegramId: string) => Promise<void>;

  /** Get accumulated seconds for current workspace including live elapsed */
  getCurrentElapsed: () => number;

  /** Flush elapsed time into accumulated counters and persist */
  flushElapsed: () => void;

  /** Sync workspace time to server */
  syncWorkspaceTime: () => Promise<void>;

  /** Check if a chat is a managed (corporate) chat */
  isManagedChat: (chatId: string) => boolean;

  /** Get the policy for a specific chat (if any) */
  getChatPolicy: (chatId: string) => PolicyConfig | undefined;

  /** Check if content protection is enabled for a chat */
  isContentProtected: (chatId: string) => boolean;

  /** Optional callback for workspace switching side-effects (e.g. DOM attributes) */
  onWorkspaceSwitch?: (ws: Workspace) => void;

  /** Reset store state */
  reset: () => void;
}

function loadTimeFromStorage(telegramId: string): WorkspaceTimeData {
  try {
    const raw = getPlatformStorage().getItem(getWsTimeKey(telegramId));
    // Handle both sync and async returns
    if (raw && typeof raw === "string") {
      const parsed = JSON.parse(raw);
      return {
        personalSeconds: parsed.personalSeconds ?? 0,
        workSeconds: parsed.workSeconds ?? 0,
      };
    }
  } catch { /* ignore */ }
  return { personalSeconds: 0, workSeconds: 0 };
}

function saveTimeToStorage(telegramId: string, data: WorkspaceTimeData) {
  try {
    getPlatformStorage().setItem(getWsTimeKey(telegramId), JSON.stringify(data));
  } catch { /* ignore */ }
}

/** Fetch workspace time from server */
async function fetchTimeFromServer(): Promise<WorkspaceTimeData | null> {
  try {
    const { apiBaseUrl } = getPlatformConfig();
    const res = await fetch(`${apiBaseUrl}/api/workspace-time`);
    if (!res.ok) return null;
    const data = await res.json() as { personalSeconds?: number; workSeconds?: number };
    return {
      personalSeconds: data.personalSeconds ?? 0,
      workSeconds: data.workSeconds ?? 0,
    };
  } catch {
    return null;
  }
}

export const useCorporateStore = create<CorporateStore>((set, get) => ({
  workspace: "personal",
  managedChatIds: new Set<string>(),
  policies: new Map<string, PolicyConfig>(),
  archiveChatIds: new Set<string>(),
  templates: [],
  isLoaded: false,
  isLoading: false,

  // Time tracking
  telegramId: null,
  personalSeconds: 0,
  workSeconds: 0,
  workspaceSwitchedAt: Date.now(),

  switchWorkspace: (ws) => {
    const state = get();
    // Accumulate elapsed time for current workspace
    const elapsed = Math.floor((Date.now() - state.workspaceSwitchedAt) / 1000);
    const updates: Partial<CorporateStore> = {
      workspace: ws,
      workspaceSwitchedAt: Date.now(),
    };
    if (state.workspace === "personal") {
      updates.personalSeconds = state.personalSeconds + elapsed;
    } else {
      updates.workSeconds = state.workSeconds + elapsed;
    }

    // Platform-specific side effect (web: set DOM attribute)
    state.onWorkspaceSwitch?.(ws);
    set(updates);

    // Persist to storage (scoped by telegramId)
    const next = get();
    if (next.telegramId) {
      saveTimeToStorage(next.telegramId, {
        personalSeconds: next.personalSeconds,
        workSeconds: next.workSeconds,
      });
    }
  },

  loadWorkspaceTime: async (telegramId: string) => {
    set({ telegramId });

    // 1. Read from scoped storage (instant, offline-safe)
    const local = loadTimeFromStorage(telegramId);

    // 2. Fetch from server (source of truth — includes other devices)
    const server = await fetchTimeFromServer();

    // 3. Merge: take MAX of each counter so no data is lost
    //    (handles case where server has data from another device,
    //     or storage has data not yet synced)
    const merged: WorkspaceTimeData = {
      personalSeconds: Math.max(local.personalSeconds, server?.personalSeconds ?? 0),
      workSeconds: Math.max(local.workSeconds, server?.workSeconds ?? 0),
    };

    set({
      personalSeconds: merged.personalSeconds,
      workSeconds: merged.workSeconds,
      workspaceSwitchedAt: Date.now(),
    });

    // Persist merged result to storage
    saveTimeToStorage(telegramId, merged);
  },

  getCurrentElapsed: () => {
    const state = get();
    return Math.floor((Date.now() - state.workspaceSwitchedAt) / 1000);
  },

  flushElapsed: () => {
    const state = get();
    const elapsed = Math.floor((Date.now() - state.workspaceSwitchedAt) / 1000);
    if (elapsed <= 0) return;

    const updates: Partial<CorporateStore> = { workspaceSwitchedAt: Date.now() };
    if (state.workspace === "personal") {
      updates.personalSeconds = state.personalSeconds + elapsed;
    } else {
      updates.workSeconds = state.workSeconds + elapsed;
    }
    set(updates);

    const next = get();
    if (next.telegramId) {
      saveTimeToStorage(next.telegramId, {
        personalSeconds: next.personalSeconds,
        workSeconds: next.workSeconds,
      });
    }
  },

  syncWorkspaceTime: async () => {
    // Flush current elapsed first
    get().flushElapsed();
    const state = get();
    try {
      const { apiBaseUrl } = getPlatformConfig();
      await fetch(`${apiBaseUrl}/api/workspace-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personalSeconds: state.personalSeconds,
          workSeconds: state.workSeconds,
        }),
      });
    } catch (err) {
      console.error("[CorporateStore] Failed to sync workspace time:", err);
    }
  },

  loadConfig: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });

    try {
      const { apiBaseUrl } = getPlatformConfig();
      const res = await fetch(`${apiBaseUrl}/api/corporate/config`);
      if (!res.ok) {
        // User may not be an admin — silently skip
        if (res.status === 401 || res.status === 403) {
          set({ isLoaded: true, isLoading: false });
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json() as CorporateConfig;

      const managedChatIds = new Set(data.managedChatIds ?? []);
      const archiveChatIds = new Set(data.archiveChatIds ?? []);
      const policies = new Map<string, PolicyConfig>();

      if (data.policies) {
        for (const [chatId, policy] of Object.entries(data.policies)) {
          policies.set(chatId, policy as PolicyConfig);
        }
      }

      set({
        managedChatIds,
        policies,
        archiveChatIds,
        templates: data.templates ?? [],
        isLoaded: true,
        isLoading: false,
      });
    } catch (err) {
      console.error("[CorporateStore] Failed to load config:", err);
      set({ isLoaded: true, isLoading: false });
    }
  },

  isManagedChat: (chatId) => get().managedChatIds.has(chatId),

  getChatPolicy: (chatId) => get().policies.get(chatId),

  isContentProtected: (chatId) => {
    const policy = get().policies.get(chatId);
    return policy?.has_protected_content ?? false;
  },

  reset: () =>
    set({
      workspace: "personal",
      managedChatIds: new Set<string>(),
      policies: new Map<string, PolicyConfig>(),
      archiveChatIds: new Set<string>(),
      templates: [],
      isLoaded: false,
      isLoading: false,
      telegramId: null,
      personalSeconds: 0,
      workSeconds: 0,
      workspaceSwitchedAt: Date.now(),
    }),
}));
