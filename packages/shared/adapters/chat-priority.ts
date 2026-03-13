/**
 * Chat priority tracker adapter — platform-specific implementations must be injected.
 *
 * Web: src/lib/chat-priority-tracker.ts (IndexedDB-based)
 * Mobile: AsyncStorage or no-op
 */

export interface ChatPriorityAdapter {
  recordChatOpen: (chatId: string) => void;
}

let _adapter: ChatPriorityAdapter = {
  recordChatOpen: () => {},
};

export function setChatPriorityAdapter(adapter: ChatPriorityAdapter): void {
  _adapter = adapter;
}

export function recordChatOpen(chatId: string): void {
  _adapter.recordChatOpen(chatId);
}
