import { supabase } from "./client";
import type { WorkCompany } from "@/store/auth";

/**
 * Load work companies for a Telegram user from the shared Supabase table.
 * Returns an empty array if no row exists yet.
 */
export async function loadWorkCompanies(
  telegramId: string
): Promise<WorkCompany[]> {
  const { data, error } = await supabase
    .from("work_companies")
    .select("companies")
    .eq("telegram_id", telegramId)
    .single();

  if (error || !data) return [];

  const companies = data.companies;
  if (!Array.isArray(companies)) return [];

  return companies as WorkCompany[];
}

/**
 * Save (upsert) work companies for a Telegram user to the shared Supabase table.
 */
export async function saveWorkCompanies(
  telegramId: string,
  companies: WorkCompany[]
): Promise<void> {
  const { error } = await supabase.from("work_companies").upsert(
    {
      telegram_id: telegramId,
      companies: companies as { email: string; enabled: boolean }[],
      updated_at: new Date().toISOString(),
    },
    { onConflict: "telegram_id" }
  );

  if (error) {
    console.error("[WorkCompanies] Failed to save:", error);
    throw error;
  }
}
