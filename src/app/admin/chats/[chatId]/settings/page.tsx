"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, Save, Check } from "lucide-react";
import type { ChatBannedRights } from "@/types/admin";

interface ChatSettings {
  slowModeDelay: number;
  hasProtectedContent: boolean;
  defaultBannedRights: ChatBannedRights;
}

export default function ChatSettingsPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/chats/${chatId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSettings({
          slowModeDelay: data.slowModeDelay,
          hasProtectedContent: data.hasProtectedContent,
          defaultBannedRights: data.defaultBannedRights,
        });
      } catch (err) {
        console.error("Failed to load settings:", err);
        setError("Не удалось загрузить настройки");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [chatId]);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await fetch(`/api/admin/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slowModeDelay: settings.slowModeDelay,
          noForwards: settings.hasProtectedContent,
          defaultBannedRights: settings.defaultBannedRights,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save settings:", err);
      setError("Не удалось сохранить настройки");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="space-y-4">
        <Link
          href={`/admin/chats/${chatId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Настройки не найдены"}
        </div>
      </div>
    );
  }

  const rights = settings.defaultBannedRights;

  const toggleRight = (key: keyof ChatBannedRights) => {
    setSettings({
      ...settings,
      defaultBannedRights: {
        ...rights,
        [key]: !rights[key],
      },
    });
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/chats/${chatId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к чату
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Настройки чата</h2>
          <p className="text-muted-foreground">
            Права по умолчанию и ограничения
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saved ? "Сохранено" : "Сохранить"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Slow mode */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium">Slow Mode</h3>
        <div className="flex items-center gap-3">
          <select
            value={settings.slowModeDelay}
            onChange={(e) =>
              setSettings({ ...settings, slowModeDelay: Number(e.target.value) })
            }
            className="px-3 py-1.5 rounded-md border border-border bg-background text-sm"
          >
            <option value={0}>Выключен</option>
            <option value={10}>10 секунд</option>
            <option value={30}>30 секунд</option>
            <option value={60}>1 минута</option>
            <option value={300}>5 минут</option>
            <option value={900}>15 минут</option>
            <option value={3600}>1 час</option>
          </select>
        </div>
      </div>

      {/* Protected content */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium">Защита контента</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.hasProtectedContent}
            onChange={(e) =>
              setSettings({
                ...settings,
                hasProtectedContent: e.target.checked,
              })
            }
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm">Запретить пересылку сообщений</span>
        </label>
      </div>

      {/* Default banned rights */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-medium">Права участников по умолчанию</h3>
        <p className="text-xs text-muted-foreground">
          Включённые права доступны всем новым участникам
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["can_send_messages", "Отправка сообщений"],
              ["can_send_media", "Отправка медиа"],
              ["can_send_polls", "Создание опросов"],
              ["can_send_other", "Стикеры, GIF, игры"],
              ["can_add_web_page_previews", "Превью ссылок"],
              ["can_change_info", "Изменение информации"],
              ["can_invite_users", "Приглашение участников"],
              ["can_pin_messages", "Закрепление сообщений"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-3 cursor-pointer py-1"
            >
              <input
                type="checkbox"
                checked={rights[key]}
                onChange={() => toggleRight(key)}
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
