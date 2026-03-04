import { create } from "zustand";
import type { PolicyConfig } from "@/types/admin";

export type Workspace = "personal" | "work";

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

  /** Switch between personal and work workspace */
  switchWorkspace: (ws: Workspace) => void;

  /** Load corporate config from API */
  loadConfig: () => Promise<void>;

  /** Check if a chat is a managed (corporate) chat */
  isManagedChat: (chatId: string) => boolean;

  /** Get the policy for a specific chat (if any) */
  getChatPolicy: (chatId: string) => PolicyConfig | undefined;

  /** Check if content protection is enabled for a chat */
  isContentProtected: (chatId: string) => boolean;

  /** Reset store state */
  reset: () => void;
}

export const useCorporateStore = create<CorporateStore>((set, get) => ({
  workspace: "personal",
  managedChatIds: new Set<string>(),
  policies: new Map<string, PolicyConfig>(),
  archiveChatIds: new Set<string>(),
  templates: [],
  isLoaded: false,
  isLoading: false,

  switchWorkspace: (ws) => set({ workspace: ws }),

  loadConfig: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });

    try {
      const res = await fetch("/api/admin/config");
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
    }),
}));
