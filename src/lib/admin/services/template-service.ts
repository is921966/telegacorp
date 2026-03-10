import { createServerSupabase } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/admin/api-helpers";
import { ChatManagementService } from "./chat-management";
import type { PolicyConfig, ChatBannedRights, PolicyTemplate } from "@/types/admin";
import type { Database } from "@/types/database";

type PolicyTemplateRow = Database["public"]["Tables"]["policy_templates"]["Row"];
type ChatTemplateRow = Database["public"]["Tables"]["chat_templates"]["Row"];

// ---- Service ----

export class TemplateService {
  /**
   * List all active policy templates.
   */
  static async listTemplates(): Promise<PolicyTemplate[]> {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("policy_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to list templates: ${error.message}`);
    return (data ?? []).map(mapTemplate);
  }

  /**
   * Get a single template by ID.
   */
  static async getTemplate(templateId: string): Promise<PolicyTemplate | null> {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("policy_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (error) return null;
    return mapTemplate(data);
  }

  /**
   * Create a new policy template.
   */
  static async createTemplate(params: {
    name: string;
    description?: string;
    config: PolicyConfig;
    createdBy: string;
  }): Promise<PolicyTemplate> {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("policy_templates")
      .insert({
        name: params.name,
        description: params.description ?? null,
        config: params.config as unknown as Record<string, unknown>,
        created_by_telegram_id: params.createdBy,
      })
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to create template: ${error?.message}`);

    const row = data as unknown as PolicyTemplateRow;

    await logAuditEvent({
      adminTelegramId: params.createdBy,
      actionType: "create_template",
      payload: { templateId: row.id, name: params.name },
      resultStatus: "success",
    });

    return mapTemplate(row);
  }

  /**
   * Update an existing template. Increments version.
   */
  static async updateTemplate(
    templateId: string,
    params: {
      name?: string;
      description?: string;
      config?: PolicyConfig;
      is_active?: boolean;
    },
    adminTelegramId: string
  ): Promise<PolicyTemplate> {
    const supabase = createServerSupabase();

    // Get current version
    const { data: current } = await supabase
      .from("policy_templates")
      .select("version")
      .eq("id", templateId)
      .single();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      version: (current?.version ?? 0) + 1,
    };

    if (params.name !== undefined) updateData.name = params.name;
    if (params.description !== undefined) updateData.description = params.description;
    if (params.config !== undefined) updateData.config = params.config;
    if (params.is_active !== undefined) updateData.is_active = params.is_active;

    const { data, error } = await supabase
      .from("policy_templates")
      .update(updateData)
      .eq("id", templateId)
      .select()
      .single();

    if (error || !data) throw new Error(`Failed to update template: ${error?.message}`);

    await logAuditEvent({
      adminTelegramId,
      actionType: "update_template",
      payload: { templateId, changes: params },
      resultStatus: "success",
    });

    return mapTemplate(data);
  }

  /**
   * Deactivate a template (soft delete).
   */
  static async deactivateTemplate(
    templateId: string,
    adminTelegramId: string
  ): Promise<void> {
    const supabase = createServerSupabase();
    const { error } = await supabase
      .from("policy_templates")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", templateId);

    if (error) throw new Error(`Failed to deactivate template: ${error.message}`);

    await logAuditEvent({
      adminTelegramId,
      actionType: "deactivate_template",
      payload: { templateId },
      resultStatus: "success",
    });
  }

  /**
   * Apply a template to one or more chats.
   * Sends GramJS commands to sync Telegram settings, then records the binding.
   */
  static async applyTemplate(
    templateId: string,
    chatIds: string[],
    adminTelegramId: string
  ): Promise<{ applied: string[]; failed: { chatId: string; error: string }[] }> {
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error("Template not found");

    const config = template.config;
    const supabase = createServerSupabase();
    const applied: string[] = [];
    const failed: { chatId: string; error: string }[] = [];

    for (const chatId of chatIds) {
      try {
        // Apply Telegram settings via GramJS
        await ChatManagementService.updateDefaultRights(
          chatId,
          config.chat_permissions,
          adminTelegramId
        );
        await ChatManagementService.toggleSlowMode(
          chatId,
          config.slow_mode_delay,
          adminTelegramId
        );
        await ChatManagementService.toggleNoForwards(
          chatId,
          config.has_protected_content,
          adminTelegramId
        );

        // Record binding in DB
        await supabase.from("chat_templates").upsert(
          {
            chat_id: chatId,
            template_id: templateId,
            applied_at: new Date().toISOString(),
            is_compliant: true,
            drift_details: null,
          },
          { onConflict: "chat_id" }
        );

        applied.push(chatId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed.push({ chatId, error: message });
      }

      // Rate limit between chats
      if (chatIds.length > 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    await logAuditEvent({
      adminTelegramId,
      actionType: "apply_template",
      payload: { templateId, chatIds, applied, failed },
      resultStatus: failed.length === 0 ? "success" : "partial",
    });

    return { applied, failed };
  }

  /**
   * Check all chats bound to a template for configuration drift.
   */
  static async checkDrift(
    templateId: string
  ): Promise<
    { chatId: string; isCompliant: boolean; driftDetails: Record<string, unknown> | null }[]
  > {
    const template = await this.getTemplate(templateId);
    if (!template) throw new Error("Template not found");

    const supabase = createServerSupabase();
    const { data: bindings } = await supabase
      .from("chat_templates")
      .select("chat_id")
      .eq("template_id", templateId);

    if (!bindings || bindings.length === 0) return [];

    const results: {
      chatId: string;
      isCompliant: boolean;
      driftDetails: Record<string, unknown> | null;
    }[] = [];

    for (const binding of bindings) {
      try {
        const details = await ChatManagementService.getChatDetails(binding.chat_id);
        const drift = detectDrift(template.config, details);

        // Update compliance status in DB
        await supabase
          .from("chat_templates")
          .update({
            last_checked_at: new Date().toISOString(),
            is_compliant: drift === null,
            drift_details: drift,
          })
          .eq("chat_id", binding.chat_id);

        results.push({
          chatId: binding.chat_id,
          isCompliant: drift === null,
          driftDetails: drift,
        });
      } catch (err) {
        results.push({
          chatId: binding.chat_id,
          isCompliant: false,
          driftDetails: {
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }

      // Rate limit between checks
      await new Promise((r) => setTimeout(r, 2000));
    }

    return results;
  }

  /**
   * Get chats assigned to a template.
   */
  static async getTemplateChats(
    templateId: string
  ): Promise<
    { chatId: string; appliedAt: string; isCompliant: boolean; driftDetails: Record<string, unknown> | null }[]
  > {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("chat_templates")
      .select("*")
      .eq("template_id", templateId)
      .order("applied_at", { ascending: false });

    if (error) throw new Error(`Failed to get template chats: ${error.message}`);

    return ((data ?? []) as unknown as ChatTemplateRow[]).map((row) => ({
      chatId: row.chat_id,
      appliedAt: row.applied_at,
      isCompliant: row.is_compliant,
      driftDetails: row.drift_details,
    }));
  }
}

// ---- Helpers ----

/** Map DB row to PolicyTemplate type */
function mapTemplate(row: Record<string, unknown>): PolicyTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    config: row.config as PolicyConfig,
    is_active: row.is_active as boolean,
    created_by_telegram_id: (row.created_by_telegram_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    version: row.version as number,
  };
}

/** Detect drift between expected (template) and actual (chat) configuration */
function detectDrift(
  expected: PolicyConfig,
  actual: {
    slowModeDelay: number;
    defaultBannedRights: ChatBannedRights;
    hasProtectedContent: boolean;
  }
): Record<string, unknown> | null {
  const drifts: Record<string, { expected: unknown; actual: unknown }> = {};

  // Check slow mode
  if (expected.slow_mode_delay !== actual.slowModeDelay) {
    drifts.slow_mode_delay = {
      expected: expected.slow_mode_delay,
      actual: actual.slowModeDelay,
    };
  }

  // Check protected content
  if (expected.has_protected_content !== actual.hasProtectedContent) {
    drifts.has_protected_content = {
      expected: expected.has_protected_content,
      actual: actual.hasProtectedContent,
    };
  }

  // Check each banned right
  const rightKeys = Object.keys(expected.chat_permissions) as (keyof ChatBannedRights)[];
  for (const key of rightKeys) {
    if (expected.chat_permissions[key] !== actual.defaultBannedRights[key]) {
      drifts[`permission.${key}`] = {
        expected: expected.chat_permissions[key],
        actual: actual.defaultBannedRights[key],
      };
    }
  }

  return Object.keys(drifts).length > 0 ? drifts : null;
}
