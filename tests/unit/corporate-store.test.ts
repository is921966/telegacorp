import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useCorporateStore } from "@/store/corporate";
import type { PolicyConfig } from "@/types/admin";

// ---- Reset store between tests ----

beforeEach(() => {
  useCorporateStore.getState().reset();
});

// ---- Workspace switching ----

describe("CorporateStore — workspace switching", () => {
  it("defaults to personal workspace", () => {
    expect(useCorporateStore.getState().workspace).toBe("personal");
  });

  it("switches to work workspace", () => {
    useCorporateStore.getState().switchWorkspace("work");
    expect(useCorporateStore.getState().workspace).toBe("work");
  });

  it("switches back to personal", () => {
    useCorporateStore.getState().switchWorkspace("work");
    useCorporateStore.getState().switchWorkspace("personal");
    expect(useCorporateStore.getState().workspace).toBe("personal");
  });
});

// ---- isManagedChat ----

describe("CorporateStore — isManagedChat", () => {
  it("returns false when no managed chats loaded", () => {
    expect(useCorporateStore.getState().isManagedChat("123")).toBe(false);
  });

  it("returns true for managed chat IDs in the set", () => {
    useCorporateStore.setState({
      managedChatIds: new Set(["100", "200", "300"]),
    });
    expect(useCorporateStore.getState().isManagedChat("100")).toBe(true);
    expect(useCorporateStore.getState().isManagedChat("200")).toBe(true);
    expect(useCorporateStore.getState().isManagedChat("999")).toBe(false);
  });
});

// ---- getChatPolicy ----

describe("CorporateStore — getChatPolicy", () => {
  const mockPolicy: PolicyConfig = {
    chat_permissions: {
      can_send_messages: true,
      can_send_media: true,
      can_send_polls: false,
      can_send_other: true,
      can_add_web_page_previews: true,
      can_change_info: false,
      can_invite_users: true,
      can_pin_messages: false,
    },
    slow_mode_delay: 10,
    message_auto_delete_time: 86400,
    has_protected_content: true,
    has_aggressive_anti_spam_enabled: false,
    has_hidden_members: false,
    join_by_request: false,
  };

  it("returns undefined for unknown chat", () => {
    expect(useCorporateStore.getState().getChatPolicy("unknown")).toBeUndefined();
  });

  it("returns policy for known chat", () => {
    const policies = new Map<string, PolicyConfig>();
    policies.set("chat-100", mockPolicy);
    useCorporateStore.setState({ policies });

    const result = useCorporateStore.getState().getChatPolicy("chat-100");
    expect(result).toEqual(mockPolicy);
    expect(result?.slow_mode_delay).toBe(10);
  });
});

// ---- isContentProtected ----

describe("CorporateStore — isContentProtected", () => {
  it("returns false when no policy exists", () => {
    expect(useCorporateStore.getState().isContentProtected("123")).toBe(false);
  });

  it("returns true when policy has_protected_content is true", () => {
    const policies = new Map<string, PolicyConfig>();
    policies.set("chat-1", {
      chat_permissions: {
        can_send_messages: true,
        can_send_media: true,
        can_send_polls: true,
        can_send_other: true,
        can_add_web_page_previews: true,
        can_change_info: true,
        can_invite_users: true,
        can_pin_messages: true,
      },
      slow_mode_delay: 0,
      message_auto_delete_time: 0,
      has_protected_content: true,
      has_aggressive_anti_spam_enabled: false,
      has_hidden_members: false,
      join_by_request: false,
    });
    useCorporateStore.setState({ policies });

    expect(useCorporateStore.getState().isContentProtected("chat-1")).toBe(true);
  });

  it("returns false when policy has_protected_content is false", () => {
    const policies = new Map<string, PolicyConfig>();
    policies.set("chat-2", {
      chat_permissions: {
        can_send_messages: true,
        can_send_media: true,
        can_send_polls: true,
        can_send_other: true,
        can_add_web_page_previews: true,
        can_change_info: true,
        can_invite_users: true,
        can_pin_messages: true,
      },
      slow_mode_delay: 0,
      message_auto_delete_time: 0,
      has_protected_content: false,
      has_aggressive_anti_spam_enabled: false,
      has_hidden_members: false,
      join_by_request: false,
    });
    useCorporateStore.setState({ policies });

    expect(useCorporateStore.getState().isContentProtected("chat-2")).toBe(false);
  });
});

// ---- loadConfig ----

describe("CorporateStore — loadConfig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets isLoaded=true after successful fetch", async () => {
    const mockResponse = {
      managedChatIds: ["100", "200"],
      policies: {
        "100": {
          chat_permissions: {
            can_send_messages: true,
            can_send_media: true,
            can_send_polls: true,
            can_send_other: true,
            can_add_web_page_previews: true,
            can_change_info: true,
            can_invite_users: true,
            can_pin_messages: true,
          },
          slow_mode_delay: 0,
          message_auto_delete_time: 0,
          has_protected_content: false,
          has_aggressive_anti_spam_enabled: false,
          has_hidden_members: false,
          join_by_request: false,
        },
      },
      archiveChatIds: ["100"],
      templates: [{ id: "t1", name: "Default", description: null }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    });

    await useCorporateStore.getState().loadConfig();

    const state = useCorporateStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.managedChatIds.size).toBe(2);
    expect(state.managedChatIds.has("100")).toBe(true);
    expect(state.managedChatIds.has("200")).toBe(true);
    expect(state.policies.size).toBe(1);
    expect(state.archiveChatIds.size).toBe(1);
    expect(state.templates).toHaveLength(1);
  });

  it("handles 401/403 gracefully (non-admin user)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    await useCorporateStore.getState().loadConfig();

    const state = useCorporateStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.managedChatIds.size).toBe(0);
  });

  it("handles network error gracefully", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await useCorporateStore.getState().loadConfig();

    const state = useCorporateStore.getState();
    expect(state.isLoaded).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it("prevents concurrent loads", async () => {
    let resolveFirst: () => void;
    const firstPromise = new Promise<void>((r) => { resolveFirst = r; });

    global.fetch = vi.fn().mockImplementation(() =>
      firstPromise.then(() => ({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ managedChatIds: [], policies: {}, archiveChatIds: [], templates: [] }),
      }))
    );

    // Start first load
    const load1 = useCorporateStore.getState().loadConfig();
    // Second load while first is in progress — should be a no-op
    const load2 = useCorporateStore.getState().loadConfig();

    resolveFirst!();
    await load1;
    await load2;

    // fetch should only be called once
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

// ---- reset ----

describe("CorporateStore — reset", () => {
  it("resets all state to defaults", () => {
    useCorporateStore.setState({
      workspace: "work",
      managedChatIds: new Set(["1", "2"]),
      isLoaded: true,
      templates: [{ id: "t1", name: "Test", description: null }],
    });

    useCorporateStore.getState().reset();

    const state = useCorporateStore.getState();
    expect(state.workspace).toBe("personal");
    expect(state.managedChatIds.size).toBe(0);
    expect(state.isLoaded).toBe(false);
    expect(state.templates).toHaveLength(0);
  });
});
