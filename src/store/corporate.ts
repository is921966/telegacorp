import { create } from "zustand";
import type { PolicyConfig } from "@/types/admin";

export type Workspace = "personal" | "work";

const WS_TIME_KEY = "tg-workspace-time";

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
  personalSeconds: number;
  workSeconds: number;
  workspaceSwitchedAt: number;

  /** Switch between personal and work workspace */
  switchWorkspace: (ws: Workspace) => void;

  /** Load corporate config from API */
  loadConfig: () => Promise<void>;

  /** Load workspace time from localStorage */
  loadWorkspaceTime: () => void;

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

  /** Reset store state */
  reset: () => void;
}

function loadTimeFromStorage(): WorkspaceTimeData {
  if (typeof window === "undefined") return { personalSeconds: 0, workSeconds: 0 };
  try {
    const raw = localStorage.getItem(WS_TIME_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        personalSeconds: parsed.personalSeconds ?? 0,
        workSeconds: parsed.workSeconds ?? 0,
      };
    }
  } catch { /* ignore */ }
  return { personalSeconds: 0, workSeconds: 0 };
}

function saveTimeToStorage(data: WorkspaceTimeData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WS_TIME_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
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

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-workspace", ws);
    }
    set(updates);

    // Persist to localStorage
    const next = get();
    saveTimeToStorage({
      personalSeconds: next.personalSeconds,
      workSeconds: next.workSeconds,
    });
  },

  loadWorkspaceTime: () => {
    const data = loadTimeFromStorage();
    set({
      personalSeconds: data.personalSeconds,
      workSeconds: data.workSeconds,
      workspaceSwitchedAt: Date.now(),
    });
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
    saveTimeToStorage({
      personalSeconds: next.personalSeconds,
      workSeconds: next.workSeconds,
    });
  },

  syncWorkspaceTime: async () => {
    // Flush current elapsed first
    get().flushElapsed();
    const state = get();
    try {
      await fetch("/api/workspace-time", {
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
      const res = await fetch("/api/corporate/config");
      if (!res.ok) {
        // User may not be an admin — silently skip
        if (res.status === 401 || res.status === 403) {
          set({ isLoaded: true, isLoading: false });
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data: CorporateConfig = await res.json();

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
      personalSeconds: 0,
      workSeconds: 0,
      workspaceSwitchedAt: Date.now(),
    }),
}));
