"use client";

import React, { useState, useEffect } from "react";
import type { TelegramMessage, TextEntity } from "@/types/telegram";
import { cn, safeDate } from "@/lib/utils";
import {
  Check,
  CheckCheck,
  FileText,
  Mic,
  Eye,
  MessageSquare,
  Reply,
  Copy,
  Forward,
  Pin,
  Trash2,
  Play,
} from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useTelegramClient } from "@/hooks/useTelegramClient";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;

function linkifyText(text: string, keyPrefix = "lnk"): React.ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    URL_REGEX.lastIndex = 0;
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

/** Render text with formatting entities */
function renderFormattedText(text: string, entities?: TextEntity[]): React.ReactNode {
  if (!entities || entities.length === 0) {
    return <>{linkifyText(text, "p0")}</>;
  }

  const sorted = [...entities].sort((a, b) => a.offset - b.offset);
  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  for (let ei = 0; ei < sorted.length; ei++) {
    const entity = sorted[ei];
    if (entity.offset < lastIndex) continue;

    if (entity.offset > lastIndex) {
      const plain = text.slice(lastIndex, entity.offset);
      result.push(...linkifyText(plain, `p${ei}`));
    }

    const entityText = text.slice(entity.offset, entity.offset + entity.length);
    const key = `e-${entity.offset}`;

    switch (entity.type) {
      case "bold":
        result.push(<strong key={key}>{entityText}</strong>);
        break;
      case "italic":
        result.push(<em key={key}>{entityText}</em>);
        break;
      case "code":
        result.push(
          <code key={key} className="bg-black/20 px-1 py-0.5 rounded text-[13px] font-mono">
            {entityText}
          </code>
        );
        break;
      case "pre":
        result.push(
          <pre key={key} className="bg-black/20 p-2 rounded-lg overflow-x-auto text-[13px] font-mono my-1">
            <code>{entityText}</code>
          </pre>
        );
        break;
      case "underline":
        result.push(<u key={key}>{entityText}</u>);
        break;
      case "strike":
        result.push(<s key={key}>{entityText}</s>);
        break;
      case "blockquote":
        result.push(
          <blockquote key={key} className="border-l-[3px] border-blue-400/60 pl-2 my-1 text-foreground/80">
            {entityText}
          </blockquote>
        );
        break;
      case "textUrl":
        result.push(
          <a key={key} href={entity.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
            {entityText}
          </a>
        );
        break;
      case "mention":
      case "hashtag":
        result.push(<span key={key} className="text-blue-400">{entityText}</span>);
        break;
      case "spoiler":
        result.push(
          <span key={key} className="bg-muted-foreground/80 text-transparent hover:bg-transparent hover:text-inherit transition-all duration-200 cursor-pointer rounded-sm px-0.5">
            {entityText}
          </span>
        );
        break;
      default:
        result.push(<span key={key}>{entityText}</span>);
    }

    lastIndex = entity.offset + entity.length;
  }

  if (lastIndex < text.length) {
    result.push(...linkifyText(text.slice(lastIndex), "pEnd"));
  }

  return <>{result}</>;
}

interface MessageItemProps {
  message: TelegramMessage;
  showSender?: boolean;
  isGrouped?: boolean;
}

function formatMessageTime(raw: Date | string): string {
  const date = safeDate(raw);
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Inline photo with lazy download */
function InlinePhoto({ chatId, messageId, width, height }: {
  chatId: string;
  messageId: number;
  width?: number;
  height?: number;
}) {
  const { client } = useTelegramClient();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { openMediaViewer } = useUIStore();

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    (async () => {
      try {
        const { downloadMessageMedia, getCachedMedia } = await import("@/lib/telegram/media-cache");
        const cached = getCachedMedia(chatId, messageId);
        if (cached) {
          setUrl(cached);
          setLoading(false);
          return;
        }
        const result = await downloadMessageMedia(client, chatId, messageId);
        if (!cancelled && result) setUrl(result);
      } catch (err) {
        console.error("Photo download failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [client, chatId, messageId]);

  const maxW = 320;
  const maxH = 400;
  let displayW = width || maxW;
  let displayH = height || 200;
  if (displayW > maxW) {
    const scale = maxW / displayW;
    displayW = maxW;
    displayH = Math.round(displayH * scale);
  }
  if (displayH > maxH) {
    const scale = maxH / displayH;
    displayH = maxH;
    displayW = Math.round(displayW * scale);
  }

  if (loading || !url) {
    return (
      <div
        className="rounded-lg bg-muted/50 animate-pulse mb-1"
        style={{ width: displayW, height: displayH }}
      />
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="rounded-lg max-w-full cursor-pointer mb-1"
      style={{ maxWidth: displayW, maxHeight: displayH }}
      onClick={() => openMediaViewer(url)}
    />
  );
}

/** Video thumbnail with play button overlay */
function VideoThumbnail({ chatId, messageId, width, height, duration }: {
  chatId: string;
  messageId: number;
  width?: number;
  height?: number;
  duration?: number;
}) {
  const { client } = useTelegramClient();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    (async () => {
      try {
        const { downloadMessageMedia, getCachedMedia } = await import("@/lib/telegram/media-cache");
        const cached = getCachedMedia(chatId, messageId);
        if (cached) {
          setUrl(cached);
          setLoading(false);
          return;
        }
        const result = await downloadMessageMedia(client, chatId, messageId);
        if (!cancelled && result) setUrl(result);
      } catch (err) {
        console.error("Video thumb failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [client, chatId, messageId]);

  const maxW = 320;
  const maxH = 400;
  let displayW = width || maxW;
  let displayH = height || 200;
  if (displayW > maxW) {
    const scale = maxW / displayW;
    displayW = maxW;
    displayH = Math.round(displayH * scale);
  }
  if (displayH > maxH) {
    const scale = maxH / displayH;
    displayH = maxH;
    displayW = Math.round(displayW * scale);
  }

  const formatDuration = (sec?: number) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="relative rounded-lg overflow-hidden mb-1 cursor-pointer" style={{ width: displayW, height: displayH }}>
      {loading || !url ? (
        <div className="w-full h-full bg-muted/50 animate-pulse" />
      ) : (
        <img src={url} alt="" className="w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <Play className="h-6 w-6 text-white fill-white ml-0.5" />
        </div>
      </div>
      {duration != null && duration > 0 && (
        <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}

/** Sticker rendered as image */
function StickerImage({ chatId, messageId, width, height }: {
  chatId: string;
  messageId: number;
  width?: number;
  height?: number;
}) {
  const { client } = useTelegramClient();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;

    (async () => {
      try {
        const { downloadMessageMedia, getCachedMedia } = await import("@/lib/telegram/media-cache");
        const cached = getCachedMedia(chatId, messageId);
        if (cached) { setUrl(cached); return; }
        const result = await downloadMessageMedia(client, chatId, messageId);
        if (!cancelled && result) setUrl(result);
      } catch (err) {
        console.error("Sticker download failed:", err);
      }
    })();

    return () => { cancelled = true; };
  }, [client, chatId, messageId]);

  const size = Math.min(width || 200, 200);

  if (!url) {
    return <div className="mb-1" style={{ width: size, height: size }} />;
  }

  return (
    <img
      src={url}
      alt="Стикер"
      className="mb-1"
      style={{ width: size, height: "auto", maxHeight: 200 }}
    />
  );
}

/** Link preview card */
function LinkPreviewCard({ webPage, isOutgoing }: {
  webPage: TelegramMessage["webPage"];
  isOutgoing: boolean;
}) {
  if (!webPage) return null;

  return (
    <a
      href={webPage.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block border-l-[3px] border-blue-400 pl-2.5 py-1 mb-1.5 rounded-r-md",
        isOutgoing ? "bg-blue-700/30" : "bg-muted/60",
        "hover:opacity-80 transition-opacity"
      )}
    >
      {webPage.siteName && (
        <p className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">
          {webPage.siteName}
        </p>
      )}
      {webPage.title && (
        <p className={cn(
          "text-sm font-semibold leading-tight",
          isOutgoing ? "text-white" : "text-foreground"
        )}>
          {webPage.title}
        </p>
      )}
      {webPage.description && (
        <p className={cn(
          "text-xs leading-relaxed line-clamp-3 mt-0.5",
          isOutgoing ? "text-white/70" : "text-muted-foreground"
        )}>
          {webPage.description}
        </p>
      )}
    </a>
  );
}

/** Forwarded message header */
function ForwardedHeader({ forwardFrom, isOutgoing }: {
  forwardFrom: TelegramMessage["forwardFrom"];
  isOutgoing: boolean;
}) {
  if (!forwardFrom) return null;

  return (
    <div className={cn(
      "border-l-[3px] pl-2 mb-1.5 py-0.5",
      isOutgoing ? "border-green-400" : "border-green-500"
    )}>
      <p className="text-[11px] font-medium text-green-500">Переслано от</p>
      <p className={cn(
        "text-xs font-semibold",
        isOutgoing ? "text-green-300" : "text-green-600 dark:text-green-400"
      )}>
        {forwardFrom.fromName}
      </p>
    </div>
  );
}

/** Media indicator fallback (for voice, document) */
function MediaIndicator({ type, fileName }: { type: string; fileName?: string }) {
  switch (type) {
    case "voice":
      return (
        <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-1">
          <Mic className="h-4 w-4" /> Голосовое сообщение
        </div>
      );
    case "document":
      return (
        <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-1 p-2 bg-black/10 rounded-lg">
          <FileText className="h-5 w-5 shrink-0" />
          <span className="truncate max-w-[200px]">{fileName || "Документ"}</span>
        </div>
      );
    default:
      return null;
  }
}

/** Reply quote block */
function ReplyQuote({ text, senderName }: { text?: string; senderName?: string }) {
  if (!text && !senderName) return null;
  return (
    <div className="border-l-2 border-blue-500 pl-2 mb-1.5 py-0.5">
      {senderName && (
        <p className="text-xs font-medium text-blue-400">{senderName}</p>
      )}
      <p className="text-xs text-muted-foreground truncate max-w-[250px]">
        {text || "Сообщение"}
      </p>
    </div>
  );
}

/** Reaction bar under message */
function ReactionBar({ reactions }: { reactions: TelegramMessage["reactions"] }) {
  if (!reactions || reactions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs",
            r.isChosen
              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
              : "bg-muted text-muted-foreground"
          )}
        >
          <span>{r.emoji}</span>
          <span className="text-[10px] font-medium">{r.count}</span>
        </span>
      ))}
    </div>
  );
}

export function MessageItem({ message, showSender, isGrouped }: MessageItemProps) {
  const isOutgoing = message.isOutgoing;
  const { setReplyTo } = useUIStore();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  const isSticker = message.media?.type === "sticker";

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const renderMedia = () => {
    if (!message.media) return null;

    switch (message.media.type) {
      case "photo":
        return (
          <InlinePhoto
            chatId={message.chatId}
            messageId={message.id}
            width={message.media.width}
            height={message.media.height}
          />
        );
      case "video":
        return (
          <VideoThumbnail
            chatId={message.chatId}
            messageId={message.id}
            width={message.media.width}
            height={message.media.height}
            duration={message.media.duration}
          />
        );
      case "sticker":
        return (
          <StickerImage
            chatId={message.chatId}
            messageId={message.id}
            width={message.media.width}
            height={message.media.height}
          />
        );
      case "voice":
      case "document":
        return <MediaIndicator type={message.media.type} fileName={message.media.fileName} />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "group flex w-full",
        isGrouped ? "mb-0.5" : "mb-2",
        isOutgoing ? "justify-end" : "justify-start"
      )}
    >
      <div
        onContextMenu={handleContextMenu}
        className={cn(
          "relative max-w-[70%] text-sm",
          isSticker
            ? ""
            : cn(
                "rounded-2xl px-3 py-1.5",
                isOutgoing
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-muted rounded-bl-md"
              )
        )}
      >
        {/* Forwarded message header */}
        {message.forwardFrom && (
          <ForwardedHeader forwardFrom={message.forwardFrom} isOutgoing={isOutgoing} />
        )}

        {/* Sender name in groups */}
        {showSender && message.senderName && !isOutgoing && !isGrouped && !message.forwardFrom && (
          <p className="text-xs font-medium text-blue-400 mb-0.5">
            {message.senderName}
          </p>
        )}

        {/* Reply quote */}
        {message.replyToId && (
          <ReplyQuote
            text={message.replyToText}
            senderName={message.replyToSenderName}
          />
        )}

        {/* Media */}
        {renderMedia()}

        {/* Web page preview card */}
        {message.webPage && (
          <LinkPreviewCard webPage={message.webPage} isOutgoing={isOutgoing} />
        )}

        {/* Message text with formatting */}
        {message.text && (
          <div className="whitespace-pre-wrap break-words">
            {renderFormattedText(message.text, message.entities)}
          </div>
        )}

        {/* Reactions */}
        <ReactionBar reactions={message.reactions} />

        {/* Comments count with commenter avatars (channel posts) */}
        {(message.commentsCount != null && message.commentsCount > 0) && (
          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-current/10">
            {/* Commenter avatar placeholders */}
            <div className="flex -space-x-1.5">
              {Array.from({ length: Math.min(message.commentsCount, 3) }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-5 w-5 rounded-full border-2 flex items-center justify-center text-[8px] font-bold text-white",
                    isOutgoing ? "border-blue-600" : "border-muted",
                    i === 0 ? "bg-purple-500" : i === 1 ? "bg-green-500" : "bg-orange-500"
                  )}
                >
                  {i === 0 ? "💬" : ""}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-blue-400 cursor-pointer hover:underline">
              <MessageSquare className="h-3 w-3" />
              <span>{message.commentsCount} комментариев</span>
            </div>
          </div>
        )}

        {/* Footer: edited + views + time + read status + forward btn */}
        {!isSticker && (
          <div
            className={cn(
              "flex items-center justify-end gap-1 mt-0.5",
              isOutgoing ? "text-white/70" : "text-muted-foreground"
            )}
          >
            {/* Forward button for channel posts (visible on hover) */}
            {message.views != null && !isOutgoing && (
              <button className="mr-auto flex items-center gap-0.5 text-xs hover:text-blue-400 transition-colors opacity-0 group-hover:opacity-100">
                <Forward className="h-3.5 w-3.5" />
              </button>
            )}
            {message.isEdited && (
              <span className="text-[10px] italic">edited</span>
            )}
            {message.views != null && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <Eye className="h-2.5 w-2.5" />
                {message.views > 999
                  ? `${(message.views / 1000).toFixed(1)}K`
                  : message.views}
              </span>
            )}
            <span className="text-[10px]">{formatMessageTime(message.date)}</span>
            {isOutgoing && (
              <CheckCheck className="h-3 w-3" />
            )}
          </div>
        )}

        {/* Context menu (right-click) */}
        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-50"
              onClick={() => setShowMenu(false)}
            />
            <div
              className="fixed z-50 min-w-[160px] rounded-lg border bg-popover p-1 shadow-lg"
              style={{ left: menuPos.x, top: menuPos.y }}
            >
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => { setReplyTo(message.id); setShowMenu(false); }}
              >
                <Reply className="h-4 w-4" /> Ответить
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                onClick={() => { navigator.clipboard?.writeText(message.text); setShowMenu(false); }}
              >
                <Copy className="h-4 w-4" /> Копировать
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent opacity-50"
                disabled
              >
                <Forward className="h-4 w-4" /> Переслать
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent opacity-50"
                disabled
              >
                <Pin className="h-4 w-4" /> Закрепить
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-accent opacity-50"
                disabled
              >
                <Trash2 className="h-4 w-4" /> Удалить
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
