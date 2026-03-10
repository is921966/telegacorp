import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// Mock Supabase before importing modules
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  })),
}));

import {
  getAdminContext,
  hasPermission,
  requirePermission,
  errorResponse,
  getClientIp,
} from "@/lib/admin/api-helpers";

// ---- getAdminContext ----

describe("getAdminContext", () => {
  it("returns null when x-admin-user-id header is missing", () => {
    const req = new NextRequest("http://localhost/api/admin/chats", {
      headers: { "x-admin-role": "super_admin" },
    });
    expect(getAdminContext(req)).toBeNull();
  });

  it("returns null when x-admin-role header is missing", () => {
    const req = new NextRequest("http://localhost/api/admin/chats", {
      headers: { "x-admin-user-id": "user-123" },
    });
    expect(getAdminContext(req)).toBeNull();
  });

  it("returns null when both headers are missing", () => {
    const req = new NextRequest("http://localhost/api/admin/chats");
    expect(getAdminContext(req)).toBeNull();
  });

  it("returns admin context when both headers present", () => {
    const req = new NextRequest("http://localhost/api/admin/chats", {
      headers: {
        "x-admin-user-id": "user-abc",
        "x-admin-role": "chat_manager",
      },
    });
    const ctx = getAdminContext(req);
    expect(ctx).toEqual({ telegramId: "user-abc", role: "chat_manager" });
  });
});

// ---- hasPermission ----

describe("hasPermission", () => {
  it("super_admin has wildcard access to everything", () => {
    expect(hasPermission("super_admin", "chats:read")).toBe(true);
    expect(hasPermission("super_admin", "audit:read")).toBe(true);
    expect(hasPermission("super_admin", "agents:manage")).toBe(true);
    expect(hasPermission("super_admin", "archive:read")).toBe(true);
    expect(hasPermission("super_admin", "governance:manage")).toBe(true);
  });

  it("chat_manager has chats:read but not audit:read", () => {
    expect(hasPermission("chat_manager", "chats:read")).toBe(true);
    expect(hasPermission("chat_manager", "chats:write")).toBe(true);
    expect(hasPermission("chat_manager", "members:manage")).toBe(true);
    expect(hasPermission("chat_manager", "templates:apply")).toBe(true);
    expect(hasPermission("chat_manager", "audit:read")).toBe(false);
    expect(hasPermission("chat_manager", "agents:manage")).toBe(false);
  });

  it("viewer has only chats:read and audit:read", () => {
    expect(hasPermission("viewer", "chats:read")).toBe(true);
    expect(hasPermission("viewer", "audit:read")).toBe(true);
    expect(hasPermission("viewer", "chats:write")).toBe(false);
    expect(hasPermission("viewer", "members:manage")).toBe(false);
    expect(hasPermission("viewer", "agents:manage")).toBe(false);
  });

  it("agent_manager has agents:manage and monitoring:manage", () => {
    expect(hasPermission("agent_manager", "agents:manage")).toBe(true);
    expect(hasPermission("agent_manager", "patterns:manage")).toBe(true);
    expect(hasPermission("agent_manager", "monitoring:manage")).toBe(true);
    expect(hasPermission("agent_manager", "governance:read")).toBe(true);
    expect(hasPermission("agent_manager", "chats:read")).toBe(true);
    expect(hasPermission("agent_manager", "audit:read")).toBe(false);
  });

  it("compliance_officer has archive:read, agents:read", () => {
    expect(hasPermission("compliance_officer", "archive:read")).toBe(true);
    expect(hasPermission("compliance_officer", "agents:read")).toBe(true);
    expect(hasPermission("compliance_officer", "audit:read")).toBe(true);
    expect(hasPermission("compliance_officer", "chats:read")).toBe(true);
    expect(hasPermission("compliance_officer", "agents:manage")).toBe(false);
    expect(hasPermission("compliance_officer", "chats:write")).toBe(false);
  });

  it("returns false for unknown role", () => {
    expect(hasPermission("unknown_role" as any, "chats:read")).toBe(false);
  });
});

// ---- requirePermission ----

describe("requirePermission", () => {
  it("returns null (pass) when role has permission", () => {
    const result = requirePermission(
      { telegramId: "user-1", role: "super_admin" },
      "chats:read"
    );
    expect(result).toBeNull();
  });

  it("returns 403 response when role lacks permission", () => {
    const result = requirePermission(
      { telegramId: "user-1", role: "viewer" },
      "chats:write"
    );
    expect(result).toBeInstanceOf(NextResponse);
    expect(result!.status).toBe(403);
  });

  it("403 response includes required permission info", async () => {
    const result = requirePermission(
      { telegramId: "user-1", role: "viewer" },
      "agents:manage"
    );
    const body = await result!.json();
    expect(body.error).toBe("Forbidden");
    expect(body.required).toBe("agents:manage");
  });
});

// ---- errorResponse ----

describe("errorResponse", () => {
  it("returns NextResponse with correct status and error message", async () => {
    const resp = errorResponse("Something went wrong", 500);
    expect(resp.status).toBe(500);
    const body = await resp.json();
    expect(body.error).toBe("Something went wrong");
  });

  it("works for 400 status", async () => {
    const resp = errorResponse("Bad Request", 400);
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toBe("Bad Request");
  });
});

// ---- getClientIp ----

describe("getClientIp", () => {
  it("extracts IP from x-forwarded-for (first entry)", () => {
    const req = new NextRequest("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("extracts IP from x-real-ip when x-forwarded-for is absent", () => {
    const req = new NextRequest("http://localhost", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("10.0.0.1");
  });

  it("returns null when no IP headers present", () => {
    const req = new NextRequest("http://localhost");
    expect(getClientIp(req)).toBeNull();
  });

  it("trims whitespace from x-forwarded-for", () => {
    const req = new NextRequest("http://localhost", {
      headers: { "x-forwarded-for": "  192.168.1.1  , 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("192.168.1.1");
  });
});
