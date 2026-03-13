"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import {
  Loader2,
  Users,
  Shield,
  ShieldAlert,
  Settings,
  ScrollText,
  BookOpen,
  ArrowLeft,
  Link as LinkIcon,
  Hash,
  Megaphone,
} from "lucide-react";
import type { ManagedChatInfo, ChatBannedRights } from "@/types/admin";

interface ChatDetails {
  chat: ManagedChatInfo;
  about: string | null;
  slowModeDelay: number;
  defaultBannedRights: ChatBannedRights;
  hasProtectedContent: boolean;
  hasHiddenMembers: boolean;
  hasAggressiveAntiSpam: boolean;
  linkedChatId: string | null;
  inviteLink: string | null;
}

export default function ChatDetailPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const [details, setDetails] = useState<ChatDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/chats/${chatId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDetails(data);
      } catch (err) {
        console.error("Failed to load chat details:", err);
        setError("Не удалось загрузить информацию о чате");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [chatId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/chats"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Назад к списку
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error ?? "Чат не найден"}
        </div>
      </div>
    );
  }

  const { chat } = details;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/admin/chats"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к списку
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {chat.type === "channel" ? (
              <Megaphone className="h-5 w-5 text-muted-foreground" />
            ) : (
              <Hash className="h-5 w-5 text-muted-foreground" />
            )}
            <h2 className="text-2xl font-bold tracking-tight">{chat.title}</h2>
          </div>
          {details.about && (
            <p className="text-muted-foreground mt-1 max-w-xl">{details.about}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {chat.isCompliant ? (
            <span className="inline-flex items-center gap-1 text-sm text-green-400 bg-green-500/10 px-3 py-1 rounded-full">
              <Shield className="h-4 w-4" /> Compliant
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full">
              <ShieldAlert className="h-4 w-4" /> Drift
            </span>
          )}
        </div>
      </div>

      {/* Drift details */}
      {!chat.isCompliant && chat.driftDetails && Object.keys(chat.driftDetails).length > 0 && (
        <DriftAlert details={chat.driftDetails} />
      )}

      {/* Navigation cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <NavCard
          href={`/admin/chats/${chatId}/members`}
          icon={<Users className="h-5 w-5" />}
          title="Участники"
          description={`${chat.participantCount.toLocaleString()} участников`}
        />
        <NavCard
          href={`/admin/chats/${chatId}/settings`}
          icon={<Settings className="h-5 w-5" />}
          title="Настройки"
          description="Права, slow mode, пересылка"
        />
        <NavCard
          href={`/admin/chats/${chatId}/events`}
          icon={<ScrollText className="h-5 w-5" />}
          title="Журнал событий"
          description="Admin log (48ч)"
        />
        <NavCard
          href={`/admin/archive?chatId=${chatId}`}
          icon={<BookOpen className="h-5 w-5" />}
          title="История"
          description="Архив сообщений"
        />
      </div>

      {/* Info grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <InfoCard title="Основное">
          <InfoRow label="ID" value={chat.id} />
          <InfoRow
            label="Тип"
            value={chat.type === "supergroup" ? "Супергруппа" : "Канал"}
          />
          <InfoRow
            label="Участников"
            value={chat.participantCount.toLocaleString()}
          />
          {details.linkedChatId && (
            <InfoRow label="Связанный чат" value={details.linkedChatId} />
          )}
        </InfoCard>

        <InfoCard title="Настройки">
          <InfoRow
            label="Slow Mode"
            value={
              details.slowModeDelay > 0
                ? `${details.slowModeDelay} сек`
                : "Выкл"
            }
          />
          <InfoRow
            label="Защита контента"
            value={details.hasProtectedContent ? "Вкл" : "Выкл"}
          />
          <InfoRow
            label="Скрытые участники"
            value={details.hasHiddenMembers ? "Вкл" : "Выкл"}
          />
          <InfoRow
            label="Anti-spam"
            value={details.hasAggressiveAntiSpam ? "Вкл" : "Выкл"}
          />
          {details.inviteLink && (
            <InfoRow
              label="Инвайт-ссылка"
              value={
                <span className="inline-flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  <span className="truncate max-w-[200px]">{details.inviteLink}</span>
                </span>
              }
            />
          )}
        </InfoCard>
      </div>
    </div>
  );
}

function NavCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="text-muted-foreground group-hover:text-foreground transition-colors">
          {icon}
        </div>
        <div>
          <p className="font-medium text-sm">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
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

function DriftAlert({ details }: { details: Record<string, { expected: unknown; actual: unknown }> }) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="h-4 w-4 text-amber-400" />
        <span className="text-sm font-medium text-amber-400">
          Настройки чата не совпадают с шаблоном
        </span>
      </div>
      <div className="space-y-3">
        {Object.entries(details).map(([key, { expected, actual }]) => (
          <div key={key} className="text-sm">
            <p className="text-foreground font-medium text-xs mb-0.5">
              {DRIFT_LABELS[key] || key}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-green-400/70">шаблон:</span>
              <span className="text-green-400 font-medium">{formatDriftValue(key, expected)}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-red-400/70">сейчас:</span>
              <span className="text-red-400 font-medium">{formatDriftValue(key, actual)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
