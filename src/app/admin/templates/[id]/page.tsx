"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Shield,
  ShieldAlert,
  Users,
  RefreshCw,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PolicyTemplate, ChatBannedRights } from "@/types/admin";

interface TemplateChat {
  chatId: string;
  appliedAt: string;
  isCompliant: boolean;
  driftDetails: Record<string, unknown> | null;
}

export default function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [template, setTemplate] = useState<PolicyTemplate | null>(null);
  const [chats, setChats] = useState<TemplateChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDriftChecking, setIsDriftChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/templates/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTemplate(data.template);
        setChats(data.chats ?? []);
      } catch (err) {
        console.error("Failed to load template:", err);
        setError("Не удалось загрузить шаблон");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  const handleCheckDrift = async () => {
    setIsDriftChecking(true);
    try {
      const res = await fetch(`/api/admin/templates/${id}/drift`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Update chat compliance statuses from drift report
      setChats((prev) =>
        prev.map((chat) => {
          const found = data.report?.find(
            (r: { chatId: string }) => r.chatId === chat.chatId
          );
          if (found) {
            return {
              ...chat,
              isCompliant: found.isCompliant,
              driftDetails: found.driftDetails,
            };
          }
          return chat;
        })
      );
    } catch (err) {
      console.error("Drift check failed:", err);
    } finally {
      setIsDriftChecking(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/templates"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Шаблон не найден"}
        </div>
      </div>
    );
  }

  const config = template.config;
  const rights = config.chat_permissions;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/templates"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к шаблонам
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{template.name}</h2>
          {template.description && (
            <p className="text-muted-foreground mt-1">{template.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Версия {template.version} · Создан{" "}
            {new Date(template.created_at).toLocaleDateString("ru-RU")}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded ${
            template.is_active
              ? "bg-green-500/10 text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {template.is_active ? "Активен" : "Неактивен"}
        </span>
      </div>

      {/* Config summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Настройки</h3>
          <div className="space-y-2 text-sm">
            <InfoRow
              label="Slow Mode"
              value={config.slow_mode_delay > 0 ? `${config.slow_mode_delay} сек` : "Выкл"}
            />
            <InfoRow
              label="Защита контента"
              value={config.has_protected_content ? "Вкл" : "Выкл"}
            />
            <InfoRow
              label="Вступление по заявке"
              value={config.join_by_request ? "Вкл" : "Выкл"}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium mb-3">Права участников</h3>
          <div className="grid grid-cols-2 gap-1 text-sm">
            {(
              [
                ["can_send_messages", "Сообщения"],
                ["can_send_media", "Медиа"],
                ["can_send_polls", "Опросы"],
                ["can_send_other", "Стикеры/GIF"],
                ["can_add_web_page_previews", "Превью"],
                ["can_change_info", "Изм. инфо"],
                ["can_invite_users", "Инвайты"],
                ["can_pin_messages", "Закреп."],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className={`text-xs py-0.5 ${
                  rights[key as keyof ChatBannedRights]
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {rights[key as keyof ChatBannedRights] ? "✓" : "✗"} {label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Assigned chats */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Привязанные чаты ({chats.length})
          </h3>
          {chats.length > 0 && (
            <button
              onClick={handleCheckDrift}
              disabled={isDriftChecking}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${isDriftChecking ? "animate-spin" : ""}`}
              />
              Проверить drift
            </button>
          )}
        </div>

        {chats.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            <Users className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Нет привязанных чатов</p>
            <p className="text-xs mt-1">
              Примените шаблон к чатам через API или страницу управления чатом
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chat ID</TableHead>
                  <TableHead>Применён</TableHead>
                  <TableHead>Статус</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chats.map((chat) => (
                  <TableRow key={chat.chatId}>
                    <TableCell>
                      <Link
                        href={`/admin/chats/${chat.chatId}`}
                        className="font-mono text-sm text-blue-400 hover:underline"
                      >
                        {chat.chatId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {new Date(chat.appliedAt).toLocaleDateString("ru-RU")}
                    </TableCell>
                    <TableCell>
                      {chat.isCompliant ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <Shield className="h-3.5 w-3.5" /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                          <ShieldAlert className="h-3.5 w-3.5" /> Drift
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
