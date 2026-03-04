import { NextResponse, type NextRequest } from "next/server";
import { getAdminContext, requirePermission, errorResponse } from "@/lib/admin/api-helpers";

/** GET /api/admin/governance/settings — Governance configuration */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "governance:manage");
  if (denied) return denied;

  // Governance settings stored in env vars / config
  return NextResponse.json({
    globalBudgetCapUsd: parseFloat(process.env.AGENT_BUDGET_CAP_USD ?? "500"),
    maxActiveAgents: parseInt(process.env.MAX_ACTIVE_AGENTS ?? "10", 10),
    shadowModeDurationDays: parseInt(
      process.env.SHADOW_MODE_DURATION_DAYS ?? "14",
      10
    ),
    canaryApprovalThreshold: parseInt(
      process.env.CANARY_APPROVAL_THRESHOLD ?? "5",
      10
    ),
    autoRetireAccuracyThreshold: parseFloat(
      process.env.AUTO_RETIRE_ACCURACY ?? "0.8"
    ),
    defaultModel: process.env.DEFAULT_AGENT_MODEL ?? "deepseek-v3",
    vpsApiUrl: process.env.VPS_API_URL ?? null,
    redisConfigured: !!process.env.REDIS_URL,
    qdrantConfigured: !!process.env.QDRANT_URL,
  });
}
