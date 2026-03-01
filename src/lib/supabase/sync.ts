import { supabase } from "./client";

type SyncEventHandler = (payload: Record<string, unknown>) => void;

export function createSyncChannel(userId: string) {
  const channel = supabase.channel(`user-sync:${userId}`, {
    config: {
      broadcast: { self: false, ack: true },
    },
  });

  return channel;
}

export function subscribeToBroadcast(
  channel: ReturnType<typeof createSyncChannel>,
  event: string,
  handler: SyncEventHandler
) {
  channel.on("broadcast", { event }, (payload) => {
    handler(payload.payload as Record<string, unknown>);
  });
}

export async function broadcastEvent(
  channel: ReturnType<typeof createSyncChannel>,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  await channel.send({
    type: "broadcast",
    event,
    payload,
  });
}

export function createPresenceChannel(userId: string, tabId: string) {
  const channel = supabase.channel(`presence:${userId}`, {
    config: { presence: { key: tabId } },
  });

  return channel;
}

export function getPresenceState(
  channel: ReturnType<typeof createPresenceChannel>
) {
  return channel.presenceState();
}

export async function trackPresence(
  channel: ReturnType<typeof createPresenceChannel>,
  tabId: string
): Promise<void> {
  await channel.track({
    tabId,
    online_at: new Date().toISOString(),
  });
}
