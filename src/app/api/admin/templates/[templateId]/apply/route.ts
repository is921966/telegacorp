import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { TemplateService } from "@/lib/admin/services/template-service";
import { parseBody, applyTemplateSchema } from "@/lib/admin/validation";

type Params = { params: Promise<{ templateId: string }> };

/** POST /api/admin/templates/:templateId/apply — Apply template to chats */
export async function POST(request: NextRequest, { params }: Params) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "templates:apply");
  if (denied) return denied;

  const { templateId } = await params;
  const parsed = await parseBody(request, applyTemplateSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const result = await TemplateService.applyTemplate(
      templateId,
      parsed.data.chatIds,
      ctx.telegramId
    );
    return NextResponse.json({ templateId, ...result });
  } catch (err) {
    console.error(`[admin/templates/${templateId}/apply] failed:`, err);
    return errorResponse("Failed to apply template", 500);
  }
}
