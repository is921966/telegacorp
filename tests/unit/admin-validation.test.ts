import { describe, it, expect } from "vitest";
import {
  assignRoleSchema,
  adminRoleEnum,
  createTemplateSchema,
  updateTemplateSchema,
  applyTemplateSchema,
  banUserSchema,
  editAdminSchema,
  updateChatSettingsSchema,
  createInviteLinkSchema,
  createAgentSchema,
  updateAgentSchema,
  createPatternSchema,
  updateMonitoringSchema,
  submitFeedbackSchema,
  sendMessageSchema,
  auditQuerySchema,
  parseBody,
  parseQuery,
} from "@/lib/admin/validation";

// ---- adminRoleEnum ----

describe("adminRoleEnum", () => {
  it("accepts valid roles", () => {
    expect(adminRoleEnum.parse("super_admin")).toBe("super_admin");
    expect(adminRoleEnum.parse("chat_manager")).toBe("chat_manager");
    expect(adminRoleEnum.parse("viewer")).toBe("viewer");
    expect(adminRoleEnum.parse("agent_manager")).toBe("agent_manager");
    expect(adminRoleEnum.parse("compliance_officer")).toBe("compliance_officer");
  });

  it("rejects invalid roles", () => {
    expect(() => adminRoleEnum.parse("admin")).toThrow();
    expect(() => adminRoleEnum.parse("root")).toThrow();
    expect(() => adminRoleEnum.parse("")).toThrow();
  });
});

// ---- assignRoleSchema ----

describe("assignRoleSchema", () => {
  it("accepts valid assignment", () => {
    const result = assignRoleSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      role: "chat_manager",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID userId", () => {
    const result = assignRoleSchema.safeParse({
      userId: "not-a-uuid",
      role: "viewer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing role", () => {
    const result = assignRoleSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = assignRoleSchema.safeParse({
      userId: "550e8400-e29b-41d4-a716-446655440000",
      role: "supreme_leader",
    });
    expect(result.success).toBe(false);
  });
});

// ---- createTemplateSchema ----

describe("createTemplateSchema", () => {
  const validConfig = {
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
    message_auto_delete_time: 0,
    has_protected_content: false,
    has_aggressive_anti_spam_enabled: false,
    has_hidden_members: false,
    join_by_request: false,
  };

  it("accepts valid template", () => {
    const result = createTemplateSchema.safeParse({
      name: "Dev Team Policy",
      description: "Standard dev team settings",
      config: validConfig,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createTemplateSchema.safeParse({
      name: "",
      config: validConfig,
    });
    expect(result.success).toBe(false);
  });

  it("rejects slow_mode_delay > 3600", () => {
    const result = createTemplateSchema.safeParse({
      name: "Bad",
      config: { ...validConfig, slow_mode_delay: 5000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative slow_mode_delay", () => {
    const result = createTemplateSchema.safeParse({
      name: "Bad",
      config: { ...validConfig, slow_mode_delay: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing permissions field in config", () => {
    const result = createTemplateSchema.safeParse({
      name: "Bad",
      config: { ...validConfig, chat_permissions: undefined },
    });
    expect(result.success).toBe(false);
  });

  it("description is optional", () => {
    const result = createTemplateSchema.safeParse({
      name: "No Description",
      config: validConfig,
    });
    expect(result.success).toBe(true);
  });
});

// ---- banUserSchema ----

describe("banUserSchema", () => {
  it("accepts minimal ban (userId only)", () => {
    const result = banUserSchema.safeParse({ userId: "123456" });
    expect(result.success).toBe(true);
  });

  it("accepts ban with untilDate and revokeMessages", () => {
    const result = banUserSchema.safeParse({
      userId: "123456",
      untilDate: 1709683200,
      revokeMessages: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing userId", () => {
    const result = banUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---- createAgentSchema ----

describe("createAgentSchema", () => {
  it("accepts valid agent", () => {
    const result = createAgentSchema.safeParse({
      name: "Summarizer Bot",
      model: "gpt-4o-mini",
      description: "Summarizes meetings",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createAgentSchema.safeParse({
      name: "",
      model: "gpt-4o",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing model", () => {
    const result = createAgentSchema.safeParse({
      name: "Bot",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional assigned_chats as array of numbers", () => {
    const result = createAgentSchema.safeParse({
      name: "Bot",
      model: "claude-opus",
      assigned_chats: [-1001234567890, -1009876543210],
    });
    expect(result.success).toBe(true);
  });
});

// ---- submitFeedbackSchema ----

describe("submitFeedbackSchema", () => {
  it("accepts thumbs_up", () => {
    const result = submitFeedbackSchema.safeParse({ type: "thumbs_up" });
    expect(result.success).toBe(true);
  });

  it("accepts correction with outputs", () => {
    const result = submitFeedbackSchema.safeParse({
      type: "correction",
      original_output: "wrong answer",
      corrected_output: "right answer",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = submitFeedbackSchema.safeParse({ type: "like" });
    expect(result.success).toBe(false);
  });
});

// ---- sendMessageSchema ----

describe("sendMessageSchema", () => {
  it("accepts string chatId", () => {
    const result = sendMessageSchema.safeParse({
      chatId: "-1001234567890",
      text: "Hello!",
    });
    expect(result.success).toBe(true);
  });

  it("accepts numeric chatId", () => {
    const result = sendMessageSchema.safeParse({
      chatId: -1001234567890,
      text: "Hello!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty text", () => {
    const result = sendMessageSchema.safeParse({
      chatId: "123",
      text: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects text > 4096 chars", () => {
    const result = sendMessageSchema.safeParse({
      chatId: "123",
      text: "x".repeat(4097),
    });
    expect(result.success).toBe(false);
  });
});

// ---- auditQuerySchema ----

describe("auditQuerySchema", () => {
  it("accepts empty object (uses defaults)", () => {
    const result = auditQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(0);
    }
  });

  it("accepts valid filters", () => {
    const result = auditQuerySchema.safeParse({
      actionType: "ban_user",
      limit: "100",
      offset: "10",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(100);
      expect(result.data.offset).toBe(10);
    }
  });

  it("coerces string limit to number", () => {
    const result = auditQuerySchema.safeParse({ limit: "25" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(25);
    }
  });

  it("rejects limit > 500", () => {
    const result = auditQuerySchema.safeParse({ limit: "1000" });
    expect(result.success).toBe(false);
  });

  it("rejects negative offset", () => {
    const result = auditQuerySchema.safeParse({ offset: "-1" });
    expect(result.success).toBe(false);
  });
});

// ---- updateMonitoringSchema ----

describe("updateMonitoringSchema", () => {
  it("accepts enable with consent timestamp", () => {
    const result = updateMonitoringSchema.safeParse({
      monitoring_enabled: true,
      consent_obtained_at: "2026-03-05T12:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("accepts disable without consent", () => {
    const result = updateMonitoringSchema.safeParse({
      monitoring_enabled: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing monitoring_enabled", () => {
    const result = updateMonitoringSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---- parseBody ----

describe("parseBody", () => {
  it("parses valid JSON body", async () => {
    const body = JSON.stringify({ userId: "550e8400-e29b-41d4-a716-446655440000", role: "viewer" });
    const request = new Request("http://localhost", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(request, assignRoleSchema);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.role).toBe("viewer");
    }
  });

  it("returns error for invalid JSON", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: "not json",
    });
    const result = await parseBody(request, assignRoleSchema);
    expect("error" in result).toBe(true);
  });

  it("returns error for schema mismatch", async () => {
    const body = JSON.stringify({ userId: "not-uuid", role: "viewer" });
    const request = new Request("http://localhost", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
    });
    const result = await parseBody(request, assignRoleSchema);
    expect("error" in result).toBe(true);
  });
});

// ---- parseQuery ----

describe("parseQuery", () => {
  it("parses valid query params", () => {
    const url = new URL("http://localhost/api?limit=25&actionType=ban_user");
    const result = parseQuery(url, auditQuerySchema);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.limit).toBe(25);
      expect(result.data.actionType).toBe("ban_user");
    }
  });

  it("returns error for invalid query params", () => {
    const url = new URL("http://localhost/api?limit=invalid");
    const result = parseQuery(url, auditQuerySchema);
    // limit should be coerced as number — "invalid" becomes NaN which fails int()
    expect("error" in result).toBe(true);
  });
});
