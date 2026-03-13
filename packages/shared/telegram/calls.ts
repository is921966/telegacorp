import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { callWithFloodWait, rateLimiter } from "./flood-wait";
import type { TelegramCallRecord } from "../types/telegram";

/**
 * Fetch call history using messages.Search with InputMessagesFilterPhoneCalls.
 * Telegram stores call records as service messages with MessageActionPhoneCall.
 */
export async function getCallHistory(
  client: TelegramClient,
  limit = 50,
  offsetId = 0
): Promise<TelegramCallRecord[]> {
  await rateLimiter.throttle("getCallHistory", 3000);

  // InputMessagesFilterPhoneCalls may not exist in all GramJS versions
  const FilterClass = Api.InputMessagesFilterPhoneCalls;
  if (!FilterClass) {
    console.warn("InputMessagesFilterPhoneCalls not available in this GramJS version");
    return [];
  }

  const result = await callWithFloodWait(() =>
    client.invoke(
      new Api.messages.Search({
        peer: new Api.InputPeerEmpty(),
        q: "",
        filter: new FilterClass({}),
        minDate: 0,
        maxDate: 0,
        offsetId,
        addOffset: 0,
        limit,
        maxId: 0,
        minId: 0,
        hash: BigInt(0) as any,
      })
    )
  );

  // Build users map from result
  const usersMap = new Map<string, Api.User>();
  if ("users" in result) {
    for (const user of (result as { users: Api.TypeUser[] }).users) {
      if (user instanceof Api.User) {
        usersMap.set(user.id.toString(), user);
      }
    }
  }

  const calls: TelegramCallRecord[] = [];

  if ("messages" in result) {
    for (const msg of (result as { messages: Api.TypeMessage[] }).messages) {
      if (!(msg instanceof Api.MessageService)) continue;
      const action = msg.action;
      if (!(action instanceof Api.MessageActionPhoneCall)) continue;

      // Determine the other party
      const isOutgoing = msg.out || false;
      let userId: string;
      if (msg.peerId instanceof Api.PeerUser) {
        userId = msg.peerId.userId.toString();
      } else {
        continue; // phone calls are always 1:1
      }

      const user = usersMap.get(userId);
      const userName = user
        ? ((user.firstName || "") + " " + (user.lastName || "")).trim() || user.username || userId
        : userId;

      // Determine call reason/disposition
      let reason: TelegramCallRecord["reason"] = "hangup";
      if (action.reason) {
        if (action.reason instanceof Api.PhoneCallDiscardReasonMissed) reason = "missed";
        else if (action.reason instanceof Api.PhoneCallDiscardReasonBusy) reason = "busy";
        else if (action.reason instanceof Api.PhoneCallDiscardReasonDisconnect) reason = "disconnect";
        else reason = "hangup";
      }

      calls.push({
        id: msg.id,
        userId,
        userName,
        date: new Date((msg.date || 0) * 1000),
        duration: action.duration || 0,
        isOutgoing,
        isVideo: action.video || false,
        reason,
      });
    }
  }

  return calls;
}
