"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  ChevronRight,
  Radio,
  Settings,
  Save,
  Plus,
} from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MonitoredChat {
  chat_id: number;
  title: string | null;
  monitoring_enabled: boolean;
  excluded_topics: string[];
  assigned_agents: string[];
}

interface GovernanceSettings {
  globalBudgetCapUsd: number;
  maxActiveAgents: number;
  shadowModeDurationDays: number;
  canaryApprovalThreshold: number;
  autoRetireAccuracyThreshold: number;
  defaultModel: string;
  vpsApiUrl: string | null;
  redisConfigured: boolean;
  qdrantConfigured: boolean;
}

export default function GovernanceSettingsPage() {
  const [settings, setSettings] = useState<GovernanceSettings | null>(null);
  const [monitoredChats, setMonitoredChats] = useState<MonitoredChat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, monitoringRes] = await Promise.all([
          fetch("/api/admin/governance/settings"),
          fetch("/api/admin/monitoring"),
        ]);

        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setSettings(data);
        }
        if (monitoringRes.ok) {
          const data = await monitoringRes.json();
          setMonitoredChats(data.chats ?? []);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        setError("Не удалось загрузить настройки");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/admin/governance"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Governance
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Настройки</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Настройки</h2>
        <p className="text-muted-foreground text-sm">
          Конфигурация AI-мониторинга, лимиты и параметры агентов
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Global configuration */}
      {settings && (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Глобальные параметры</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Управление через переменные окружения (env vars). Для изменения
            обновите конфигурацию на сервере.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <SettingItem
              label="Лимит бюджета LLM"
              value={`$${settings.globalBudgetCapUsd}`}
              envVar="AGENT_BUDGET_CAP_USD"
            />
            <SettingItem
              label="Макс. активных агентов"
              value={String(settings.maxActiveAgents)}
              envVar="MAX_ACTIVE_AGENTS"
            />
            <SettingItem
              label="Shadow mode (дни)"
              value={String(settings.shadowModeDurationDays)}
              envVar="SHADOW_MODE_DURATION_DAYS"
            />
            <SettingItem
              label="Canary порог одобрений"
              value={String(settings.canaryApprovalThreshold)}
              envVar="CANARY_APPROVAL_THRESHOLD"
            />
            <SettingItem
              label="Порог авто-retire"
              value={`${(settings.autoRetireAccuracyThreshold * 100).toFixed(0)}%`}
              envVar="AUTO_RETIRE_ACCURACY"
            />
            <SettingItem
              label="Модель по умолчанию"
              value={settings.defaultModel}
              envVar="DEFAULT_AGENT_MODEL"
            />
          </div>
        </div>
      )}

      {/* Monitored chats */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Мониторируемые чаты</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {monitoredChats.filter((c) => c.monitoring_enabled).length} активных
          </span>
        </div>

        {monitoredChats.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Нет мониторируемых чатов. Включите мониторинг в настройках чата.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chat ID</TableHead>
                <TableHead>Название</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Исключённые темы</TableHead>
                <TableHead className="text-center">Агентов</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitoredChats.map((chat) => (
                <TableRow key={chat.chat_id}>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {chat.chat_id}
                  </TableCell>
                  <TableCell className="text-sm">
                    {chat.title ?? "Без названия"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        chat.monitoring_enabled
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {chat.monitoring_enabled ? "Включён" : "Выключен"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {chat.excluded_topics?.length > 0
                      ? chat.excluded_topics.join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">
                    {chat.assigned_agents?.length ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/* ---- Helpers ---- */

function SettingItem({
  label,
  value,
  envVar,
}: {
  label: string;
  value: string;
  envVar: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm">{label}</p>
        <span className="text-sm font-semibold">{value}</span>
      </div>
      <p className="text-[10px] text-muted-foreground/60 font-mono mt-1">
        {envVar}
      </p>
    </div>
  );
}
