import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

/**
 * Supabase client singleton — lazily initialized from platform config.
 *
 * Call `initSupabaseClient(url, anonKey, options?)` at app startup.
 * Web: pass process.env.NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
 * Mobile: pass from app.json / expo-constants config
 */

let _supabase: SupabaseClient<Database> | null = null;

export function initSupabaseClient(
  url: string,
  anonKey: string,
  options?: Parameters<typeof createClient>[2]
): SupabaseClient<Database> {
  _supabase = createClient<Database>(url, anonKey, options);
  return _supabase;
}

/**
 * Get the Supabase client instance.
 * Throws if initSupabaseClient was not called yet.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!_supabase) {
    throw new Error(
      "[Supabase] Client not initialized. Call initSupabaseClient() at app startup."
    );
  }
  return _supabase;
}

/**
 * Legacy export for backward compatibility with existing code.
 * Uses a Proxy to defer access until initSupabaseClient is called.
 */
export const supabase: SupabaseClient<Database> = new Proxy(
  {} as SupabaseClient<Database>,
  {
    get(_target, prop) {
      const client = getSupabaseClient();
      const value = (client as unknown as Record<string | symbol, unknown>)[prop];
      if (typeof value === "function") {
        return value.bind(client);
      }
      return value;
    },
  }
);
