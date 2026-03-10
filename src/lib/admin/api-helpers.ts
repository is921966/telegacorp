import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import type { AdminContext, AdminPermission, AdminRole } from "@/types/admin";

// ---- Permission matrix ----

const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: ["*"],
  chat_manager: [
    "chats:read",
    "chats:write",
    "members:manage",
    "templates:apply",
  ],
  viewer: ["chats:read", "audit:read"],
  agent_manager: [
    "chats:read",
    "agents:manage",
    "patterns:manage",
    "monitoring:manage",
    "governance:read",
  ],
  compliance_officer: [
    "chats:read",
    "audit:read",
    "archive:read",
    "agents:read",
  ],
};

// ---- Context extraction ----

/**
 * Extract admin context from headers set by middleware.
 * Returns null if headers are missing (unauthenticated).
 */
export function getAdminContext(
  request: NextRequest
): AdminContext | null {
  const telegramId = request.headers.get("x-admin-telegram-id");
  const role = request.headers.get("x-admin-role") as AdminRole | null;

  if (!telegramId || !role) return null;

  return { telegramId, role };
}

// ---- Permission checks ----

/** Check if a role has the given permission */
export function hasPermission(
  role: AdminRole,
  permission: AdminPermission
): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes("*") || perms.includes(permission);
}

/**
 * Guard: returns 403 response if the admin lacks the required permission.
 * Returns null if the check passes.
 */
export function requirePermission(
  ctx: AdminContext,
  permission: AdminPermission
): NextResponse | null {
  if (!hasPermission(ctx.role, permission)) {
    return NextResponse.json(
      { error: "Forbidden", required: permission },
      { status: 403 }
    );
  }
  return null;
}

// ---- Audit logging ----

interface AuditEventParams {
  adminTelegramId: string;
  actionType: string;
  targetChatId?: string | null;
  targetUserId?: string | null;
  payload?: Record<string, unknown> | null;
  resultStatus: "success" | "error" | "partial";
  errorMessage?: string | null;
  request?: NextRequest;
}

/**
 * Log an admin action to the audit_log table.
 * Fire-and-forget: errors are logged but don't break the caller.
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
  try {
    const supabase = createServerSupabase();

    await supabase.from("admin_audit_log").insert({
      admin_telegram_id: params.adminTelegramId,
      action_type: params.actionType,
      target_chat_id: params.targetChatId ?? null,
      target_user_id: params.targetUserId ?? null,
      payload: params.payload ?? null,
      result_status: params.resultStatus,
      error_message: params.errorMessage ?? null,
      ip_address: params.request
        ? getClientIp(params.request)
        : null,
      user_agent: params.request
        ? params.request.headers.get("user-agent")
        : null,
    });
  } catch (err) {
    console.error("[Audit] Failed to log event:", err);
  }
}

// ---- Utilities ----

/** Extract real client IP from Vercel / proxy headers */
export function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}

/**
 * Standard error response builder.
 */
export function errorResponse(
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
