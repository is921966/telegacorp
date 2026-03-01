import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find sessions not updated in the last 7 days
    const staleDate = new Date(Date.now() - 7 * 86400000).toISOString();

    const { data: staleSessions, error } = await supabase
      .from("telegram_sessions")
      .select("id, user_id, updated_at")
      .eq("is_active", true)
      .lt("updated_at", staleDate);

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Mark stale sessions as inactive
    if (staleSessions && staleSessions.length > 0) {
      const staleIds = staleSessions.map((s) => s.id);

      await supabase
        .from("telegram_sessions")
        .update({ is_active: false })
        .in("id", staleIds);
    }

    return new Response(
      JSON.stringify({
        checked: staleSessions?.length || 0,
        deactivated: staleSessions?.length || 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
