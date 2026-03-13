import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { callWithFloodWait, rateLimiter } from "./flood-wait";
import type { TelegramContact } from "../types/telegram";

/**
 * Fetch the user's full contact list.
 * Uses contacts.GetContacts which returns all contacts in one call.
 */
export async function getContacts(
  client: TelegramClient
): Promise<TelegramContact[]> {
  await rateLimiter.throttle("getContacts", 5000);

  const result = await callWithFloodWait(() =>
    client.invoke(new Api.contacts.GetContacts({ hash: BigInt(0) as any }))
  );

  if (!(result instanceof Api.contacts.Contacts)) {
    return []; // contacts.ContactsNotModified
  }

  // Build a map of users by ID for efficient lookup
  const usersMap = new Map<string, Api.User>();
  for (const user of result.users) {
    if (user instanceof Api.User) {
      usersMap.set(user.id.toString(), user);
    }
  }

  return result.contacts
    .map((contact) => {
      const user = usersMap.get(contact.userId.toString());
      if (!user) return null;

      let isOnline = false;
      let lastSeen: Date | undefined;
      if (user.status instanceof Api.UserStatusOnline) {
        isOnline = true;
      } else if (user.status instanceof Api.UserStatusOffline) {
        lastSeen = new Date(user.status.wasOnline * 1000);
      }

      return {
        id: user.id.toString(),
        firstName: user.firstName || "",
        lastName: user.lastName || undefined,
        username: user.username || undefined,
        phone: user.phone || undefined,
        isOnline,
        lastSeen,
        isMutual: contact.mutual || false,
      } as TelegramContact;
    })
    .filter((c): c is TelegramContact => c !== null);
}

/**
 * Search contacts and global users by query string.
 * Uses contacts.Search which searches both contacts and global Telegram users.
 */
export async function searchContacts(
  client: TelegramClient,
  query: string,
  limit = 20
): Promise<{ myContacts: TelegramContact[]; globalUsers: TelegramContact[] }> {
  await rateLimiter.throttle("searchContacts", 2000);

  const result = await callWithFloodWait(() =>
    client.invoke(new Api.contacts.Search({ q: query, limit }))
  );

  const mapUser = (user: Api.TypeUser): TelegramContact | null => {
    if (!(user instanceof Api.User)) return null;
    let isOnline = false;
    let lastSeen: Date | undefined;
    if (user.status instanceof Api.UserStatusOnline) isOnline = true;
    else if (user.status instanceof Api.UserStatusOffline) {
      lastSeen = new Date(user.status.wasOnline * 1000);
    }
    return {
      id: user.id.toString(),
      firstName: user.firstName || "",
      lastName: user.lastName || undefined,
      username: user.username || undefined,
      phone: user.phone || undefined,
      isOnline,
      lastSeen,
    };
  };

  const usersMap = new Map<string, Api.TypeUser>();
  for (const u of result.users) {
    if (u instanceof Api.User) usersMap.set(u.id.toString(), u);
  }

  const myContacts: TelegramContact[] = [];
  const globalUsers: TelegramContact[] = [];

  for (const peer of result.myResults || []) {
    if (peer instanceof Api.PeerUser) {
      const u = usersMap.get(peer.userId.toString());
      if (u) {
        const c = mapUser(u);
        if (c) myContacts.push(c);
      }
    }
  }

  for (const peer of result.results || []) {
    if (peer instanceof Api.PeerUser) {
      const u = usersMap.get(peer.userId.toString());
      if (u) {
        const c = mapUser(u);
        if (c && !myContacts.find((mc) => mc.id === c.id)) {
          globalUsers.push(c);
        }
      }
    }
  }

  return { myContacts, globalUsers };
}
