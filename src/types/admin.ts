// ============================================================
// Admin Panel types — RBAC, Policies, Audit
// ============================================================

/** Available admin roles */
export type AdminRole =
  | "super_admin"
  | "chat_manager"
  | "viewer"
  | "agent_manager"
  | "compliance_officer";

/** Granular permissions */
export type AdminPermission =
  | "chats:read"
  | "chats:write"
  | "members:manage"
  | "templates:apply"
  | "templates:manage"
  | "audit:read"
  | "archive:read"
  | "agents:manage"
  | "agents:read"
  | "patterns:manage"
  | "monitoring:manage"
  | "governance:read"
  | "governance:manage"
  | "*";

/** Context extracted from authenticated admin request */
export interface AdminContext {
  telegramId: string;
  role: AdminRole;
}

// ---- Chat Policy types ----

/** Telegram ChatBannedRights mapped to booleans */
export interface ChatBannedRights {
  can_send_messages: boolean;
  can_send_media: boolean;
  can_send_polls: boolean;
  can_send_other: boolean;
  can_add_web_page_previews: boolean;
  can_change_info: boolean;
  can_invite_users: boolean;
  can_pin_messages: boolean;
}

/** Full policy configuration for a chat */
export interface PolicyConfig {
  chat_permissions: ChatBannedRights;
  slow_mode_delay: number;
  message_auto_delete_time: number;
  has_protected_content: boolean;
  has_aggressive_anti_spam_enabled: boolean;
  has_hidden_members: boolean;
  join_by_request: boolean;
}

// ---- Audit types ----

export type AuditResultStatus = "success" | "error" | "partial";

export interface AuditLogEntry {
  id: number;
  admin_telegram_id: string;
  action_type: string;
  target_chat_id: string | null;
  target_user_id: string | null;
  payload: Record<string, unknown> | null;
  result_status: AuditResultStatus;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ChatEventEntry {
  id: number;
  chat_id: string;
  event_id: string;
  date: string;
  user_id: string | null;
  action: string;
  payload: Record<string, unknown> | null;
  collected_at: string;
}

// ---- Template types ----

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string | null;
  config: PolicyConfig;
  is_active: boolean;
  created_by_telegram_id: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

export interface ChatTemplate {
  id: string;
  chat_id: string;
  template_id: string | null;
  applied_at: string;
  last_checked_at: string | null;
  is_compliant: boolean;
  drift_details: Record<string, unknown> | null;
}

// ---- Archive types ----

export interface ChatArchiveState {
  chat_id: number;
  last_collected_msg_id: number;
  last_collected_at: string | null;
  total_messages: number;
  total_files: number;
  is_enabled: boolean;
}

export interface ArchivedMessage {
  id: number;
  chat_id: number;
  message_id: number;
  sender_id: number | null;
  sender_name: string | null;
  text: string | null;
  date: string;
  media_type: string | null;
  media_file_path: string | null;
  media_file_name: string | null;
  media_file_size: number | null;
  reply_to_msg_id: number | null;
  forward_from: string | null;
  is_edited: boolean;
  raw_data: Record<string, unknown> | null;
  collected_at: string;
}

// ---- Admin GramJS helper types ----

export interface ManagedChatInfo {
  id: string;
  title: string;
  type: "supergroup" | "channel" | "group";
  participantCount: number;
  about: string | null;
  templateId: string | null;
  isCompliant: boolean;
  archiveEnabled: boolean;
  driftDetails: Record<string, { expected: unknown; actual: unknown }> | null;
}

export interface ChatParticipantInfo {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  isAdmin: boolean;
  isCreator: boolean;
  isBanned: boolean;
  joinedDate: string | null;
}

export interface InviteLinkInfo {
  link: string;
  title: string | null;
  isRevoked: boolean;
  isPermanent: boolean;
  expireDate: string | null;
  usageLimit: number | null;
  usage: number;
  requestNeeded: boolean;
}
