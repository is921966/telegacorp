import { z } from "zod";

// ---- Roles ----

export const adminRoleEnum = z.enum([
  "super_admin",
  "chat_manager",
  "viewer",
  "agent_manager",
  "compliance_officer",
]);

export const assignRoleSchema = z.object({
  telegramId: z.string().min(1),
  role: adminRoleEnum,
});

// ---- Policy Templates ----

const chatBannedRightsSchema = z.object({
  can_send_messages: z.boolean(),
  can_send_media: z.boolean(),
  can_send_polls: z.boolean(),
  can_send_other: z.boolean(),
  can_add_web_page_previews: z.boolean(),
  can_change_info: z.boolean(),
  can_invite_users: z.boolean(),
  can_pin_messages: z.boolean(),
});

const policyConfigSchema = z.object({
  chat_permissions: chatBannedRightsSchema,
  slow_mode_delay: z.number().int().min(0).max(3600),
  message_auto_delete_time: z.number().int().min(0),
  has_protected_content: z.boolean(),
  has_aggressive_anti_spam_enabled: z.boolean(),
  has_hidden_members: z.boolean(),
  join_by_request: z.boolean(),
});

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  config: policyConfigSchema,
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  config: policyConfigSchema.optional(),
  is_active: z.boolean().optional(),
});

export const applyTemplateSchema = z.object({
  chatIds: z.array(z.string()).min(1),
});

// ---- Chat Management ----

export const banUserSchema = z.object({
  userId: z.string(),
  untilDate: z.number().int().optional(),
  revokeMessages: z.boolean().optional(),
});

export const editAdminSchema = z.object({
  userId: z.string(),
  rights: z
    .object({
      changeInfo: z.boolean().optional(),
      postMessages: z.boolean().optional(),
      editMessages: z.boolean().optional(),
      deleteMessages: z.boolean().optional(),
      banUsers: z.boolean().optional(),
      inviteUsers: z.boolean().optional(),
      pinMessages: z.boolean().optional(),
      addAdmins: z.boolean().optional(),
      manageCall: z.boolean().optional(),
    })
    .optional(),
  rank: z.string().max(16).optional(),
});

export const updateChatSettingsSchema = z.object({
  slowModeDelay: z.number().int().min(0).max(3600).optional(),
  noForwards: z.boolean().optional(),
  defaultBannedRights: chatBannedRightsSchema.optional(),
});

export const createInviteLinkSchema = z.object({
  title: z.string().max(255).optional(),
  expireDate: z.number().int().optional(),
  usageLimit: z.number().int().min(0).optional(),
  requestNeeded: z.boolean().optional(),
});

// ---- Agents ----

export const agentStatusEnum = z.enum([
  "draft",
  "proposed",
  "approved",
  "testing",
  "shadow",
  "canary",
  "active",
  "deprecated",
  "retired",
]);

export const patternStatusEnum = z.enum([
  "new",
  "proposed",
  "approved",
  "automated",
  "rejected",
]);

export const createAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  model: z.string().min(1).max(100),
  pattern_id: z.string().uuid().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
  assigned_chats: z.array(z.number()).optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: agentStatusEnum.optional(),
  model: z.string().min(1).max(100).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
  assigned_chats: z.array(z.number()).optional(),
});

export const createPatternSchema = z.object({
  description: z.string().min(1).max(5000),
  frequency: z.string().max(100).optional(),
  avg_duration_minutes: z.number().int().min(0).optional(),
  participants: z.array(z.number()).optional(),
  sample_messages: z.array(z.record(z.string(), z.unknown())).optional(),
  estimated_roi_monthly: z.number().min(0).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const updatePatternSchema = z.object({
  description: z.string().min(1).max(5000).optional(),
  status: patternStatusEnum.optional(),
  frequency: z.string().max(100).optional(),
  estimated_roi_monthly: z.number().min(0).optional(),
});

export const updateMonitoringSchema = z.object({
  monitoring_enabled: z.boolean(),
  consent_obtained_at: z.string().datetime().optional(),
  excluded_topics: z.array(z.string()).optional(),
});

export const submitFeedbackSchema = z.object({
  type: z.enum(["thumbs_up", "thumbs_down", "correction", "comment"]),
  message: z.string().max(5000).optional(),
  original_output: z.string().optional(),
  corrected_output: z.string().optional(),
});

export const sendMessageSchema = z.object({
  chatId: z.union([z.string(), z.number()]),
  text: z.string().min(1).max(4096),
  replyToMsgId: z.number().optional(),
});

// ---- Audit ----

export const auditQuerySchema = z.object({
  adminTelegramId: z.string().optional(),
  actionType: z.string().optional(),
  chatId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---- Helpers ----

/** Parse request body with a Zod schema, returning a NextResponse on failure */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: z.ZodError }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return { error: result.error };
    }
    return { data: result.data };
  } catch {
    return {
      error: new z.ZodError([
        {
          code: "custom",
          message: "Invalid JSON body",
          path: [],
        },
      ]),
    };
  }
}

/** Parse URL search params with a Zod schema */
export function parseQuery<T extends z.ZodType>(
  url: URL,
  schema: T
): { data: z.infer<T> } | { error: z.ZodError } {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const result = schema.safeParse(params);
  if (!result.success) {
    return { error: result.error };
  }
  return { data: result.data };
}
