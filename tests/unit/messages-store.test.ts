import { describe, it, expect, beforeEach } from "vitest";
import { useMessagesStore } from "@/store/messages";
import type { TelegramMessage } from "@/types/telegram";

/** Helper to build a minimal TelegramMessage for testing. */
function makeMessage(overrides: Partial<TelegramMessage> & { id: number; chatId: string }): TelegramMessage {
  return {
    text: "",
    date: new Date("2025-01-01"),
    isOutgoing: false,
    ...overrides,
  } as TelegramMessage;
}

describe("useMessagesStore", () => {
  beforeEach(() => {
    // Reset the store before each test
    useMessagesStore.getState().reset();
  });

  describe("setMessages", () => {
    it("stores messages for a chat", () => {
      const messages = [
        makeMessage({ id: 1, chatId: "chat1", text: "Hello" }),
        makeMessage({ id: 2, chatId: "chat1", text: "World" }),
      ];

      useMessagesStore.getState().setMessages("chat1", messages);

      const state = useMessagesStore.getState();
      expect(state.messagesByChat["chat1"]).toHaveLength(2);
      expect(state.messagesByChat["chat1"][0].text).toBe("Hello");
      expect(state.messagesByChat["chat1"][1].text).toBe("World");
    });

    it("sets isLoading to false", () => {
      useMessagesStore.getState().setLoading(true);
      useMessagesStore.getState().setMessages("chat1", []);

      expect(useMessagesStore.getState().isLoading).toBe(false);
    });
  });

  describe("addMessage", () => {
    it("appends a new message to the chat", () => {
      const existing = [makeMessage({ id: 1, chatId: "chat1", text: "First" })];
      useMessagesStore.getState().setMessages("chat1", existing);

      const newMsg = makeMessage({ id: 2, chatId: "chat1", text: "Second" });
      useMessagesStore.getState().addMessage("chat1", newMsg);

      const messages = useMessagesStore.getState().messagesByChat["chat1"];
      expect(messages).toHaveLength(2);
      expect(messages[1].text).toBe("Second");
    });

    it("deduplicates messages with the same id", () => {
      const existing = [makeMessage({ id: 1, chatId: "chat1", text: "First" })];
      useMessagesStore.getState().setMessages("chat1", existing);

      const duplicate = makeMessage({ id: 1, chatId: "chat1", text: "Duplicate" });
      useMessagesStore.getState().addMessage("chat1", duplicate);

      const messages = useMessagesStore.getState().messagesByChat["chat1"];
      expect(messages).toHaveLength(1);
      expect(messages[0].text).toBe("First"); // original kept
    });

    it("creates the array when chat has no existing messages", () => {
      const msg = makeMessage({ id: 1, chatId: "newChat", text: "Init" });
      useMessagesStore.getState().addMessage("newChat", msg);

      expect(useMessagesStore.getState().messagesByChat["newChat"]).toHaveLength(1);
    });
  });

  describe("prependMessages", () => {
    it("adds messages to the beginning", () => {
      const existing = [makeMessage({ id: 3, chatId: "chat1", text: "Third" })];
      useMessagesStore.getState().setMessages("chat1", existing);

      const older = [
        makeMessage({ id: 1, chatId: "chat1", text: "First" }),
        makeMessage({ id: 2, chatId: "chat1", text: "Second" }),
      ];
      useMessagesStore.getState().prependMessages("chat1", older);

      const messages = useMessagesStore.getState().messagesByChat["chat1"];
      expect(messages).toHaveLength(3);
      expect(messages[0].text).toBe("First");
      expect(messages[1].text).toBe("Second");
      expect(messages[2].text).toBe("Third");
    });

    it("deduplicates when prepending", () => {
      const existing = [
        makeMessage({ id: 2, chatId: "chat1", text: "Existing" }),
        makeMessage({ id: 3, chatId: "chat1", text: "Also existing" }),
      ];
      useMessagesStore.getState().setMessages("chat1", existing);

      const prepend = [
        makeMessage({ id: 1, chatId: "chat1", text: "New" }),
        makeMessage({ id: 2, chatId: "chat1", text: "Duplicate" }),
      ];
      useMessagesStore.getState().prependMessages("chat1", prepend);

      const messages = useMessagesStore.getState().messagesByChat["chat1"];
      expect(messages).toHaveLength(3);
      // id=1 (new) + id=2 (existing, kept) + id=3 (existing)
      expect(messages.map((m) => m.id)).toEqual([1, 2, 3]);
      expect(messages[1].text).toBe("Existing"); // original kept, not "Duplicate"
    });
  });

  describe("updateMessage", () => {
    it("updates a specific message by id", () => {
      const messages = [
        makeMessage({ id: 1, chatId: "chat1", text: "Original" }),
        makeMessage({ id: 2, chatId: "chat1", text: "Untouched" }),
      ];
      useMessagesStore.getState().setMessages("chat1", messages);

      useMessagesStore.getState().updateMessage("chat1", 1, {
        text: "Edited",
        isEdited: true,
      });

      const updated = useMessagesStore.getState().messagesByChat["chat1"];
      expect(updated[0].text).toBe("Edited");
      expect(updated[0].isEdited).toBe(true);
      expect(updated[1].text).toBe("Untouched");
    });

    it("does not fail when chat does not exist (results in empty array)", () => {
      useMessagesStore.getState().updateMessage("nonexistent", 1, { text: "x" });

      expect(useMessagesStore.getState().messagesByChat["nonexistent"]).toEqual([]);
    });
  });

  describe("deleteMessages", () => {
    it("removes messages by ids", () => {
      const messages = [
        makeMessage({ id: 1, chatId: "chat1", text: "A" }),
        makeMessage({ id: 2, chatId: "chat1", text: "B" }),
        makeMessage({ id: 3, chatId: "chat1", text: "C" }),
      ];
      useMessagesStore.getState().setMessages("chat1", messages);

      useMessagesStore.getState().deleteMessages("chat1", [1, 3]);

      const remaining = useMessagesStore.getState().messagesByChat["chat1"];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(2);
    });
  });

  describe("clearChat", () => {
    it("removes messages for one chat but keeps others", () => {
      useMessagesStore
        .getState()
        .setMessages("chat1", [makeMessage({ id: 1, chatId: "chat1", text: "A" })]);
      useMessagesStore
        .getState()
        .setMessages("chat2", [makeMessage({ id: 2, chatId: "chat2", text: "B" })]);

      useMessagesStore.getState().clearChat("chat1");

      const state = useMessagesStore.getState();
      expect(state.messagesByChat["chat1"]).toBeUndefined();
      expect(state.messagesByChat["chat2"]).toHaveLength(1);
    });
  });

  describe("reset", () => {
    it("clears all messages, loading state, and hasMore", () => {
      useMessagesStore
        .getState()
        .setMessages("chat1", [makeMessage({ id: 1, chatId: "chat1", text: "A" })]);
      useMessagesStore.getState().setLoading(true);
      useMessagesStore.getState().setHasMore("chat1", true);

      useMessagesStore.getState().reset();

      const state = useMessagesStore.getState();
      expect(state.messagesByChat).toEqual({});
      expect(state.isLoading).toBe(false);
      expect(state.hasMore).toEqual({});
    });
  });
});
