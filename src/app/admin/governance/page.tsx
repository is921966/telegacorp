"use client";

import { useEffect, useState } from "react";
import {
  Loader2,
  Bot,
  Brain,
  Radio,
  Zap,
  DollarSign,
  Clock,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardData {
  totalAgents: number;
  activeAgents: number;
  totalPatterns: number;
  pendingPatterns: number;
  monitoredChats: number;
  totalExecutions: number;
  totalCostUsd: number;
  totalTimeSavedMinutes: number;
}

interface BudgetAgent {
  id: string;
  name: string;
  status: string;
  totalCostUsd: number;
  totalTokens: number;
  totalExecutions: number;
}

interface SettingsData {
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

export default function GovernanceDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [budget, setBudget] = useState<{ agents: BudgetAgent[]; totalCostUsd: number } | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dashRes, budgetRes, settingsRes] = await Promise.all([
          fetch("/api/admin/governance/dashboard"),
          fetch("/api/admin/governance/budget"),
          fetch("/api/admin/governance/settings"),
        ]);

        if (!dashRes.ok) throw new Error(`Dashboard: HTTP ${dashRes.status}`);
        if (!budgetRes.ok) throw new Error(`Budget: HTTP ${budgetRes.status}`);
        if (!settingsRes.ok) throw new Error(`Settings: HTTP ${settingsRes.status}`);

        const [dashData, budgetData, settingsData] = await Promise.all([
          dashRes.json(),
          budgetRes.json(),
          settingsRes.json(),
        ]);

        setDashboard(dashData);
        setBudget(budgetData);
        setSettings(settingsData);
      } catch (err) {
        console.error("Failed to load governance dashboard:", err);
        setError("Не удалось загрузить данные");
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

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
        {error}
      </div>
    );
  }

  const budgetUsedPercent = settings && dashboard
    ? Math.min(100, (dashboard.totalCostUsd / settings.globalBudgetCapUsd) * 100)
    : 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Governance Portal
          </h2>
          <p className="text-sm text-muted-foreground">
            AI Agent Factory — мониторинг и управление
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/governance/patterns">
              <Brain className="h-4 w-4 mr-1.5" />
              Паттерны
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/governance/agents">
              <Bot className="h-4 w-4 mr-1.5" />
              Агенты
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      {dashboard && (
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Всего агентов"
            value={String(dashboard.totalAgents)}
            subtitle={`${dashboard.activeAgents} активных`}
            icon={<Bot className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            title="Паттернов"
            value={String(dashboard.totalPatterns)}
            subtitle={
              dashboard.pendingPatterns > 0
                ? `${dashboard.pendingPatterns} ожидают`
                : "нет ожидающих"
            }
            icon={<Brain className="h-5 w-5 text-purple-500" />}
            alert={dashboard.pendingPatterns > 0}
          />
          <StatCard
            title="Мониторинг"
            value={String(dashboard.monitoredChats)}
            subtitle="чатов с AI"
            icon={<Radio className="h-5 w-5 text-green-500" />}
          />
          <StatCard
            title="Выполнений"
            value={formatNumber(dashboard.totalExecutions)}
            subtitle="всего"
            icon={<Zap className="h-5 w-5 text-amber-500" />}
          />
        </div>
      )}

      {/* Budget & ROI */}
      {dashboard && settings && (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {/* Budget */}
          <Card className="py-0">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Бюджет LLM</h3>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-2xl sm:text-3xl font-bold">
                  ${dashboard.totalCostUsd.toFixed(2)}
                </span>
                <span className="text-sm text-muted-foreground mb-1">
                  / ${settings.globalBudgetCapUsd}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    budgetUsedPercent > 80
                      ? "bg-red-500"
                      : budgetUsedPercent > 50
                        ? "bg-amber-500"
                        : "bg-green-500"
                  }`}
                  style={{ width: `${budgetUsedPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {budgetUsedPercent.toFixed(1)}% использовано
              </p>
            </CardContent>
          </Card>

          {/* Time saved */}
          <Card className="py-0">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-semibold">Экономия времени</h3>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-2xl sm:text-3xl font-bold">
                  {formatMinutes(dashboard.totalTimeSavedMinutes)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Суммарно сэкономлено AI-агентами
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Agent cost breakdown */}
      {budget && budget.agents.length > 0 && (
        <Card className="py-0">
          <div className="flex items-center gap-2 p-4 border-b border-border">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Расходы по агентам</h3>
          </div>
          <div className="divide-y divide-border">
            {budget.agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AgentStatusDot status={agent.status} />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/governance/agents/${agent.id}`}
                      className="text-sm font-medium hover:underline block truncate"
                    >
                      {agent.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {agent.totalExecutions} выполнений · {formatNumber(agent.totalTokens)} токенов
                    </p>
                  </div>
                </div>
                <span className="text-sm font-mono tabular-nums shrink-0 ml-3">
                  ${agent.totalCostUsd.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Infrastructure status */}
      {settings && (
        <Card className="py-0">
          <CardContent className="p-4 sm:p-5">
            <h3 className="font-semibold mb-3">Инфраструктура</h3>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <InfraItem
                label="VPS API"
                ok={!!settings.vpsApiUrl}
                value={settings.vpsApiUrl ? "Подключён" : "Не настроен"}
              />
              <InfraItem
                label="Redis"
                ok={settings.redisConfigured}
                value={settings.redisConfigured ? "Подключён" : "Не настроен"}
              />
              <InfraItem
                label="Qdrant"
                ok={settings.qdrantConfigured}
                value={settings.qdrantConfigured ? "Подключён" : "Не настроен"}
              />
              <InfraItem
                label="Модель"
                ok={true}
                value={settings.defaultModel}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ---- Helper components ---- */

function StatCard({
  title,
  value,
  subtitle,
  icon,
  alert,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <Card className="py-0">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs sm:text-sm text-muted-foreground">{title}</p>
          {icon}
        </div>
        <p className="text-xl sm:text-2xl font-bold">{value}</p>
        {subtitle && (
          <p className={`text-xs mt-1 ${alert ? "text-amber-500" : "text-muted-foreground"}`}>
            {alert && <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AgentStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-500",
    canary: "bg-amber-500",
    shadow: "bg-blue-400",
    testing: "bg-purple-400",
    draft: "bg-gray-400",
    proposed: "bg-cyan-400",
    approved: "bg-teal-400",
    deprecated: "bg-orange-500",
    retired: "bg-gray-600",
  };
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${colors[status] ?? "bg-gray-400"}`}
      title={status}
    />
  );
}

function InfraItem({
  label,
  ok,
  value,
}: {
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full shrink-0 ${ok ? "bg-green-500" : "bg-red-500"}`}
      />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm truncate">{value}</p>
      </div>
    </div>
  );
}

/* ---- Utility ---- */

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatMinutes(mins: number): string {
  if (mins >= 1440) return `${(mins / 1440).toFixed(1)} дн.`;
  if (mins >= 60) return `${(mins / 60).toFixed(1)} ч.`;
  return `${mins} мин.`;
}
