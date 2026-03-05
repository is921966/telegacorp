import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---- Mocks ----

const mockSupabase = {
  from: vi.fn(),
  auth: {
    admin: {
      getUserById: vi.fn(),
    },
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => mockSupabase,
}));

// Import handlers after mocks
import { GET, POST } from "@/app/api/admin/roles/route";

// ---- Helpers ----

function makeAdminRequest(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  const hdrs: Record<string, string> = {
    "x-admin-user-id": "admin-001",
    "x-admin-role": "super_admin",
    ...headers,
  };
  if (body) {
    hdrs["Content-Type"] = "application/json";
  }
  return new NextRequest("http://localhost/api/admin/roles", {
    method,
    headers: hdrs,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function makeUnauthRequest(method: string): NextRequest {
  return new NextRequest("http://localhost/api/admin/roles", { method });
}

// ---- Reset mocks ----

beforeEach(() => {
  vi.clearAllMocks();
});

// ---- GET /api/admin/roles ----

describe("GET /api/admin/roles", () => {
  it("returns 401 when no admin headers present", async () => {
    const req = makeUnauthRequest("GET");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when role lacks * permission", async () => {
    const req = new NextRequest("http://localhost/api/admin/roles", {
      headers: {
        "x-admin-user-id": "user-1",
        "x-admin-role": "viewer", // viewers don't have * permission
      },
    });
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it("returns admin list when authorized", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "role-1",
              user_id: "user-1",
              role: "chat_manager",
              granted_by: "admin-001",
              granted_at: "2026-03-01T00:00:00Z",
            },
          ],
          error: null,
        }),
      }),
    });

    mockSupabase.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
    });

    const req = makeAdminRequest("GET");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.admins).toHaveLength(1);
    expect(body.admins[0].email).toBe("test@example.com");
    expect(body.admins[0].role).toBe("chat_manager");
  });

  it("handles database errors gracefully", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "connection refused" },
        }),
      }),
    });

    const req = makeAdminRequest("GET");
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});

// ---- POST /api/admin/roles ----

describe("POST /api/admin/roles", () => {
  it("returns 401 when unauthenticated", async () => {
    const req = makeUnauthRequest("POST");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid body", async () => {
    const req = makeAdminRequest("POST", { userId: "not-a-uuid", role: "viewer" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation error");
  });

  it("returns 400 for invalid role", async () => {
    const req = makeAdminRequest("POST", {
      userId: "550e8400-e29b-41d4-a716-446655440000",
      role: "supreme_leader",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when target user does not exist", async () => {
    mockSupabase.auth.admin.getUserById.mockResolvedValue({
      data: { user: null },
      error: { message: "User not found" },
    });

    const req = makeAdminRequest("POST", {
      userId: "550e8400-e29b-41d4-a716-446655440000",
      role: "viewer",
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("creates role and returns 201 on success", async () => {
    mockSupabase.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: "new@example.com" } },
    });

    mockSupabase.from.mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "role-new",
              user_id: "550e8400-e29b-41d4-a716-446655440000",
              role: "viewer",
              granted_by: "admin-001",
              granted_at: "2026-03-05T00:00:00Z",
            },
            error: null,
          }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const req = makeAdminRequest("POST", {
      userId: "550e8400-e29b-41d4-a716-446655440000",
      role: "viewer",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);

    const body = await res.json();
    expect(body.assigned).toBe(true);
    expect(body.admin.role).toBe("viewer");
    expect(body.admin.email).toBe("new@example.com");
  });
});
