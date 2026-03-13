/**
 * @corp/shared — Cross-platform business logic for Telegram Corp.
 *
 * Platform initialization:
 *   import { initPlatform } from "@corp/shared";
 *   initPlatform(storage, config);
 *
 * Adapter initialization (optional, platform-specific):
 *   import { setMediaCacheAdapter } from "@corp/shared/adapters/media-cache";
 *   import { setNetworkAdapter } from "@corp/shared/adapters/network";
 */

// ─── Platform ────────────────────────────────────────────────────────
export {
  initPlatform,
  getPlatformStorage,
  getPlatformConfig,
  type PlatformStorage,
  type PlatformConfig,
} from "./store/platform";

// ─── Stores ──────────────────────────────────────────────────────────
export { useAuthStore, type WorkCompany } from "./store/auth";
export { useChatsStore } from "./store/chats";
export { useMessagesStore } from "./store/messages";
export { useContactsStore } from "./store/contacts";
export { useCallsStore } from "./store/calls";
export { useFoldersStore } from "./store/folders";
export { useTopicsStore } from "./store/topics";
export { useAvatarsStore } from "./store/avatars";
export { useUploadStore } from "./store/upload";
export { useCorporateStore, type Workspace } from "./store/corporate";
export { useUIStore, setThemeChangeCallback, type ViewType, type CreateFlowState } from "./store/ui";
export { useSyncStore } from "./store/sync";

// ─── Hooks ───────────────────────────────────────────────────────────
export { useDialogs } from "./hooks/useDialogs";
export { useMessages } from "./hooks/useMessages";
export { useRealtimeUpdates } from "./hooks/useRealtimeUpdates";
export { useTelegramClient } from "./hooks/useTelegramClient";
export { useContacts } from "./hooks/useContacts";
export { useCalls } from "./hooks/useCalls";
export { useForumTopics } from "./hooks/useForumTopics";
export { useGlobalSearch } from "./hooks/useGlobalSearch";
export { useAdminRole } from "./hooks/useAdminRole";

// ─── Telegram lib ────────────────────────────────────────────────────
export {
  getTelegramClient,
  getExistingClient,
  connectClient,
  getConnectedClient,
  disconnectClient,
  resetClient,
  saveSession,
} from "./telegram/client";

export {
  startTelegramAuth,
  startQrAuth,
  startMobileQrAuth,
  checkPasswordForMobileQr,
  getPasswordHint,
  getMe,
  resendCode,
  deliveryTypeLabel,
  getLastSendCodeResult,
  type CodeDeliveryType,
  type SendCodeResult,
  type QrTokenData,
  type MobileQrAuthController,
  type MobileQrCheckResult,
} from "./telegram/auth";

// ─── Supabase ────────────────────────────────────────────────────────
export {
  initSupabaseClient,
  getSupabaseClient,
  supabase,
} from "./supabase/client";

export {
  saveTelegramSession,
  loadTelegramSession,
  deleteTelegramSession,
} from "./supabase/session-store";

// ─── Adapters ────────────────────────────────────────────────────────
export {
  setMediaCacheAdapter,
  type MediaCacheAdapter,
} from "./adapters/media-cache";

export {
  setNetworkAdapter,
  type NetworkAdapter,
} from "./adapters/network";

export {
  setNetworkProfilerAdapter,
  type NetworkProfilerAdapter,
  type UploadParams,
} from "./adapters/network-profiler";

export {
  setChatPriorityAdapter,
  type ChatPriorityAdapter,
} from "./adapters/chat-priority";

export {
  setPrefetchManagerAdapter,
  type PrefetchManagerAdapter,
} from "./adapters/prefetch-manager";

// ─── Types ───────────────────────────────────────────────────────────
export type {
  TelegramUser,
  TelegramDialog,
  TelegramMessage,
  TelegramContact,
  TelegramFolder,
  TelegramMedia,
  TelegramReaction,
  TelegramForumTopic,
  TelegramCallRecord,
  TelegramAuthState,
  TextEntity,
  ForwardInfo,
  WebPagePreview,
  GlobalSearchResults,
} from "./types/telegram";

export type {
  AdminRole,
  PolicyConfig,
} from "./types/admin";

export type {
  Database,
} from "./types/database";
