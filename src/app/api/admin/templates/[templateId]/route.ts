import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { TemplateService } from "@/lib/admin/services/template-service";
import { parseBody, updateTemplateSchema } from "@/lib/admin/validation";

type Params = { params: Promise<{ templateId: string }> };

/** GET /api/admin/templates/:templateId — Template details + assigned chats */
export async function GET(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  const { templateId } = await params;

  try {
    const template = await TemplateService.getTemplate(templateId);
    if (!template) return errorResponse("Template not found", 404);

    const chats = await TemplateService.getTemplateChats(templateId);
    return NextResponse.json({ template, chats });
  } catch (err) {
    console.error(`[admin/templates/${templateId}] get failed:`, err);
    return errorResponse("Failed to get template", 500);
  }
}

/** PATCH /api/admin/templates/:templateId — Update template */
export async function PATCH(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "templates:manage");
  if (denied) return denied;

  const { templateId } = await params;
  const parsed = await parseBody(request, updateTemplateSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const template = await TemplateService.updateTemplate(
      templateId,
      parsed.data,
      ctx.userId
    );
    return NextResponse.json({ template });
  } catch (err) {
    console.error(`[admin/templates/${templateId}] update failed:`, err);
    return errorResponse("Failed to update template", 500);
  }
}

/** DELETE /api/admin/templates/:templateId — Deactivate template */
export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "templates:manage");
  if (denied) return denied;

  const { templateId } = await params;

  try {
    await TemplateService.deactivateTemplate(templateId, ctx.userId);
    return NextResponse.json({ templateId, deactivated: true });
  } catch (err) {
    console.error(`[admin/templates/${templateId}] deactivate failed:`, err);
    return errorResponse("Failed to deactivate template", 500);
  }
}
