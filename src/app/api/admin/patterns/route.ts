import { NextResponse, type NextRequest } from "next/server";
import {
  getAdminContext,
  requirePermission,
  errorResponse,
} from "@/lib/admin/api-helpers";
import { createServerSupabase } from "@/lib/supabase/server";
import { parseBody, createPatternSchema } from "@/lib/admin/validation";

/** GET /api/admin/patterns — List automation patterns */
export async function GET(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "patterns:manage");
  if (denied) return denied;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  try {
    const supabase = createServerSupabase();
    let query = supabase
      .from("automation_patterns")
      .select("*")
      .order("detected_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ patterns: data ?? [], total: (data ?? []).length });
  } catch (err) {
    console.error("[admin/patterns] list failed:", err);
    return errorResponse("Failed to list patterns", 500);
  }
}

/** POST /api/admin/patterns — Create pattern (from CI Layer or manually) */
export async function POST(request: NextRequest) {
  const ctx = getAdminContext(request);
  if (!ctx) return errorResponse("Unauthorized", 401);

  const denied = requirePermission(ctx, "patterns:manage");
  if (denied) return denied;

  const parsed = await parseBody(request, createPatternSchema);
  if ("error" in parsed) {
    return NextResponse.json(
      { error: "Validation error", details: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("automation_patterns")
      .insert({
        description: parsed.data.description,
        frequency: parsed.data.frequency ?? null,
        avg_duration_minutes: parsed.data.avg_duration_minutes ?? null,
        participants: parsed.data.participants ?? [],
        sample_messages: parsed.data.sample_messages
          ? (parsed.data.sample_messages as unknown as Record<string, unknown>)
          : null,
        estimated_roi_monthly: parsed.data.estimated_roi_monthly ?? null,
        confidence: parsed.data.confidence ?? null,
        status: "new",
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? "Insert failed");
    return NextResponse.json({ pattern: data }, { status: 201 });
  } catch (err) {
    console.error("[admin/patterns] create failed:", err);
    return errorResponse("Failed to create pattern", 500);
  }
}
