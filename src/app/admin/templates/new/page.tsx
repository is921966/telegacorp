"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import type { PolicyConfig, ChatBannedRights } from "@/types/admin";

const DEFAULT_RIGHTS: ChatBannedRights = {
  can_send_messages: true,
  can_send_media: true,
  can_send_polls: true,
  can_send_other: true,
  can_add_web_page_previews: true,
  can_change_info: false,
  can_invite_users: true,
  can_pin_messages: false,
};

const DEFAULT_CONFIG: PolicyConfig = {
  chat_permissions: DEFAULT_RIGHTS,
  slow_mode_delay: 0,
  message_auto_delete_time: 0,
  has_protected_content: false,
  has_aggressive_anti_spam_enabled: false,
  has_hidden_members: false,
  join_by_request: false,
};

export default function NewTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [config, setConfig] = useState<PolicyConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rights = config.chat_permissions;

  const toggleRight = (key: keyof ChatBannedRights) => {
    setConfig({
      ...config,
      chat_permissions: { ...rights, [key]: !rights[key] },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Укажите название шаблона");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined, config }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      router.push(`/admin/templates/${data.template.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/admin/templates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к шаблонам
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Новый шаблон</h2>
        <p className="text-muted-foreground">
          Создание шаблона политики для корпоративных чатов
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name + Description */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Название *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Базовая политика"
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Стандартные настройки для рабочих групп"
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none"
            />
          </div>
        </div>

        {/* Slow mode */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Slow Mode</h3>
          <select
            value={config.slow_mode_delay}
            onChange={(e) =>
              setConfig({ ...config, slow_mode_delay: Number(e.target.value) })
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

        {/* Toggles */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Ограничения</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.has_protected_content}
                onChange={(e) =>
                  setConfig({ ...config, has_protected_content: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">Запретить пересылку</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={config.join_by_request}
                onChange={(e) =>
                  setConfig({ ...config, join_by_request: e.target.checked })
                }
                className="h-4 w-4 rounded border-border"
              />
              <span className="text-sm">Вступление по заявке</span>
            </label>
          </div>
        </div>

        {/* Default banned rights */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-medium">Права участников по умолчанию</h3>
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

        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Создать шаблон
        </button>
      </form>
    </div>
  );
}
