import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// ---- Mock Supabase middleware ----

const mockGetUser = vi.fn();
const mockFromSelect = vi.fn();

vi.mock("@/lib/supabase/middleware", () => ({
  createSupabaseMiddleware: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockFromSelect,
        }),
      }),
    }),
  }),
}));

import { middleware } from "@/middleware";

// ---- Helpers ----

function makeRequest(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

// ---- Reset mocks ----

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- Middleware Tests ----

describe("RBAC Middleware", () => {
  describe("API routes (/api/admin/*)", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      });

      const req = makeRequest("/api/admin/chats");
      const res = await middleware(req);
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });

    it("returns 403 when user has no admin role", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      });
      mockFromSelect.mockResolvedValue({
        data: null,
        error: null,
      });

      const req = makeRequest("/api/admin/chats");
      const res = await middleware(req);
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toContain("no admin role");
    });

    it("sets admin headers when user has a role", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-admin" } },
        error: null,
      });
      mockFromSelect.mockResolvedValue({
        data: { role: "super_admin" },
        error: null,
      });

      const req = makeRequest("/api/admin/roles");
      const res = await middleware(req);

      // Middleware returns NextResponse.next() with headers
      expect(res.headers.get("x-admin-user-id")).toBe("user-admin");
      expect(res.headers.get("x-admin-role")).toBe("super_admin");
    });
  });

  describe("Page routes (/admin/*)", () => {
    it("redirects to / when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: { message: "No session" },
      });

      const req = makeRequest("/admin/chats");
      const res = await middleware(req);

      expect(res.status).toBe(307); // Next.js redirect
      expect(res.headers.get("location")).toContain("/");
    });

    it("redirects to / when user has no admin role", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "user-normal" } },
        error: null,
      });
      mockFromSelect.mockResolvedValue({
        data: null,
        error: null,
      });

      const req = makeRequest("/admin/templates");
      const res = await middleware(req);

      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/");
    });
  });
});
