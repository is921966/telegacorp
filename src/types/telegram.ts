export interface TelegramFolder {
  id: number;
  title: string;
  emoticon?: string;
  unreadCount?: number;
  /** Peer IDs that are explicitly included in this folder (includePeers + pinnedPeers) */
  includePeerIds: string[];
  /** Peer IDs that are pinned in this folder (ordered) */
  pinnedPeerIds: string[];
  /** Peer IDs that are explicitly excluded from this folder */
  excludePeerIds: string[];
  /** Category flags for automatic matching */
  flags: {
    contacts?: boolean;
    nonContacts?: boolean;
    groups?: boolean;
    broadcasts?: boolean;
    bots?: boolean;
    excludeMuted?: boolean;
    excludeRead?: boolean;
    excludeArchived?: boolean;
  };
}

export interface TelegramReaction {
  emoji: string;
  count: number;
  isChosen?: boolean;
}

export interface TelegramDialog {
  id: string;
  type: "user" | "group" | "channel";
  title: string;
  photoUrl?: string;
  lastMessage?: {
    text: string;
    date: Date;
    senderId?: string;
    senderName?: string;
    senderPhotoUrl?: string;
    isOutgoing: boolean;
    isRead: boolean;
    mediaType?: "photo" | "video" | "document" | "voice" | "sticker" | "gif" | "audio" | "contact" | "location" | "poll";
    mediaFileName?: string;
  };
  unreadCount: number;
  unreadMentionsCount: number;
  /** ID of last read incoming message (for unread divider positioning) */
  readInboxMaxId?: number;
  isPinned: boolean;
  isOnline?: boolean;
  isVerified?: boolean;
  isMuted?: boolean;
  isBot?: boolean;
  isForum?: boolean;
  hasDraft?: boolean;
  draftText?: string;
  folderId: number;
  participantsCount?: number;
  lastSeen?: Date;
  /** Telegram Premium user */
  isPremium?: boolean;
  /** Premium emoji status custom emoji ID */
  emojiStatus?: string;
  /** Whether this bot has a mini-app */
  hasBotApp?: boolean;
  /** Original position from API response (preserves Telegram's sort order) */
  apiOrder: number;
}

export interface TextEntity {
  offset: number;
  length: number;
  type: "bold" | "italic" | "code" | "pre" | "underline" | "strike" | "blockquote" | "textUrl" | "mention" | "hashtag" | "spoiler";
  url?: string;
  language?: string;
}

export interface ForwardInfo {
  fromName?: string;
  fromId?: string;
  date?: Date;
}

export interface WebPagePreview {
  url: string;
  siteName?: string;
  title?: string;
  description?: string;
}

export interface TelegramMessage {
  id: number;
  chatId: string;
  senderId?: string;
  senderName?: string;
  text: string;
  date: Date;
  isOutgoing: boolean;
  replyToId?: number;
  replyToText?: string;
  replyToSenderName?: string;
  media?: TelegramMedia;
  isEdited?: boolean;
  isPinned?: boolean;
  reactions?: TelegramReaction[];
  /** Number of comments (for channel posts with linked discussion) */
  commentsCount?: number;
  /** Linked discussion group chat ID (for channel posts with comments) */
  discussionChatId?: string;
  /** Views count for channel posts */
  views?: number;
  /** Grouped media album ID */
  groupedId?: string;
  /** Text formatting entities */
  entities?: TextEntity[];
  /** Forwarded message info */
  forwardFrom?: ForwardInfo;
  /** Web page link preview */
  webPage?: WebPagePreview;
}

export interface TelegramMedia {
  type: "photo" | "video" | "document" | "voice" | "sticker";
  mimeType?: string;
  fileName?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  url?: string;
}

export interface TelegramUser {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
  photoUrl?: string;
  isOnline?: boolean;
  lastSeen?: Date;
}

export interface TelegramContact {
  id: string;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
  photoUrl?: string;
  isOnline?: boolean;
  lastSeen?: Date;
  /** Whether this is a mutual contact */
  isMutual?: boolean;
}

export interface TelegramCallRecord {
  id: number;
  /** The user on the other end of the call */
  userId: string;
  userName: string;
  userPhotoUrl?: string;
  /** When the call happened */
  date: Date;
  /** Call duration in seconds (0 if missed/declined) */
  duration: number;
  /** Whether this user made the call (outgoing) */
  isOutgoing: boolean;
  /** Whether the call was a video call */
  isVideo: boolean;
  /** Call disposition */
  reason: "missed" | "busy" | "hangup" | "disconnect";
}

/** Grouped results for global search */
export interface GlobalSearchResults {
  contacts: TelegramContact[];
  messages: {
    chatId: string;
    chatTitle: string;
    messageId: number;
    text: string;
    date: Date;
    senderName?: string;
  }[];
}

export interface TelegramAuthState {
  step: "phone" | "code" | "password" | "done";
  phoneNumber?: string;
  phoneCodeHash?: string;
  passwordHint?: string;
  error?: string;
}
