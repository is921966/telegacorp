import { describe, it, expect, beforeEach, vi } from "vitest";
import { useMessagesStore } from "@/store/messages";
import type { TelegramMessage } from "@/types/telegram";

// ============================================================================
// Mocks for GramJS Api classes — must be hoisted for vi.mock factory
// ============================================================================

const {
  MockPeerUser,
  MockPeerChat,
  MockPeerChannel,
  MockMessage,
  MockUpdateEditMessage,
  MockUpdateEditChannelMessage,
  MockUpdateDeleteMessages,
  MockUpdateDeleteChannelMessages,
  MockUpdateNewChannelMessage,
} = vi.hoisted(() => {
  class MockPeerUser {
    userId: bigint;
    constructor(args: { userId: bigint }) {
      this.userId = args.userId;
    }
  }

  class MockPeerChat {
    chatId: bigint;
    constructor(args: { chatId: bigint }) {
      this.chatId = args.chatId;
    }
  }

  class MockPeerChannel {
    channelId: bigint;
    constructor(args: { channelId: bigint }) {
      this.channelId = args.channelId;
    }
  }

  class MockMessage {
    id: number;
    peerId: MockPeerUser | MockPeerChat | MockPeerChannel;
    senderId: bigint | undefined;
    message: string;
    date: number;
    out: boolean;
    replyTo: { replyToMsgId?: number } | undefined;
    fromId: MockPeerUser | undefined;
    constructor(args: {
      id: number;
      peerId: MockPeerUser | MockPeerChat | MockPeerChannel;
      senderId?: bigint;
      message?: string;
      date?: number;
      out?: boolean;
      replyTo?: { replyToMsgId?: number };
      fromId?: MockPeerUser;
    }) {
      this.id = args.id;
      this.peerId = args.peerId;
      this.senderId = args.senderId;
      this.message = args.message || "";
      this.date = args.date || 0;
      this.out = args.out || false;
      this.replyTo = args.replyTo;
      this.fromId = args.fromId;
    }
  }

  class MockUpdateEditMessage {
    message: MockMessage;
    constructor(args: { message: MockMessage }) {
      this.message = args.message;
    }
  }

  class MockUpdateEditChannelMessage {
    message: MockMessage;
    constructor(args: { message: MockMessage }) {
      this.message = args.message;
    }
  }

  class MockUpdateDeleteMessages {
    messages: number[];
    constructor(args: { messages: number[] }) {
      this.messages = args.messages;
    }
  }

  class MockUpdateDeleteChannelMessages {
    channelId: bigint;
    messages: number[];
    constructor(args: { channelId: bigint; messages: number[] }) {
      this.channelId = args.channelId;
      this.messages = args.messages;
    }
  }

  class MockUpdateNewChannelMessage {
    message: MockMessage;
    constructor(args: { message: MockMessage }) {
      this.message = args.message;
    }
  }

  return {
    MockPeerUser,
    MockPeerChat,
    MockPeerChannel,
    MockMessage,
    MockUpdateEditMessage,
    MockUpdateEditChannelMessage,
    MockUpdateDeleteMessages,
    MockUpdateDeleteChannelMessages,
    MockUpdateNewChannelMessage,
  };
});

// Mock the telegram module
vi.mock("telegram", () => ({
  Api: {
    PeerUser: MockPeerUser,
    PeerChat: MockPeerChat,
    PeerChannel: MockPeerChannel,
    Message: MockMessage,
    UpdateNewChannelMessage: MockUpdateNewChannelMessage,
    UpdateEditMessage: MockUpdateEditMessage,
    UpdateEditChannelMessage: MockUpdateEditChannelMessage,
    UpdateDeleteMessages: MockUpdateDeleteMessages,
    UpdateDeleteChannelMessages: MockUpdateDeleteChannelMessages,
  },
}));

vi.mock("telegram/events", () => {
  class MockNewMessage {
    type = "NewMessage";
    constructor(_args?: Record<string, unknown>) {}
  }
  class MockRaw {
    type = "Raw";
    constructor(_args?: Record<string, unknown>) {}
  }
  return {
    NewMessage: MockNewMessage,
    Raw: MockRaw,
  };
});

// Import AFTER mocking
import {
  peerToDialogId,
  subscribeToNewMessages,
  subscribeToEditedMessages,
  subscribeToDeletedMessages,
} from "@/lib/telegram/updates";
import { Api } from "telegram";

// ============================================================================
// Mock TelegramClient
// ============================================================================

function createMockClient() {
  type Handler = (...args: unknown[]) => void;
  const handlers: Array<{ callback: Handler; event: unknown }> = [];

  return {
    handlers,
    addEventHandler: vi.fn((callback: Handler, event: unknown) => {
      handlers.push({ callback, event });
    }),
    removeEventHandler: vi.fn((callback: Handler, event: unknown) => {
      const idx = handlers.findIndex(
        (h) => h.callback === callback && h.event === event
      );
      if (idx !== -1) handlers.splice(idx, 1);
    }),
    /** Simulate a NewMessage event */
    simulateNewMessage(msg: InstanceType<typeof MockMessage>) {
      for (const h of handlers) {
        h.callback({ message: msg });
      }
    },
    /** Simulate a raw update (edit/delete) */
    simulateRawUpdate(update: unknown) {
      for (const h of handlers) {
        h.callback(update);
      }
    },
  };
}

type MockClient = ReturnType<typeof createMockClient>;

// ============================================================================
// Helper
// ============================================================================

function makeMessage(
  overrides: Partial<TelegramMessage> & { id: number; chatId: string }
): TelegramMessage {
  return {
    text: "",
    date: new Date("2025-01-01"),
    isOutgoing: false,
    ...overrides,
  } as TelegramMessage;
}

// ============================================================================
// Tests
// ============================================================================

describe("peerToDialogId", () => {
  it("returns empty string for undefined", () => {
    expect(peerToDialogId(undefined)).toBe("");
  });

  it("converts PeerUser to positive userId string", () => {
    const peer = new Api.PeerUser({ userId: BigInt(12345) });
    expect(peerToDialogId(peer)).toBe("12345");
  });

  it("converts PeerUser with large userId", () => {
    const peer = new Api.PeerUser({ userId: BigInt("9876543210") });
    expect(peerToDialogId(peer)).toBe("9876543210");
  });

  it("converts PeerChat to negative chatId string", () => {
    const peer = new Api.PeerChat({ chatId: BigInt(67890) });
    expect(peerToDialogId(peer)).toBe("-67890");
  });

  it("converts PeerChannel to -(1e12 + channelId)", () => {
    const peer = new Api.PeerChannel({ channelId: BigInt(555) });
    expect(peerToDialogId(peer)).toBe("-1000000000555");
  });

  it("converts PeerChannel with large channelId", () => {
    const peer = new Api.PeerChannel({ channelId: BigInt("1234567890") });
    expect(peerToDialogId(peer)).toBe("-1001234567890");
  });

  it("matches dialog format: PeerUser userId equals dialog.id for users", () => {
    // In dialogs.ts, user dialogs have positive IDs
    const peer = new Api.PeerUser({ userId: BigInt(42) });
    expect(peerToDialogId(peer)).toBe("42");
  });

  it("matches dialog format: PeerChat becomes negative", () => {
    // In dialogs.ts, group chats have negative IDs
    const peer = new Api.PeerChat({ chatId: BigInt(100) });
    const dialogId = peerToDialogId(peer);
    expect(Number(dialogId)).toBeLessThan(0);
    expect(dialogId).toBe("-100");
  });

  it("matches dialog format: PeerChannel becomes -(1e12 + channelId)", () => {
    // In dialogs.ts, channels have IDs like -(1000000000000 + channelId)
    const peer = new Api.PeerChannel({ channelId: BigInt(777) });
    const dialogId = peerToDialogId(peer);
    expect(Number(dialogId)).toBeLessThan(0);
    expect(dialogId).toBe("-1000000000777");
  });
});

describe("subscribeToNewMessages", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("registers two event handlers on the client (NewMessage + Raw)", () => {
    const handler = vi.fn();
    subscribeToNewMessages(mockClient as unknown as import("telegram").TelegramClient, handler);
    expect(mockClient.addEventHandler).toHaveBeenCalledTimes(2);
  });

  it("returns an unsubscribe function", () => {
    const handler = vi.fn();
    const unsub = subscribeToNewMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      handler
    );
    expect(typeof unsub).toBe("function");
  });

  it("calls handler with correct TelegramMessage for PeerUser", () => {
    const handler = vi.fn();
    subscribeToNewMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    const msg = new MockMessage({
      id: 42,
      peerId: new MockPeerUser({ userId: BigInt(100) }),
      senderId: BigInt(100),
      message: "Hello!",
      date: 1700000000,
      out: false,
    });

    mockClient.simulateNewMessage(msg);

    expect(handler).toHaveBeenCalledOnce();
    const received = handler.mock.calls[0][0] as TelegramMessage;
    expect(received.id).toBe(42);
    expect(received.chatId).toBe("100");
    expect(received.text).toBe("Hello!");
    expect(received.isOutgoing).toBe(false);
    expect(received.date).toBeInstanceOf(Date);
    expect(received.date.getTime()).toBe(1700000000 * 1000);
  });

  it("calls handler with correct chatId for PeerChat (group)", () => {
    const handler = vi.fn();
    subscribeToNewMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    const msg = new MockMessage({
      id: 1,
      peerId: new MockPeerChat({ chatId: BigInt(500) }),
      message: "Group msg",
      date: 1700000000,
    });

    mockClient.simulateNewMessage(msg);

    const received = handler.mock.calls[0][0] as TelegramMessage;
    expect(received.chatId).toBe("-500");
  });

  it("calls handler with correct chatId for PeerChannel", () => {
    const handler = vi.fn();
    subscribeToNewMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    const msg = new MockMessage({
      id: 1,
      peerId: new MockPeerChannel({ channelId: BigInt(123) }),
      message: "Channel msg",
      date: 1700000000,
    });

    mockClient.simulateNewMessage(msg);

    const received = handler.mock.calls[0][0] as TelegramMessage;
    expect(received.chatId).toBe("-1000000000123");
  });

  it("does not call handler when message is undefined", () => {
    const handler = vi.fn();
    subscribeToNewMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    // Simulate event with no message
    for (const h of mockClient.handlers) {
      h.callback({ message: undefined });
    }

    expect(handler).not.toHaveBeenCalled();
  });

  it("passes replyToId when present", () => {
    const handler = vi.fn();
    subscribeToNewMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    const msg = new MockMessage({
      id: 10,
      peerId: new MockPeerUser({ userId: BigInt(1) }),
      message: "Reply",
      date: 1700000000,
      replyTo: { replyToMsgId: 5 },
    });

    mockClient.simulateNewMessage(msg);

    const received = handler.mock.calls[0][0] as TelegramMessage;
    expect(received.replyToId).toBe(5);
  });

  it("marks outgoing messages correctly", () => {
    const handler = vi.fn();
    subscribeToNewMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    const msg = new MockMessage({
      id: 1,
      peerId: new MockPeerUser({ userId: BigInt(1) }),
      message: "Sent",
      date: 1700000000,
      out: true,
    });

    mockClient.simulateNewMessage(msg);

    const received = handler.mock.calls[0][0] as TelegramMessage;
    expect(received.isOutgoing).toBe(true);
  });

  it("unsubscribe removes both handlers from client", () => {
    const handler = vi.fn();
    const unsub = subscribeToNewMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      handler
    );

    expect(mockClient.handlers).toHaveLength(2);

    unsub();

    expect(mockClient.removeEventHandler).toHaveBeenCalledTimes(2);
    expect(mockClient.handlers).toHaveLength(0);
  });

  it("after unsubscribe, simulated messages are not delivered", () => {
    const handler = vi.fn();
    const unsub = subscribeToNewMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      handler
    );

    unsub();

    const msg = new MockMessage({
      id: 1,
      peerId: new MockPeerUser({ userId: BigInt(1) }),
      message: "Should not arrive",
      date: 1700000000,
    });

    mockClient.simulateNewMessage(msg);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("subscribeToEditedMessages", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("handles UpdateEditMessage for regular chats", () => {
    const handler = vi.fn();
    subscribeToEditedMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    const msg = new MockMessage({
      id: 5,
      peerId: new MockPeerUser({ userId: BigInt(200) }),
      fromId: new MockPeerUser({ userId: BigInt(200) }),
      message: "Edited text",
      date: 1700000000,
      out: false,
    });

    const update = new MockUpdateEditMessage({ message: msg });
    mockClient.simulateRawUpdate(update);

    expect(handler).toHaveBeenCalledOnce();
    const received = handler.mock.calls[0][0] as TelegramMessage;
    expect(received.id).toBe(5);
    expect(received.chatId).toBe("200");
    expect(received.text).toBe("Edited text");
    expect(received.isEdited).toBe(true);
  });

  it("handles UpdateEditChannelMessage", () => {
    const handler = vi.fn();
    subscribeToEditedMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    const msg = new MockMessage({
      id: 10,
      peerId: new MockPeerChannel({ channelId: BigInt(300) }),
      message: "Channel edit",
      date: 1700000000,
    });

    const update = new MockUpdateEditChannelMessage({ message: msg });
    mockClient.simulateRawUpdate(update);

    expect(handler).toHaveBeenCalledOnce();
    const received = handler.mock.calls[0][0] as TelegramMessage;
    expect(received.chatId).toBe("-1000000000300");
    expect(received.isEdited).toBe(true);
  });

  it("ignores non-edit updates", () => {
    const handler = vi.fn();
    subscribeToEditedMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    // Send a delete update — should be ignored by edit handler
    const update = new MockUpdateDeleteMessages({ messages: [1] });
    mockClient.simulateRawUpdate(update);

    expect(handler).not.toHaveBeenCalled();
  });

  it("returns working unsubscribe function", () => {
    const handler = vi.fn();
    const unsub = subscribeToEditedMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      handler
    );

    expect(mockClient.handlers).toHaveLength(1);
    unsub();
    expect(mockClient.handlers).toHaveLength(0);
  });
});

describe("subscribeToDeletedMessages", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("handles UpdateDeleteMessages with empty chatId", () => {
    const handler = vi.fn();
    subscribeToDeletedMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    const update = new MockUpdateDeleteMessages({ messages: [1, 2, 3] });
    mockClient.simulateRawUpdate(update);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("", [1, 2, 3]);
  });

  it("handles UpdateDeleteChannelMessages with correct chatId", () => {
    const handler = vi.fn();
    subscribeToDeletedMessages(mockClient as unknown as import("telegram").TelegramClient, handler);

    const update = new MockUpdateDeleteChannelMessages({
      channelId: BigInt(999),
      messages: [10, 20],
    });
    mockClient.simulateRawUpdate(update);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("-1000000000999", [10, 20]);
  });

  it("returns working unsubscribe function", () => {
    const handler = vi.fn();
    const unsub = subscribeToDeletedMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      handler
    );

    unsub();
    expect(mockClient.handlers).toHaveLength(0);
  });
});

describe("handler leak prevention", () => {
  it("multiple subscribe+unsubscribe cycles do not accumulate handlers", () => {
    const mockClient = createMockClient();
    const client = mockClient as unknown as import("telegram").TelegramClient;

    // Simulate 5 mount/unmount cycles
    for (let i = 0; i < 5; i++) {
      const unsub1 = subscribeToNewMessages(client, vi.fn());
      const unsub2 = subscribeToEditedMessages(client, vi.fn());
      const unsub3 = subscribeToDeletedMessages(client, vi.fn());

      // Unmount — clean up
      unsub1();
      unsub2();
      unsub3();
    }

    expect(mockClient.handlers).toHaveLength(0);
    // subscribeToNewMessages registers 2 handlers, others register 1 each = 4 per cycle × 5 = 20
    expect(mockClient.addEventHandler).toHaveBeenCalledTimes(20);
    expect(mockClient.removeEventHandler).toHaveBeenCalledTimes(20);
  });

  it("without unsubscribe, handlers accumulate (demonstrates the bug)", () => {
    const mockClient = createMockClient();
    const client = mockClient as unknown as import("telegram").TelegramClient;
    const handler = vi.fn();

    // Simulate 3 mount cycles WITHOUT unsubscribing (old buggy behavior)
    subscribeToNewMessages(client, handler);
    subscribeToNewMessages(client, handler);
    subscribeToNewMessages(client, handler);

    // 6 handlers accumulated (2 per subscribe call) — this was the bug!
    expect(mockClient.handlers).toHaveLength(6);

    // A single message triggers the handler 3 times (only NewMessage handlers dispatch, Raw handlers skip)
    const msg = new MockMessage({
      id: 1,
      peerId: new MockPeerUser({ userId: BigInt(1) }),
      message: "test",
      date: 1700000000,
    });
    mockClient.simulateNewMessage(msg);

    expect(handler).toHaveBeenCalledTimes(3);
  });
});

describe("store integration: addMessage from real-time update", () => {
  beforeEach(() => {
    useMessagesStore.getState().reset();
  });

  it("adds incoming real-time message to correct chat in store", () => {
    const mockClient = createMockClient();
    const { addMessage } = useMessagesStore.getState();

    // Pre-populate a chat
    useMessagesStore.getState().setMessages("100", [
      makeMessage({ id: 1, chatId: "100", text: "Existing" }),
    ]);

    subscribeToNewMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      (msg) => addMessage(msg.chatId, msg)
    );

    const msg = new MockMessage({
      id: 2,
      peerId: new MockPeerUser({ userId: BigInt(100) }),
      senderId: BigInt(100),
      message: "New real-time message",
      date: 1700000000,
    });

    mockClient.simulateNewMessage(msg);

    const messages = useMessagesStore.getState().messagesByChat["100"];
    expect(messages).toHaveLength(2);
    expect(messages[1].text).toBe("New real-time message");
    expect(messages[1].chatId).toBe("100");
  });

  it("adds message for a new chat (not yet in store)", () => {
    const mockClient = createMockClient();
    const { addMessage } = useMessagesStore.getState();

    subscribeToNewMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      (msg) => addMessage(msg.chatId, msg)
    );

    const msg = new MockMessage({
      id: 1,
      peerId: new MockPeerChat({ chatId: BigInt(500) }),
      message: "Group message",
      date: 1700000000,
    });

    mockClient.simulateNewMessage(msg);

    const messages = useMessagesStore.getState().messagesByChat["-500"];
    expect(messages).toHaveLength(1);
    expect(messages[0].chatId).toBe("-500");
  });

  it("deduplicates when real-time delivers a message already in store", () => {
    const mockClient = createMockClient();
    const { addMessage } = useMessagesStore.getState();

    // Optimistic add from send
    useMessagesStore.getState().setMessages("100", [
      makeMessage({ id: 42, chatId: "100", text: "Optimistic" }),
    ]);

    subscribeToNewMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      (msg) => addMessage(msg.chatId, msg)
    );

    // Real-time delivers same message id
    const msg = new MockMessage({
      id: 42,
      peerId: new MockPeerUser({ userId: BigInt(100) }),
      message: "From server",
      date: 1700000000,
    });

    mockClient.simulateNewMessage(msg);

    const messages = useMessagesStore.getState().messagesByChat["100"];
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("Optimistic"); // original kept, not overwritten
  });

  it("handles channel messages with correct dialog ID", () => {
    const mockClient = createMockClient();
    const { addMessage } = useMessagesStore.getState();

    subscribeToNewMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      (msg) => addMessage(msg.chatId, msg)
    );

    const msg = new MockMessage({
      id: 1,
      peerId: new MockPeerChannel({ channelId: BigInt(1234567890) }),
      message: "Channel post",
      date: 1700000000,
    });

    mockClient.simulateNewMessage(msg);

    const expectedChatId = "-1001234567890";
    const messages = useMessagesStore.getState().messagesByChat[expectedChatId];
    expect(messages).toHaveLength(1);
    expect(messages[0].chatId).toBe(expectedChatId);
  });
});

describe("store integration: deleteMessages with empty chatId", () => {
  beforeEach(() => {
    useMessagesStore.getState().reset();
  });

  it("deletes messages across all chats when chatId is empty", () => {
    useMessagesStore.getState().setMessages("chat1", [
      makeMessage({ id: 1, chatId: "chat1", text: "A" }),
      makeMessage({ id: 2, chatId: "chat1", text: "B" }),
    ]);
    useMessagesStore.getState().setMessages("chat2", [
      makeMessage({ id: 3, chatId: "chat2", text: "C" }),
    ]);

    // Non-channel delete — empty chatId
    useMessagesStore.getState().deleteMessages("", [2]);

    expect(useMessagesStore.getState().messagesByChat["chat1"]).toHaveLength(1);
    expect(useMessagesStore.getState().messagesByChat["chat1"][0].id).toBe(1);
    expect(useMessagesStore.getState().messagesByChat["chat2"]).toHaveLength(1);
  });

  it("handles channel delete with specific chatId", () => {
    const chatId = "-1000000000999";
    useMessagesStore.getState().setMessages(chatId, [
      makeMessage({ id: 10, chatId, text: "Post 1" }),
      makeMessage({ id: 20, chatId, text: "Post 2" }),
      makeMessage({ id: 30, chatId, text: "Post 3" }),
    ]);

    const mockClient = createMockClient();
    const { deleteMessages } = useMessagesStore.getState();

    subscribeToDeletedMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      (deletedChatId, ids) => deleteMessages(deletedChatId, ids)
    );

    const update = new MockUpdateDeleteChannelMessages({
      channelId: BigInt(999),
      messages: [10, 30],
    });
    mockClient.simulateRawUpdate(update);

    const remaining = useMessagesStore.getState().messagesByChat[chatId];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(20);
  });
});

describe("store integration: editMessage from real-time update", () => {
  beforeEach(() => {
    useMessagesStore.getState().reset();
  });

  it("updates message text and marks as edited", () => {
    useMessagesStore.getState().setMessages("200", [
      makeMessage({ id: 5, chatId: "200", text: "Original" }),
    ]);

    const mockClient = createMockClient();
    const { updateMessage } = useMessagesStore.getState();

    subscribeToEditedMessages(
      mockClient as unknown as import("telegram").TelegramClient,
      (msg) => updateMessage(msg.chatId, msg.id, { text: msg.text, isEdited: true })
    );

    const editedMsg = new MockMessage({
      id: 5,
      peerId: new MockPeerUser({ userId: BigInt(200) }),
      fromId: new MockPeerUser({ userId: BigInt(200) }),
      message: "Edited text",
      date: 1700000000,
    });

    const update = new MockUpdateEditMessage({ message: editedMsg });
    mockClient.simulateRawUpdate(update);

    const messages = useMessagesStore.getState().messagesByChat["200"];
    expect(messages[0].text).toBe("Edited text");
    expect(messages[0].isEdited).toBe(true);
  });
});

describe("full pipeline: subscribe → event → store", () => {
  beforeEach(() => {
    useMessagesStore.getState().reset();
  });

  it("simulates full real-time lifecycle: new msg → edit → delete", () => {
    const mockClient = createMockClient();
    const client = mockClient as unknown as import("telegram").TelegramClient;

    const store = useMessagesStore.getState();

    // Subscribe to all event types
    const unsub1 = subscribeToNewMessages(client, (msg) =>
      store.addMessage(msg.chatId, msg)
    );
    const unsub2 = subscribeToEditedMessages(client, (msg) =>
      store.updateMessage(msg.chatId, msg.id, { text: msg.text, isEdited: true })
    );
    const unsub3 = subscribeToDeletedMessages(client, (chatId, ids) =>
      store.deleteMessages(chatId, ids)
    );

    // 1. New message arrives
    const newMsg = new MockMessage({
      id: 1,
      peerId: new MockPeerUser({ userId: BigInt(42) }),
      message: "Hello",
      date: 1700000000,
    });
    mockClient.simulateNewMessage(newMsg);

    expect(useMessagesStore.getState().messagesByChat["42"]).toHaveLength(1);
    expect(useMessagesStore.getState().messagesByChat["42"][0].text).toBe("Hello");

    // 2. Message is edited
    const editedMsg = new MockMessage({
      id: 1,
      peerId: new MockPeerUser({ userId: BigInt(42) }),
      fromId: new MockPeerUser({ userId: BigInt(42) }),
      message: "Hello, edited!",
      date: 1700000000,
    });
    const editUpdate = new MockUpdateEditMessage({ message: editedMsg });
    mockClient.simulateRawUpdate(editUpdate);

    expect(useMessagesStore.getState().messagesByChat["42"][0].text).toBe(
      "Hello, edited!"
    );
    expect(useMessagesStore.getState().messagesByChat["42"][0].isEdited).toBe(true);

    // 3. Message is deleted
    const deleteUpdate = new MockUpdateDeleteMessages({ messages: [1] });
    mockClient.simulateRawUpdate(deleteUpdate);

    expect(useMessagesStore.getState().messagesByChat["42"]).toHaveLength(0);

    // Cleanup
    unsub1();
    unsub2();
    unsub3();
    expect(mockClient.handlers).toHaveLength(0);
  });

  it("handles multiple messages from different chat types simultaneously", () => {
    const mockClient = createMockClient();
    const client = mockClient as unknown as import("telegram").TelegramClient;
    const store = useMessagesStore.getState();

    subscribeToNewMessages(client, (msg) =>
      store.addMessage(msg.chatId, msg)
    );

    // User message
    mockClient.simulateNewMessage(
      new MockMessage({
        id: 1,
        peerId: new MockPeerUser({ userId: BigInt(100) }),
        message: "DM",
        date: 1700000000,
      })
    );

    // Group message
    mockClient.simulateNewMessage(
      new MockMessage({
        id: 2,
        peerId: new MockPeerChat({ chatId: BigInt(200) }),
        message: "Group",
        date: 1700000001,
      })
    );

    // Channel post
    mockClient.simulateNewMessage(
      new MockMessage({
        id: 3,
        peerId: new MockPeerChannel({ channelId: BigInt(300) }),
        message: "Channel",
        date: 1700000002,
      })
    );

    const state = useMessagesStore.getState();
    expect(state.messagesByChat["100"]).toHaveLength(1);
    expect(state.messagesByChat["-200"]).toHaveLength(1);
    expect(state.messagesByChat["-1000000000300"]).toHaveLength(1);

    expect(state.messagesByChat["100"][0].text).toBe("DM");
    expect(state.messagesByChat["-200"][0].text).toBe("Group");
    expect(state.messagesByChat["-1000000000300"][0].text).toBe("Channel");
  });
});
