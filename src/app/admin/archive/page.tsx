"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image,
  Film,
  Music,
  Paperclip,
  Reply,
  Forward,
  Pencil,
} from "lucide-react";

interface ArchivedMessage {
  id: number;
  chatId: number;
  messageId: number;
  senderId: number | null;
  senderName: string | null;
  text: string | null;
  date: string;
  mediaType: string | null;
  mediaFileName: string | null;
  mediaFileSize: number | null;
  replyToMsgId: number | null;
  forwardFrom: string | null;
  isEdited: boolean;
}

const PAGE_SIZE = 50;

export default function ArchivePage() {
  const [messages, setMessages] = useState<ArchivedMessage[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [chatId, setChatId] = useState("");
  const [senderId, setSenderId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [page, setPage] = useState(0);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (searchQuery) params.set("q", searchQuery);
      if (chatId) params.set("chatId", chatId);
      if (senderId) params.set("senderId", senderId);
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) params.set("to", new Date(dateTo).toISOString());
      if (mediaType) params.set("mediaType", mediaType);

      const res = await fetch(`/api/admin/archive?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Failed to load archive:", err);
      setError("Не удалось загрузить архив");
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, chatId, senderId, dateFrom, dateTo, mediaType, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchMessages();
  };

  const handleExport = () => {
    if (!chatId) {
      setError("Для экспорта необходимо указать Chat ID");
      return;
    }
    const params = new URLSearchParams();
    params.set("chatId", chatId);
    if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
    if (dateTo) params.set("to", new Date(dateTo).toISOString());
    window.open(`/api/admin/archive/export?${params.toString()}`, "_blank");
  };

  useEffect(() => {
    if (page > 0) fetchMessages();
  }, [page, fetchMessages]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Архив переписок</h2>
          <p className="text-muted-foreground">
            Поиск и просмотр сообщений из корпоративных чатов
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm transition-colors"
        >
          <Download className="h-4 w-4" />
          Экспорт CSV
        </button>
      </div>

      {/* Search & Filters */}
      <form
        onSubmit={handleSearch}
        className="rounded-lg border border-border bg-card p-4 space-y-3"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Полнотекстовый поиск по сообщениям..."
            className="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-background text-sm"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Chat ID
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-100..."
              className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Sender ID
            </label>
            <input
              type="text"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
              placeholder="12345..."
              className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              С даты
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              По дату
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Тип медиа
            </label>
            <select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            >
              <option value="">Все</option>
              <option value="none">Только текст</option>
              <option value="photo">Фото</option>
              <option value="document">Документы</option>
              <option value="video">Видео</option>
              <option value="audio">Аудио</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            <Search className="h-4 w-4" />
            Поиск
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 && total === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            {searchQuery || chatId
              ? "Сообщения не найдены"
              : "Введите запрос или укажите фильтры для поиска"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Найдено: {total} сообщений
          </p>

          <div className="space-y-1">
            {messages.map((msg) => (
              <MessageCard key={msg.id} message={msg} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, total)} из {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageCard({ message }: { message: ArchivedMessage }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 hover:bg-accent/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header: sender + date */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-foreground">
              {message.senderName ?? `ID: ${message.senderId ?? "?"}`}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {new Date(message.date).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {message.isEdited && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Pencil className="h-2.5 w-2.5" /> ред.
              </span>
            )}
          </div>

          {/* Metadata badges */}
          <div className="flex items-center gap-2 mb-1">
            {message.replyToMsgId && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-400">
                <Reply className="h-3 w-3" /> #{message.replyToMsgId}
              </span>
            )}
            {message.forwardFrom && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400">
                <Forward className="h-3 w-3" /> пересл.
              </span>
            )}
            {message.mediaType && (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <MediaIcon type={message.mediaType} />
                {message.mediaFileName ?? message.mediaType}
                {message.mediaFileSize && (
                  <span>({formatFileSize(message.mediaFileSize)})</span>
                )}
              </span>
            )}
          </div>

          {/* Text */}
          {message.text && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words line-clamp-4">
              {message.text}
            </p>
          )}
        </div>

        {/* Chat/message IDs */}
        <div className="text-right shrink-0">
          <p className="text-[10px] text-muted-foreground font-mono">
            chat:{message.chatId}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">
            msg:{message.messageId}
          </p>
        </div>
      </div>
    </div>
  );
}

function MediaIcon({ type }: { type: string }) {
  switch (type) {
    case "photo":
      return <Image className="h-3 w-3" />;
    case "video":
      return <Film className="h-3 w-3" />;
    case "audio":
    case "voice":
      return <Music className="h-3 w-3" />;
    case "document":
      return <FileText className="h-3 w-3" />;
    default:
      return <Paperclip className="h-3 w-3" />;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
