import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { TemplateService } from "@/lib/admin/services/template-service";

type Params = { params: Promise<{ templateId: string }> };

/** GET /api/admin/templates/:templateId/drift — Check drift for all bound chats */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  const { templateId } = await params;

  try {
    const report = await TemplateService.checkDrift(templateId);
    const compliant = report.filter((r) => r.isCompliant).length;
    const drifted = report.filter((r) => !r.isCompliant).length;

    return NextResponse.json({
      templateId,
      totalChats: report.length,
      compliant,
      drifted,
      report,
    });
  } catch (err) {
    console.error(`[admin/templates/${templateId}/drift] failed:`, err);
    return errorResponse("Failed to check drift", 500);
  }
}
