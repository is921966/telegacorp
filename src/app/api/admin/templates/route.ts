import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { TemplateService } from "@/lib/admin/services/template-service";
import { parseBody, createTemplateSchema } from "@/lib/admin/validation";

/** GET /api/admin/templates — List policy templates */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "chats:read");
  if (denied) return denied;

  try {
    const templates = await TemplateService.listTemplates();
    return NextResponse.json({ templates, total: templates.length });
  } catch (err) {
    console.error("[admin/templates] list failed:", err);
    return errorResponse("Failed to list templates", 500);
  }
}

/** POST /api/admin/templates — Create template */
export async function POST(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "templates:manage");
  if (denied) return denied;

  const parsed = await parseBody(request, createTemplateSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const template = await TemplateService.createTemplate({
      name: parsed.data.name,
      description: parsed.data.description,
      config: parsed.data.config,
      createdBy: ctx.userId,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    console.error("[admin/templates] create failed:", err);
    return errorResponse("Failed to create template", 500);
  }
}
