"use client";

import { Fragment, useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2, Users, Shield, ShieldAlert, Hash, Megaphone, Building2, Archive,
  FileText, Image, Film, Music, Paperclip, Pencil,
  ArrowDown, Mic, Play, X,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ManagedChatInfo } from "@/types/admin";
import { useTelegramClient } from "@/hooks/useTelegramClient";

interface ArchivedMessagePreview {
  id: number;
  /** Telegram message ID — used for API calls (download, etc.) */
  messageId: number;
  senderName: string | null;
  senderId: number | null;
  text: string | null;
  date: string;
  mediaType: string | null;
  mediaFileName: string | null;
  mediaFileSize: number | null;
  isEdited: boolean;
}

interface ArchiveCacheEntry {
  messages: ArchivedMessagePreview[];
  total: number;
}

const ARCHIVE_PREVIEW_LIMIT = 15;

export function ChatTable() {
  const [chats, setChats] = useState<ManagedChatInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [togglingArchiveId, setTogglingArchiveId] = useState<string | null>(null);
  const [expandedDriftId, setExpandedDriftId] = useState<string | null>(null);
  const [expandedArchiveId, setExpandedArchiveId] = useState<string | null>(null);
  const [archiveLoading, setArchiveLoading] = useState<string | null>(null);
  const archiveCache = useRef<Map<string, ArchiveCacheEntry>>(new Map());
  const { client: telegramClient } = useTelegramClient();

  /** Collect messages via user session and save to archive DB */
  const collectViaUserSession = useCallback(async (chatId: string): Promise<ArchiveCacheEntry> => {
    if (!telegramClient) return { messages: [], total: 0 };

    try {
      const { getMessages } = await import("@/lib/telegram/messages");
      const msgs = await getMessages(telegramClient, chatId, 50);

      if (msgs.length === 0) return { messages: [], total: 0 };

      // Map to archive format and POST to server
      const archiveMessages = msgs.map((m) => ({
        messageId: m.id,
        senderId: m.senderId ? Number(m.senderId) : null,
        senderName: m.senderName ?? null,
        text: m.text || null,
        date: m.date instanceof Date ? m.date.toISOString() : String(m.date),
        mediaType: m.media?.type ?? null,
        mediaFileName: m.media?.fileName ?? null,
        mediaFileSize: null,
        replyToMsgId: m.replyToId ?? null,
        forwardFrom: m.forwardFrom ? "forwarded" : null,
        isEdited: m.isEdited ?? false,
      }));

      // Save to server
      await fetch("/api/admin/archive/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: Number(chatId), messages: archiveMessages }),
      });

      // Return for display
      return {
        messages: archiveMessages.slice(0, ARCHIVE_PREVIEW_LIMIT).map((m, i) => ({
          id: m.messageId || i,
          messageId: m.messageId || 0,
          senderName: m.senderName,
          senderId: m.senderId,
          text: m.text,
          date: m.date,
          mediaType: m.mediaType,
          mediaFileName: m.mediaFileName,
          mediaFileSize: m.mediaFileSize,
          isEdited: m.isEdited,
        })),
        total: archiveMessages.length,
      };
    } catch (err) {
      console.error("Failed to collect via user session:", err);
      return { messages: [], total: 0 };
    }
  }, [telegramClient]);

  const toggleArchivePreview = useCallback(async (chatId: string) => {
    if (expandedArchiveId === chatId) {
      setExpandedArchiveId(null);
      return;
    }
    setExpandedArchiveId(chatId);

    if (archiveCache.current.has(chatId)) return;

    setArchiveLoading(chatId);
    try {
      // 1. Try server archive first
      const params = new URLSearchParams({
        chatId,
        limit: String(ARCHIVE_PREVIEW_LIMIT),
        offset: "0",
      });
      const res = await fetch(`/api/admin/archive?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if ((data.messages?.length ?? 0) > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = data.messages.map((m: any) => ({
          id: m.id ?? m.messageId ?? 0,
          messageId: m.messageId ?? m.id ?? 0,
          senderName: m.senderName ?? null,
          senderId: m.senderId ?? null,
          text: m.text ?? null,
          date: m.date,
          mediaType: m.mediaType ?? null,
          mediaFileName: m.mediaFileName ?? null,
          mediaFileSize: m.mediaFileSize ?? null,
          isEdited: m.isEdited ?? false,
        }));
        archiveCache.current.set(chatId, {
          messages: mapped,
          total: data.total ?? 0,
        });
        return;
      }

      // 2. Archive empty — collect via user Telegram client
      const collected = await collectViaUserSession(chatId);
      archiveCache.current.set(chatId, collected);
    } catch (err) {
      console.error("Failed to load archive preview:", err);
      // Fallback: try user session even if server request failed
      const collected = await collectViaUserSession(chatId);
      archiveCache.current.set(chatId, collected);
    } finally {
      setArchiveLoading(null);
    }
  }, [expandedArchiveId, collectViaUserSession]);

  // Close fullscreen overlay on Escape
  useEffect(() => {
    if (!expandedArchiveId) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedArchiveId(null);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [expandedArchiveId]);

  // Lock body scroll when fullscreen overlay is open
  useEffect(() => {
    if (expandedArchiveId) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [expandedArchiveId]);

  const toggleArchive = async (chatId: string, currentlyEnabled: boolean) => {
    setTogglingArchiveId(chatId);
    try {
      const res = await fetch(`/api/admin/chats/${chatId}/archive-state`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: !currentlyEnabled }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId ? { ...c, archiveEnabled: !currentlyEnabled } : c
        )
      );
      toast.success(currentlyEnabled ? "Архивация выключена" : "Архивация включена");
    } catch (err) {
      console.error("Failed to toggle archive:", err);
      toast.error("Не удалось изменить архивацию");
    } finally {
      setTogglingArchiveId(null);
    }
  };

  const toggleWorkspace = async (chatId: string, hasTemplate: boolean) => {
    setTogglingId(chatId);
    try {
      const method = hasTemplate ? "DELETE" : "PUT";
      const res = await fetch(`/api/admin/chats/${chatId}/workspace`, { method });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Update local state
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                templateId: hasTemplate ? null : "default",
                isCompliant: true,
              }
            : c
        )
      );
      toast.success(hasTemplate ? "Убран из рабочей области" : "Добавлен в рабочую область");
    } catch (err) {
      console.error("Failed to toggle workspace:", err);
      toast.error("Не удалось изменить рабочую область");
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/chats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setChats(data.chats);
      } catch (err) {
        console.error("Failed to load chats:", err);
        setError("Не удалось загрузить чаты");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-8">
          <Users className="h-8 w-8 mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Нет управляемых чатов</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Бот не добавлен как администратор ни в один чат
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile: Card list */}
      <div className="space-y-3 md:hidden">
        {chats.map((chat) => (
          <Card
            key={chat.id}
            className="py-0 cursor-pointer hover:border-muted-foreground/40 transition-colors"
            onClick={() => toggleArchivePreview(chat.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">
                      {chat.title}
                    </span>
                    {chat.isCompliant ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-400 border-green-500/30">
                        <Shield className="h-2.5 w-2.5 mr-0.5" />
                        OK
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 text-amber-400 border-amber-500/30 cursor-pointer hover:border-amber-400/60"
                        onClick={(e) => { e.stopPropagation(); setExpandedDriftId(expandedDriftId === chat.id ? null : chat.id); }}
                      >
                        <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
                        Drift
                      </Badge>
                    )}
                    <Archive className="h-3 w-3 text-muted-foreground/50 ml-auto" />
                  </div>
                  {expandedDriftId === chat.id && chat.driftDetails && (
                    <DriftDetails details={chat.driftDetails} />
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {chat.type === "channel" ? (
                        <Megaphone className="h-3 w-3" />
                      ) : (
                        <Hash className="h-3 w-3" />
                      )}
                      {chat.type === "supergroup" ? "Группа" : "Канал"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {chat.participantCount.toLocaleString()}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWorkspace(chat.id, !!chat.templateId); }}
                      disabled={togglingId === chat.id}
                      className="inline-flex items-center"
                    >
                      {togglingId === chat.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            chat.templateId
                              ? "text-[10px] px-1.5 py-0 text-green-400 border-green-500/30 cursor-pointer hover:border-green-400/60"
                              : "text-[10px] px-1.5 py-0 text-muted-foreground border-border cursor-pointer hover:border-muted-foreground/60"
                          }
                        >
                          <Building2 className="h-2.5 w-2.5 mr-0.5" />
                          {chat.templateId ? "Рабочая" : "Не рабочая"}
                        </Badge>
                      )}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleArchive(chat.id, chat.archiveEnabled); }}
                      disabled={togglingArchiveId === chat.id}
                      className="inline-flex items-center"
                    >
                      {togglingArchiveId === chat.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            chat.archiveEnabled
                              ? "text-[10px] px-1.5 py-0 text-blue-400 border-blue-500/30 cursor-pointer hover:border-blue-400/60"
                              : "text-[10px] px-1.5 py-0 text-muted-foreground border-border cursor-pointer hover:border-muted-foreground/60"
                          }
                        >
                          <Archive className="h-2.5 w-2.5 mr-0.5" />
                          {chat.archiveEnabled ? "Архив" : "Без архива"}
                        </Badge>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Чат</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead className="text-right">Участники</TableHead>
              <TableHead>Рабочая</TableHead>
              <TableHead>Архив</TableHead>
              <TableHead>Шаблон</TableHead>
              <TableHead>Статус</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {chats.map((chat) => (
              <Fragment key={chat.id}>
                <TableRow
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleArchivePreview(chat.id)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {chat.title}
                      </span>
                      <Archive className="h-3 w-3 text-muted-foreground/50" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      {chat.type === "channel" ? (
                        <Megaphone className="h-3.5 w-3.5" />
                      ) : (
                        <Hash className="h-3.5 w-3.5" />
                      )}
                      {chat.type === "supergroup" ? "Группа" : "Канал"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {chat.participantCount.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWorkspace(chat.id, !!chat.templateId); }}
                      disabled={togglingId === chat.id}
                    >
                      {togglingId === chat.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            chat.templateId
                              ? "text-xs text-green-400 border-green-500/30 cursor-pointer hover:border-green-400/60"
                              : "text-xs text-muted-foreground border-border cursor-pointer hover:border-muted-foreground/60"
                          }
                        >
                          <Building2 className="h-3 w-3 mr-1" />
                          {chat.templateId ? "Да" : "Нет"}
                        </Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleArchive(chat.id, chat.archiveEnabled); }}
                      disabled={togglingArchiveId === chat.id}
                    >
                      {togglingArchiveId === chat.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            chat.archiveEnabled
                              ? "text-xs text-blue-400 border-blue-500/30 cursor-pointer hover:border-blue-400/60"
                              : "text-xs text-muted-foreground border-border cursor-pointer hover:border-muted-foreground/60"
                          }
                        >
                          <Archive className="h-3 w-3 mr-1" />
                          {chat.archiveEnabled ? "Вкл" : "Выкл"}
                        </Badge>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    {chat.templateId ? (
                      <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                        Назначен
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {chat.isCompliant ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-400">
                        <Shield className="h-3.5 w-3.5" />
                        OK
                      </span>
                    ) : (
                      <button
                        className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setExpandedDriftId(expandedDriftId === chat.id ? null : chat.id); }}
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        Drift ▾
                      </button>
                    )}
                  </TableCell>
                </TableRow>
                {expandedDriftId === chat.id && chat.driftDetails && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-2 px-4">
                      <DriftDetails details={chat.driftDetails} />
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ── Fullscreen Archive Overlay ── */}
      {expandedArchiveId && (() => {
        const chat = chats.find((c) => c.id === expandedArchiveId);
        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-[#0e1621]">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-[#17212b] border-b border-[#232e3c] shrink-0">
              <button
                onClick={() => setExpandedArchiveId(null)}
                className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="h-5 w-5 text-gray-300" />
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-100 truncate">
                  {chat?.title ?? `Чат ${expandedArchiveId}`}
                </h3>
                <p className="text-[11px] text-gray-500">
                  {archiveLoading === expandedArchiveId
                    ? "Загрузка…"
                    : `${archiveCache.current.get(expandedArchiveId)?.total ?? 0} сообщений в архиве`}
                </p>
              </div>
            </div>
            {/* Chat body */}
            <div className="flex-1 overflow-hidden">
              <ArchivePreview
                chatId={expandedArchiveId}
                isLoading={archiveLoading === expandedArchiveId}
                data={archiveCache.current.get(expandedArchiveId) ?? null}
                telegramClient={telegramClient}
                fullscreen
              />
            </div>
          </div>
        );
      })()}
    </>
  );
}

const DRIFT_LABELS: Record<string, string> = {
  slow_mode_delay: "Slow Mode",
  has_protected_content: "Защита контента",
  has_aggressive_anti_spam_enabled: "Anti-spam",
  has_hidden_members: "Скрытые участники",
  join_by_request: "Одобрение заявок",
  message_auto_delete_time: "Авто-удаление",
  "permission.can_send_messages": "Отправка сообщений",
  "permission.can_send_media": "Отправка медиа",
  "permission.can_send_polls": "Создание опросов",
  "permission.can_send_other": "Стикеры и GIF",
  "permission.can_add_web_page_previews": "Превью ссылок",
  "permission.can_change_info": "Изменение инфо группы",
  "permission.can_invite_users": "Приглашение участников",
  "permission.can_pin_messages": "Закрепление сообщений",
};

function isPermissionKey(key: string): boolean {
  return key.startsWith("permission.");
}

function formatDriftValue(key: string, value: unknown): string {
  if (typeof value === "boolean") {
    if (isPermissionKey(key)) return value ? "Разрешено" : "Запрещено";
    return value ? "Включено" : "Выключено";
  }
  if (key === "slow_mode_delay") return value === 0 ? "Выкл" : `${value} сек`;
  if (key === "message_auto_delete_time") return value === 0 ? "Выкл" : `${value} сек`;
  return String(value);
}

function DriftDetails({ details }: { details: Record<string, { expected: unknown; actual: unknown }> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 text-xs space-y-2">
      <p className="text-amber-400 font-medium text-[11px]">
        Настройки чата не совпадают с шаблоном:
      </p>
      <div className="space-y-1.5">
        {entries.map(([key, { expected, actual }]) => (
          <div key={key} className="space-y-0.5">
            <span className="text-muted-foreground">{DRIFT_LABELS[key] || key}</span>
            <div className="flex items-center gap-2 pl-2">
              <span className="text-green-400/70 text-[10px]">шаблон:</span>
              <span className="text-green-400">{formatDriftValue(key, expected)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-red-400/70 text-[10px]">сейчас:</span>
              <span className="text-red-400">{formatDriftValue(key, actual)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Archive Preview (Telegram-style chat) ── */

/** Telegram sender name colors */
const SENDER_COLORS = [
  "#fc5c65", // red
  "#fd9644", // orange
  "#f7b731", // yellow
  "#26de81", // green
  "#2bcbba", // teal
  "#45aaf2", // blue
  "#a55eea", // violet
  "#ee5a80", // pink
];

function senderColorHex(senderId: number | null, senderName: string | null): string {
  const seed = senderId ?? (senderName ?? "?").length;
  return SENDER_COLORS[Math.abs(seed) % SENDER_COLORS.length];
}

/** Format date for day separator — "12 марта", "Сегодня" */
function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Сегодня";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function ArchivePreview({
  chatId,
  isLoading,
  data,
  telegramClient,
  fullscreen = false,
}: {
  chatId: string;
  isLoading: boolean;
  data: ArchiveCacheEntry | null;
  telegramClient: import("telegram").TelegramClient | null;
  fullscreen?: boolean;
}) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const handleDownloadDoc = async (msg: ArchivedMessagePreview) => {
    if (!telegramClient) {
      toast.error("Telegram-клиент не подключён");
      return;
    }
    setDownloadingId(msg.id);
    setDownloadProgress(0);
    try {
      const { downloadDocumentFile } = await import("@/lib/telegram/media-cache");
      const result = await downloadDocumentFile(
        telegramClient,
        chatId,
        msg.messageId,
        (received, total) => setDownloadProgress(Math.round((received / total) * 100)),
      );

      if (!result) {
        toast.error("Не удалось скачать файл");
        return;
      }

      // Open in native OS preview (Quick Look on macOS, browser preview for PDF/images)
      window.open(result.url, "_blank");
    } catch (err) {
      console.error("Download failed:", err);
      toast.error("Не удалось скачать файл");
    } finally {
      setDownloadingId(null);
    }
  };
  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-[#0e1621] ${fullscreen ? "h-full" : "py-8 border-t border-border"}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground ml-2">Загрузка сообщений…</span>
      </div>
    );
  }

  if (!data || data.messages.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center bg-[#0e1621] ${fullscreen ? "h-full" : "py-8 border-t border-border"}`}>
        <FileText className="h-5 w-5 text-muted-foreground/40 mb-1" />
        <p className="text-xs text-muted-foreground">Нет сообщений в архиве</p>
      </div>
    );
  }

  // Sort chronologically (oldest first)
  const sorted = [...data.messages].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Group by day, then by consecutive sender within each day
  type MsgGroup = { senderId: number | null; senderName: string | null; msgs: ArchivedMessagePreview[] };
  type DayGroup = { dayKey: string; dayLabel: string; groups: MsgGroup[] };

  const days: DayGroup[] = [];
  for (const msg of sorted) {
    const dayKey = new Date(msg.date).toDateString();
    let day = days[days.length - 1];
    if (!day || day.dayKey !== dayKey) {
      day = { dayKey, dayLabel: formatDayLabel(msg.date), groups: [] };
      days.push(day);
    }
    const lastGroup = day.groups[day.groups.length - 1];
    if (lastGroup && lastGroup.senderId === msg.senderId) {
      lastGroup.msgs.push(msg);
    } else {
      day.groups.push({ senderId: msg.senderId, senderName: msg.senderName, msgs: [msg] });
    }
  }

  return (
    <div className={fullscreen ? "flex flex-col h-full" : "border-t border-border"} onClick={(e) => e.stopPropagation()}>
      {/* Chat area */}
      <div className={`bg-[#0e1621] overflow-y-auto px-3 py-2 space-y-2 ${fullscreen ? "flex-1" : "max-h-[460px]"}`}>
        {days.map((day) => (
          <div key={day.dayKey} className="space-y-1">
            {/* ── Day separator ── */}
            <div className="flex justify-center py-1">
              <span className="text-[11px] text-gray-300 bg-[#2a3a4a]/80 rounded-full px-3 py-0.5">
                {day.dayLabel}
              </span>
            </div>
            {/* ── Messages ── */}
            {day.groups.map((group, gi) => {
              const color = senderColorHex(group.senderId, group.senderName);
              const displayName = group.senderName ?? `ID: ${group.senderId ?? "?"}`;
              return (
                <div key={gi} className="space-y-[2px]">
                  {group.msgs.map((msg, mi) => {
                    const isFirstInGroup = mi === 0;
                    const isLastInGroup = mi === group.msgs.length - 1;
                    const hasDoc = msg.mediaType === "document" && msg.mediaFileName;
                    const hasPhoto = msg.mediaType === "photo";
                    const hasVideo = msg.mediaType === "video";
                    const hasVoice = msg.mediaType === "voice";
                    const hasAudio = msg.mediaType === "audio";
                    const hasMedia = hasDoc || hasPhoto || hasVideo || hasVoice || hasAudio;

                    return (
                      <div key={msg.id} className="flex">
                        <div
                          className="max-w-[88%] md:max-w-[75%]"
                        >
                          <div
                            className={`
                              bg-[#182533] px-2.5 py-[5px] shadow-sm relative
                              ${isFirstInGroup ? "rounded-t-xl rounded-tr-xl" : "rounded-l-[4px] rounded-r-xl"}
                              ${isLastInGroup ? "rounded-b-xl rounded-bl-xl" : "rounded-l-[4px] rounded-r-xl"}
                              ${isFirstInGroup && isLastInGroup ? "rounded-xl" : ""}
                            `}
                          >
                            {/* Sender name */}
                            {isFirstInGroup && (
                              <p
                                className="text-[13px] font-semibold leading-tight mb-0.5"
                                style={{ color }}
                              >
                                {displayName}
                              </p>
                            )}

                            {/* ── Document attachment ── */}
                            {hasDoc && (
                              <button
                                type="button"
                                className="flex items-center gap-2.5 my-1 w-full text-left cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => handleDownloadDoc(msg)}
                                disabled={downloadingId === msg.id}
                              >
                                <div className="w-10 h-10 rounded-full bg-[#3390ec] flex items-center justify-center shrink-0">
                                  {downloadingId === msg.id ? (
                                    <span className="text-[10px] font-bold text-white">{downloadProgress}%</span>
                                  ) : (
                                    <ArrowDown className="h-5 w-5 text-white" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] text-white font-medium truncate leading-tight">
                                    {msg.mediaFileName}
                                  </p>
                                  {msg.mediaFileSize ? (
                                    <p className="text-[11px] text-gray-400 leading-tight">
                                      {formatFileSize(msg.mediaFileSize)}
                                    </p>
                                  ) : (
                                    <p className="text-[11px] text-gray-400 leading-tight">
                                      Документ
                                    </p>
                                  )}
                                </div>
                              </button>
                            )}

                            {/* ── Photo / Video / Voice / Audio ── */}
                            {hasPhoto && (
                              <div className="flex items-center gap-2 my-1 bg-[#1c2e3f] rounded-lg px-2.5 py-2">
                                <Image className="h-8 w-8 text-[#3390ec] shrink-0" />
                                <span className="text-[13px] text-gray-300">Фото</span>
                              </div>
                            )}
                            {hasVideo && (
                              <div className="flex items-center gap-2 my-1 bg-[#1c2e3f] rounded-lg px-2.5 py-2">
                                <Play className="h-8 w-8 text-[#3390ec] shrink-0" />
                                <span className="text-[13px] text-gray-300">Видео</span>
                              </div>
                            )}
                            {hasVoice && (
                              <div className="flex items-center gap-2 my-1 bg-[#1c2e3f] rounded-lg px-2.5 py-2">
                                <Mic className="h-5 w-5 text-[#3390ec] shrink-0" />
                                <span className="text-[13px] text-gray-300">Голосовое сообщение</span>
                              </div>
                            )}
                            {hasAudio && (
                              <div className="flex items-center gap-2 my-1 bg-[#1c2e3f] rounded-lg px-2.5 py-2">
                                <Music className="h-5 w-5 text-[#3390ec] shrink-0" />
                                <span className="text-[13px] text-gray-300">
                                  {msg.mediaFileName ?? "Аудио"}
                                </span>
                              </div>
                            )}

                            {/* ── Other media types ── */}
                            {msg.mediaType && !hasMedia && (
                              <div className="flex items-center gap-2 my-1 text-[12px] text-gray-400">
                                <Paperclip className="h-3.5 w-3.5" />
                                <span>{msg.mediaFileName ?? msg.mediaType}</span>
                              </div>
                            )}

                            {/* ── Message text + timestamp ── */}
                            {msg.text ? (
                              <div>
                                <p className="text-[13px] text-gray-100 whitespace-pre-wrap break-words leading-[1.35]">
                                  {msg.text}
                                  {/* Invisible spacer for timestamp */}
                                  <span className="inline-block w-14" />
                                </p>
                                {/* Floating timestamp */}
                                <span className="float-right -mt-4 inline-flex items-center gap-0.5">
                                  {msg.isEdited && (
                                    <span className="text-[10px] text-gray-500 italic">ред.</span>
                                  )}
                                  <span className="text-[11px] text-gray-500 tabular-nums">
                                    {formatTime(msg.date)}
                                  </span>
                                </span>
                              </div>
                            ) : (
                              /* No text — timestamp aligned right */
                              <div className="flex justify-end mt-0.5">
                                <span className="inline-flex items-center gap-0.5">
                                  {msg.isEdited && (
                                    <span className="text-[10px] text-gray-500 italic">ред.</span>
                                  )}
                                  <span className="text-[11px] text-gray-500 tabular-nums">
                                    {formatTime(msg.date)}
                                  </span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>


    </div>
  );
}
