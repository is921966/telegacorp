"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useMessages } from "@/hooks/useMessages";
import { useUIStore } from "@/store/ui";
import { useTelegramClient } from "@/hooks/useTelegramClient";
import { useChatsStore } from "@/store/chats";
import { Send, Paperclip, X, Reply, Pencil, Mic, Smile, BellOff, Languages, Loader2 } from "lucide-react";
import { useMessagesStore } from "@/store/messages";
import { useUploadStore, getAbortController } from "@/store/upload";
import { cn } from "@/lib/utils";

export function MessageInput() {
  const { selectedChatId, replyToMessageId, editingMessageId, setReplyTo, setEditing } =
    useUIStore();
  const { send, edit } = useMessages(selectedChatId);
  const { client } = useTelegramClient();
  const { messagesByChat } = useMessagesStore();
  const { dialogs } = useChatsStore();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload store for video progress
  const uploadTasks = useUploadStore((s) => s.tasks);
  const activeUpload = selectedChatId
    ? Object.values(uploadTasks).find(
        (t) =>
          t.chatId === selectedChatId &&
          t.phase !== "done" &&
          t.phase !== "error" &&
          t.phase !== "cancelled"
      )
    : null;

  const messages = selectedChatId ? messagesByChat[selectedChatId] || [] : [];
  const dialog = dialogs.find((d) => d.id === selectedChatId);
  const isChannel = dialog?.type === "channel";

  const replyMessage = replyToMessageId
    ? messages.find((m) => m.id === replyToMessageId)
    : null;
  const editMessage = editingMessageId
    ? messages.find((m) => m.id === editingMessageId)
    : null;

  const handleSend = useCallback(async () => {
    if (!text.trim() || !selectedChatId || isSending) return;

    setIsSending(true);
    try {
      if (editingMessageId) {
        await edit(editingMessageId, text.trim());
        setEditing(null);
      } else {
        await send(text.trim(), replyToMessageId ?? undefined);
        setReplyTo(null);
      }
      setText("");
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setIsSending(false);
    }
  }, [text, selectedChatId, isSending, editingMessageId, replyToMessageId, send, edit, setReplyTo, setEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !client || !selectedChatId) return;

    try {
      // Check if this is a video file — route through the video pipeline
      const { isVideoFile } = await import("@/lib/video/send-video");

      if (isVideoFile(file)) {
        // Video upload — fire-and-forget, progress tracked via upload store
        const { sendVideo } = await import("@/lib/video/send-video");
        sendVideo(client, {
          chatId: selectedChatId,
          file,
          caption: text.trim() || undefined,
          replyToId: replyToMessageId ?? undefined,
        }).catch((err) => {
          console.error("Video send pipeline error:", err);
        });
        setText("");
        setReplyTo(null);
      } else {
        // Non-video file — use existing sendFile
        const { sendFile } = await import("@/lib/telegram/media");
        await sendFile(client, selectedChatId, file, text.trim() || undefined);
        setText("");
      }
    } catch (err) {
      console.error("Failed to upload file:", err);
    }
    e.target.value = "";
  };

  const cancelAction = () => {
    setReplyTo(null);
    setEditing(null);
    setText("");
  };

  const cancelUpload = () => {
    if (!activeUpload) return;
    const ctrl = getAbortController(activeUpload.abortKey || activeUpload.id);
    ctrl.abort();
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  if (!selectedChatId) return null;

  // Read-only channel — show Mute button instead of input
  if (isChannel) {
    return (
      <div className="border-t">
        <div className="flex items-center justify-center gap-3 p-3">
          <Button
            variant="ghost"
            className="flex-1 gap-2 text-muted-foreground"
          >
            <BellOff className="h-4 w-4" />
            {dialog?.isMuted ? "Включить уведомления" : "Без звука"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            title="Перевести"
          >
            <Languages className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const hasText = text.trim().length > 0;

  // Common emoji for quick picker
  const quickEmojis = ["😀", "😂", "❤️", "👍", "🔥", "😢", "😡", "🎉", "🤔", "👀", "💯", "✅", "🙏", "😎", "🤣", "💪"];

  // Phase labels in Russian
  const phaseLabels: Record<string, string> = {
    queued: "В очереди...",
    generating_thumb: "Миниатюра...",
    transcoding: "Сжатие видео...",
    uploading_thumb: "Загрузка миниатюры...",
    uploading_video: "Загрузка видео...",
    publishing: "Отправка...",
    done: "Готово",
    error: "Ошибка",
    cancelled: "Отменено",
  };

  return (
    <div className="border-t">
      {/* Video upload progress bar */}
      {activeUpload && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground truncate">
                {phaseLabels[activeUpload.phase] || activeUpload.phase}
                {" "}
                <span className="text-foreground font-medium">
                  {activeUpload.progress}%
                </span>
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={cancelUpload}
                title="Отменить"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: activeUpload.progress + "%" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upload error display */}
      {selectedChatId &&
        Object.values(uploadTasks)
          .filter(
            (t) =>
              t.chatId === selectedChatId &&
              t.phase === "error" &&
              t.finishedAt &&
              Date.now() - t.finishedAt < 30_000
          )
          .map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 border-b bg-red-500/10 px-4 py-2"
            >
              <X className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-500 truncate">
                Ошибка загрузки: {t.errorMessage || "неизвестная ошибка"}
              </p>
            </div>
          ))}

      {/* Reply/Edit indicator */}
      {(replyMessage || editMessage) && (
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2">
          {replyMessage && <Reply className="h-4 w-4 text-blue-500 shrink-0" />}
          {editMessage && <Pencil className="h-4 w-4 text-blue-500 shrink-0" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-blue-500">
              {editMessage ? "Редактирование" : "Ответ"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {(replyMessage || editMessage)?.text}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelAction}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Emoji quick picker */}
      {showEmoji && (
        <div className="border-b bg-background p-2 flex flex-wrap gap-1">
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => insertEmoji(emoji)}
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-accent text-lg"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1 px-2 py-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="video/*,image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z,.txt"
          onChange={handleFileSelect}
        />

        {/* Attachment button — left side */}
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9"
          onClick={() => fileInputRef.current?.click()}
          disabled={!!activeUpload}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Сообщение"
          rows={1}
          className="min-h-[36px] max-h-[120px] flex-1 resize-none rounded-2xl border bg-muted/50 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-primary"
          style={{
            height: "auto",
            overflow: "hidden",
          }}
          onInput={(e) => {
            const target = e.currentTarget;
            target.style.height = "auto";
            target.style.height = Math.min(target.scrollHeight, 120) + "px";
          }}
        />

        {/* Send or Mic button — right side */}
        <Button
          size="icon"
          className={cn(
            "shrink-0 h-9 w-9 rounded-full transition-all",
            hasText ? "bg-blue-500 hover:bg-blue-600" : ""
          )}
          variant={hasText ? "default" : "ghost"}
          onClick={hasText ? handleSend : undefined}
          disabled={hasText && isSending}
        >
          {hasText ? (
            <Send className="h-4 w-4" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
