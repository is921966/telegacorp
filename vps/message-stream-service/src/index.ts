import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, EditedMessage } from "telegram/events";
import { Api } from "telegram";
import { config, validateConfig } from "./config";
import { StreamPublisher, type StreamMessage } from "./stream-publisher";
import { normalizeMessage, shouldProcess } from "./message-handler";

/**
 * Message Stream Service
 *
 * Long-running GramJS client that subscribes to real-time updates
 * from monitored Telegram chats and publishes normalized messages
 * to a Redis Stream for consumption by the Conversation Intelligence Layer.
 *
 * Flow:
 * 1. Connect to Telegram via user session
 * 2. Fetch monitored chat IDs from Vercel API
 * 3. Subscribe to NewMessage / EditedMessage events
 * 4. Normalize → Redis Stream (corp:messages)
 * 5. Periodically refresh monitored chats list
 */

let monitoredChatIds = new Set<string>();
let publisher: StreamPublisher;
let client: TelegramClient;

async function fetchMonitoredChats(): Promise<Set<string>> {
  try {
    const res = await fetch(
      `${config.vercel.apiUrl}/api/service/chats/monitored`,
      {
        headers: {
          Authorization: `Bearer ${config.vercel.serviceToken}`,
        },
      }
    );

    if (!res.ok) {
      console.error(
        `[fetchMonitoredChats] HTTP ${res.status}: ${res.statusText}`
      );
      return monitoredChatIds; // Keep current set on error
    }

    const data = await res.json();
    const chats = data.chats ?? [];
    const ids = new Set<string>(chats.map((c: { chat_id: number }) => String(c.chat_id)));

    console.log(`[fetchMonitoredChats] ${ids.size} monitored chats`);
    return ids;
  } catch (err) {
    console.error("[fetchMonitoredChats] Failed:", err);
    return monitoredChatIds;
  }
}

function handleNewMessage(event: { message: Api.Message }): void {
  const message = event.message;
  if (!message || !shouldProcess(message)) return;

  const chatId = message.chatId ?? message.peerId;
  if (!chatId) return;

  const chatIdStr = String(chatId);
  if (!monitoredChatIds.has(chatIdStr)) return;

  const normalized = normalizeMessage(message, BigInt(chatIdStr));

  publisher.publish(normalized).catch((err) => {
    console.error("[handleNewMessage] Failed to publish:", err);
  });
}

function handleEditedMessage(event: { message: Api.Message }): void {
  const message = event.message;
  if (!message || !shouldProcess(message)) return;

  const chatId = message.chatId ?? message.peerId;
  if (!chatId) return;

  const chatIdStr = String(chatId);
  if (!monitoredChatIds.has(chatIdStr)) return;

  const normalized = normalizeMessage(message, BigInt(chatIdStr));
  normalized.is_edit = true;

  publisher.publish(normalized).catch((err) => {
    console.error("[handleEditedMessage] Failed to publish:", err);
  });
}

async function main(): Promise<void> {
  console.log("=== Message Stream Service ===");
  console.log(`Starting at ${new Date().toISOString()}`);

  // Validate configuration
  validateConfig();

  // Initialize Redis publisher
  publisher = new StreamPublisher();
  console.log("[Redis] Connected");

  // Initialize Telegram client
  const session = new StringSession(config.telegram.session);
  client = new TelegramClient(session, config.telegram.apiId, config.telegram.apiHash, {
    connectionRetries: 5,
    useWSS: false, // TCP for server environments
  });

  await client.connect();
  console.log("[Telegram] Connected");

  // Fetch initial monitored chats
  monitoredChatIds = await fetchMonitoredChats();

  // Register event handlers
  client.addEventHandler(handleNewMessage, new NewMessage({}));
  client.addEventHandler(handleEditedMessage, new EditedMessage({}));
  console.log("[Events] Handlers registered");

  // Periodically refresh monitored chats list
  setInterval(async () => {
    monitoredChatIds = await fetchMonitoredChats();
  }, config.monitoredChatsRefreshMs);

  // Log stream stats periodically
  setInterval(async () => {
    try {
      const len = await publisher.getStreamLength();
      console.log(
        `[Stats] Stream length: ${len} | Monitored chats: ${monitoredChatIds.size}`
      );
    } catch {
      // Non-critical
    }
  }, 300_000); // Every 5 minutes

  console.log("[Service] Running. Listening for messages...");

  // Keep the process alive
  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      console.log("[Service] Shutting down...");
      await client.disconnect();
      await publisher.disconnect();
      resolve();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
