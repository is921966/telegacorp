import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { callWithFloodWait, rateLimiter } from "./flood-wait";
import type { TelegramContact } from "@/types/telegram";

/**
 * Create a regular group chat with the given users.
 * Returns the new chat ID.
 */
export async function createGroup(
  client: TelegramClient,
  title: string,
  userIds: string[]
): Promise<string> {
  await rateLimiter.throttle("createGroup", 5000);

  const result = await callWithFloodWait(() =>
    client.invoke(
      new Api.messages.CreateChat({
        users: userIds,
        title,
      })
    )
  );

  // CreateChat returns messages.InvitedUsers { updates, missingInvitees }
  const invitedUsers = result as Api.messages.InvitedUsers;
  const updates = invitedUsers.updates;

  if (updates instanceof Api.Updates || updates instanceof Api.UpdatesCombined) {
    for (const chat of updates.chats) {
      if (chat instanceof Api.Chat) {
        // Regular groups use negative chat ID (matches dialog ID format)
        return (-BigInt(chat.id.toString())).toString();
      }
    }
  }

  throw new Error("Failed to extract chat ID from CreateChat result");
}

/**
 * Create a supergroup (megagroup).
 * Returns the new channel ID.
 */
export async function createSupergroup(
  client: TelegramClient,
  title: string,
  about: string
): Promise<string> {
  await rateLimiter.throttle("createSupergroup", 5000);

  const result = await callWithFloodWait(() =>
    client.invoke(
      new Api.channels.CreateChannel({
        title,
        about,
        broadcast: false,
        megagroup: true,
      })
    )
  );

  if (result instanceof Api.Updates || result instanceof Api.UpdatesCombined) {
    for (const chat of result.chats) {
      if (chat instanceof Api.Channel) {
        return `-100${chat.id.toString()}`;
      }
    }
  }

  throw new Error("Failed to extract channel ID from CreateChannel result");
}

/**
 * Create a broadcast channel.
 * Returns the new channel ID.
 */
export async function createChannel(
  client: TelegramClient,
  title: string,
  about: string
): Promise<string> {
  await rateLimiter.throttle("createChannel", 5000);

  const result = await callWithFloodWait(() =>
    client.invoke(
      new Api.channels.CreateChannel({
        title,
        about,
        broadcast: true,
        megagroup: false,
      })
    )
  );

  if (result instanceof Api.Updates || result instanceof Api.UpdatesCombined) {
    for (const chat of result.chats) {
      if (chat instanceof Api.Channel) {
        return `-100${chat.id.toString()}`;
      }
    }
  }

  throw new Error("Failed to extract channel ID from CreateChannel result");
}

/**
 * Edit the title of a group or channel.
 */
export async function editChatTitle(
  client: TelegramClient,
  chatId: string,
  title: string
): Promise<void> {
  await rateLimiter.throttle("editChatTitle", 3000);

  const entity = await client.getEntity(chatId);

  if (entity instanceof Api.Chat) {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.messages.EditChatTitle({
          chatId: entity.id,
          title,
        })
      )
    );
  } else if (entity instanceof Api.Channel) {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.channels.EditTitle({
          channel: entity,
          title,
        })
      )
    );
  }
}

/**
 * Edit the about/description of a group or channel.
 */
export async function editAbout(
  client: TelegramClient,
  chatId: string,
  about: string
): Promise<void> {
  await rateLimiter.throttle("editAbout", 3000);

  const peer = await client.getInputEntity(chatId);

  await callWithFloodWait(() =>
    client.invoke(
      new Api.messages.EditChatAbout({
        peer,
        about,
      })
    )
  );
}

/**
 * Upload and set a group/channel photo.
 */
export async function setChatPhoto(
  client: TelegramClient,
  chatId: string,
  file: File
): Promise<void> {
  await rateLimiter.throttle("setChatPhoto", 3000);

  const { CustomFile } = await import("telegram/client/uploads");
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const toUpload = new CustomFile(file.name, file.size, "", buffer);

  const uploadedFile = await client.uploadFile({
    file: toUpload,
    workers: 1,
  });

  const photo = new Api.InputChatUploadedPhoto({
    file: uploadedFile,
  });

  const entity = await client.getEntity(chatId);

  if (entity instanceof Api.Chat) {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.messages.EditChatPhoto({
          chatId: entity.id,
          photo,
        })
      )
    );
  } else if (entity instanceof Api.Channel) {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.channels.EditPhoto({
          channel: entity,
          photo,
        })
      )
    );
  }
}

/**
 * Delete a group/channel photo.
 */
export async function deleteChatPhoto(
  client: TelegramClient,
  chatId: string
): Promise<void> {
  await rateLimiter.throttle("deleteChatPhoto", 3000);

  const entity = await client.getEntity(chatId);

  if (entity instanceof Api.Chat) {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.messages.EditChatPhoto({
          chatId: entity.id,
          photo: new Api.InputChatPhotoEmpty(),
        })
      )
    );
  } else if (entity instanceof Api.Channel) {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.channels.EditPhoto({
          channel: entity,
          photo: new Api.InputChatPhotoEmpty(),
        })
      )
    );
  }
}

/**
 * Get participants/members of a group or channel.
 */
export async function getParticipants(
  client: TelegramClient,
  chatId: string,
  offset = 0,
  limit = 200
): Promise<{ participants: TelegramContact[]; total: number }> {
  await rateLimiter.throttle("getParticipants", 2000);

  const entity = await client.getEntity(chatId);

  if (entity instanceof Api.Channel) {
    const result = await callWithFloodWait(() =>
      client.invoke(
        new Api.channels.GetParticipants({
          channel: entity,
          filter: new Api.ChannelParticipantsRecent(),
          offset,
          limit,
          hash: BigInt(0) as any,
        })
      )
    );

    if (result instanceof Api.channels.ChannelParticipants) {
      const participants: TelegramContact[] = [];
      for (const user of result.users) {
        if (user instanceof Api.User) {
          participants.push({
            id: user.id.toString(),
            firstName: user.firstName || "",
            lastName: user.lastName || undefined,
            username: user.username || undefined,
            isOnline: user.status instanceof Api.UserStatusOnline,
          });
        }
      }
      return { participants, total: result.count };
    }

    return { participants: [], total: 0 };
  }

  // For regular groups, use getParticipants from GramJS
  if (entity instanceof Api.Chat) {
    const fullChat = await callWithFloodWait(() =>
      client.invoke(
        new Api.messages.GetFullChat({ chatId: entity.id })
      )
    );

    const participants: TelegramContact[] = [];
    for (const user of fullChat.users) {
      if (user instanceof Api.User) {
        participants.push({
          id: user.id.toString(),
          firstName: user.firstName || "",
          lastName: user.lastName || undefined,
          username: user.username || undefined,
          isOnline: user.status instanceof Api.UserStatusOnline,
        });
      }
    }
    return { participants, total: participants.length };
  }

  return { participants: [], total: 0 };
}

/**
 * Add users to a regular group (one at a time).
 */
export async function addChatUsers(
  client: TelegramClient,
  chatId: string,
  userIds: string[],
  fwdLimit = 100
): Promise<void> {
  const entity = await client.getEntity(chatId);

  if (entity instanceof Api.Chat) {
    for (const uid of userIds) {
      await rateLimiter.throttle("addChatUser", 2000);
      await callWithFloodWait(() =>
        client.invoke(
          new Api.messages.AddChatUser({
            chatId: entity.id,
            userId: uid,
            fwdLimit,
          })
        )
      );
    }
  }
}

/**
 * Invite users to a supergroup or channel.
 */
export async function inviteToChannel(
  client: TelegramClient,
  channelId: string,
  userIds: string[]
): Promise<void> {
  await rateLimiter.throttle("inviteToChannel", 3000);

  const channel = await client.getEntity(channelId);

  if (channel instanceof Api.Channel) {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.channels.InviteToChannel({
          channel,
          users: userIds,
        })
      )
    );
  }
}

/**
 * Remove a participant from a group or channel.
 */
export async function removeParticipant(
  client: TelegramClient,
  chatId: string,
  userId: string
): Promise<void> {
  await rateLimiter.throttle("removeParticipant", 3000);

  const entity = await client.getEntity(chatId);

  if (entity instanceof Api.Chat) {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.messages.DeleteChatUser({
          chatId: entity.id,
          userId,
        })
      )
    );
  } else if (entity instanceof Api.Channel) {
    const userEntity = await client.getInputEntity(userId);
    await callWithFloodWait(() =>
      client.invoke(
        new Api.channels.EditBanned({
          channel: entity,
          participant: userEntity,
          bannedRights: new Api.ChatBannedRights({
            untilDate: 0,
            viewMessages: true,
          }),
        })
      )
    );
  }
}

/**
 * Get or create an invite link for a group/channel.
 */
export async function getInviteLink(
  client: TelegramClient,
  chatId: string
): Promise<string> {
  await rateLimiter.throttle("getInviteLink", 3000);

  const peer = await client.getInputEntity(chatId);

  const result = await callWithFloodWait(() =>
    client.invoke(
      new Api.messages.ExportChatInvite({
        peer,
      })
    )
  );

  if (result instanceof Api.ChatInviteExported) {
    return result.link;
  }

  throw new Error("Failed to get invite link");
}

/**
 * Set a channel/supergroup username (for public links).
 */
export async function setChannelUsername(
  client: TelegramClient,
  channelId: string,
  username: string
): Promise<void> {
  await rateLimiter.throttle("setChannelUsername", 3000);

  const channel = await client.getEntity(channelId);

  if (channel instanceof Api.Channel) {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.channels.UpdateUsername({
          channel,
          username,
        })
      )
    );
  }
}

/**
 * Invite the corporate bot to a supergroup/channel and promote it to admin.
 * This enables corporate management tools (template policies, monitoring, etc.)
 * Must be called from a user session where the caller is an admin of the chat.
 */
export async function promoteBotAdmin(
  client: TelegramClient,
  chatId: string,
  botUsername: string
): Promise<void> {
  await rateLimiter.throttle("promoteBotAdmin", 3000);

  const channel = await client.getEntity(chatId);
  if (!(channel instanceof Api.Channel)) {
    throw new Error("promoteBotAdmin only works with supergroups/channels");
  }

  // Resolve bot entity by username
  const botEntity = await client.getEntity(botUsername);

  // Invite the bot to the chat
  try {
    await callWithFloodWait(() =>
      client.invoke(
        new Api.channels.InviteToChannel({
          channel,
          users: [botEntity],
        })
      )
    );
  } catch (err) {
    // Bot might already be a member — ignore USER_ALREADY_PARTICIPANT
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("USER_ALREADY_PARTICIPANT")) throw err;
  }

  // Promote bot to admin with management rights
  await callWithFloodWait(() =>
    client.invoke(
      new Api.channels.EditAdmin({
        channel,
        userId: botEntity,
        adminRights: new Api.ChatAdminRights({
          changeInfo: true,
          deleteMessages: true,
          banUsers: true,
          inviteUsers: true,
          pinMessages: true,
          manageCall: true,
          addAdmins: false,
          postMessages: channel.broadcast ? true : undefined,
          editMessages: channel.broadcast ? true : undefined,
        }),
        rank: "Corp Bot",
      })
    )
  );
}

/**
 * Get the full info for a chat (including about/description).
 */
export async function getChatFullInfo(
  client: TelegramClient,
  chatId: string
): Promise<{ about: string; inviteLink?: string }> {
  await rateLimiter.throttle("getChatFullInfo", 2000);

  const entity = await client.getEntity(chatId);

  if (entity instanceof Api.Channel) {
    const result = await callWithFloodWait(() =>
      client.invoke(
        new Api.channels.GetFullChannel({ channel: entity })
      )
    );

    const fullChat = result.fullChat as Api.ChannelFull;
    return {
      about: fullChat.about || "",
      inviteLink:
        fullChat.exportedInvite instanceof Api.ChatInviteExported
          ? fullChat.exportedInvite.link
          : undefined,
    };
  }

  if (entity instanceof Api.Chat) {
    const result = await callWithFloodWait(() =>
      client.invoke(
        new Api.messages.GetFullChat({ chatId: entity.id })
      )
    );

    const fullChat = result.fullChat as Api.ChatFull;
    return {
      about: fullChat.about || "",
      inviteLink:
        fullChat.exportedInvite instanceof Api.ChatInviteExported
          ? fullChat.exportedInvite.link
          : undefined,
    };
  }

  return { about: "" };
}
