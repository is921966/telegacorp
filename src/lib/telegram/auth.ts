import type { TelegramClient } from "telegram";

/**
 * Start the full Telegram auth flow using client.start().
 * This correctly handles DC migration and WebSocket transport in browsers.
 *
 * Returns a promise that resolves when auth is complete.
 * The callbacks are called by GramJS to request user input.
 */
export async function startTelegramAuth(
  client: TelegramClient,
  callbacks: {
    onPhoneNumber: () => Promise<string>;
    onCode: () => Promise<string>;
    onPassword: (hint?: string) => Promise<string>;
    onError: (err: Error) => void;
  }
): Promise<void> {
  await client.start({
    phoneNumber: callbacks.onPhoneNumber,
    phoneCode: callbacks.onCode,
    password: callbacks.onPassword,
    onError: callbacks.onError,
  });
}

export async function getMe(client: TelegramClient) {
  const me = await client.getMe();
  return {
    id: me.id.toString(),
    firstName: me.firstName || "",
    lastName: me.lastName || "",
    username: me.username || "",
    phone: me.phone || "",
  };
}
