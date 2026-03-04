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

      {/* Navigation cards */}
      <div className="grid gap-4 md:grid-cols-3">
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
