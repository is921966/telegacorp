"use client";

import { useEffect, useState, use } from "react";
import {
  Loader2,
  Bot,
  ChevronRight,
  ArrowLeft,
  Shield,
  Clock,
  Zap,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
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

interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: string;
  model: string;
  gateway_id: string | null;
  permissions: Record<string, unknown>;
  config: Record<string, unknown>;
  assigned_chats: number[];
  pattern_id: string | null;
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
  retired_at: string | null;
}

interface Metrics {
  id: number;
  period_start: string;
  period_end: string;
  executions: number;
  successful: number;
  failed: number;
  avg_response_time_ms: number | null;
  tokens_consumed: number;
  cost_usd: number;
  user_corrections: number;
  time_saved_minutes: number;
}

interface Feedback {
  id: number;
  type: string;
  message: string | null;
  original_output: string | null;
  corrected_output: string | null;
  created_at: string;
}

interface AuditEntry {
  id: number;
  action: string;
  chat_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  proposed: "Предложен",
  approved: "Одобрен",
  testing: "Тестирование",
  shadow: "Shadow",
  canary: "Canary",
  active: "Активен",
  deprecated: "Устаревший",
  retired: "Выведен",
};

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"metrics" | "feedback" | "audit">("metrics");
  const [approveLoading, setApproveLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [agentRes, metricsRes, feedbackRes, auditRes] = await Promise.all([
          fetch(`/api/admin/agents/${agentId}`),
          fetch(`/api/admin/agents/${agentId}/metrics`),
          fetch(`/api/admin/agents/${agentId}/feedback`),
          fetch(`/api/admin/agents/${agentId}/audit`),
        ]);

        if (!agentRes.ok) throw new Error(`Agent: HTTP ${agentRes.status}`);
        const agentData = await agentRes.json();
        setAgent(agentData.agent);

        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData.metrics ?? []);
        }
        if (feedbackRes.ok) {
          const feedbackData = await feedbackRes.json();
          setFeedback(feedbackData.feedback ?? []);
        }
        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAudit(auditData.entries ?? []);
        }
      } catch (err) {
        console.error("Failed to load agent:", err);
        setError("Не удалось загрузить агента");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [agentId]);

  const handleApprove = async () => {
    setApproveLoading(true);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh agent
      const agentRes = await fetch(`/api/admin/agents/${agentId}`);
      if (agentRes.ok) {
        const data = await agentRes.json();
        setAgent(data.agent);
      }
    } catch (err) {
      console.error("Failed to approve agent:", err);
      setError("Не удалось одобрить агента");
    } finally {
      setApproveLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="space-y-4">
        <Link
          href="/admin/governance/agents"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
          {error ?? "Агент не найден"}
        </div>
      </div>
    );
  }

  // Aggregate metrics
  const totalExec = metrics.reduce((s, m) => s + m.executions, 0);
  const totalSuccess = metrics.reduce((s, m) => s + m.successful, 0);
  const totalFailed = metrics.reduce((s, m) => s + m.failed, 0);
  const totalCost = metrics.reduce((s, m) => s + Number(m.cost_usd), 0);
  const totalTimeSaved = metrics.reduce((s, m) => s + m.time_saved_minutes, 0);
  const totalCorrections = metrics.reduce((s, m) => s + m.user_corrections, 0);
  const accuracy = totalExec > 0 ? ((totalExec - totalCorrections) / totalExec) * 100 : 0;

  const canApprove = ["proposed", "testing"].includes(agent.status);
  const thumbsUp = feedback.filter((f) => f.type === "thumbs_up").length;
  const thumbsDown = feedback.filter((f) => f.type === "thumbs_down").length;

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
        <Link
          href="/admin/governance/agents"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Агенты
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{agent.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
            <Bot className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold">{agent.name}</h2>
              <AgentStatusBadge status={agent.status} />
            </div>
            {agent.description && (
              <p className="text-muted-foreground text-sm mt-0.5">
                {agent.description}
              </p>
            )}
          </div>
        </div>

        {canApprove && (
          <button
            onClick={handleApprove}
            disabled={approveLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {approveLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Одобрить
          </button>
        )}
      </div>

      {/* Info grid */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <InfoCard label="Модель" value={agent.model} />
        <InfoCard
          label="Создан"
          value={new Date(agent.created_at).toLocaleDateString("ru-RU")}
        />
        <InfoCard
          label="Привязанных чатов"
          value={String(agent.assigned_chats?.length ?? 0)}
        />
        <InfoCard
          label="Gateway"
          value={agent.gateway_id ?? "Не привязан"}
        />
      </div>

      {/* Metrics summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<Zap className="h-5 w-5 text-amber-500" />}
          title="Выполнений"
          value={String(totalExec)}
          subtitle={`${totalSuccess} успешных · ${totalFailed} ошибок`}
        />
        <MetricCard
          icon={<Shield className="h-5 w-5 text-blue-500" />}
          title="Точность"
          value={`${accuracy.toFixed(1)}%`}
          subtitle={`${totalCorrections} коррекций`}
          alert={accuracy < 80 && totalExec > 0}
        />
        <MetricCard
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          title="Расходы"
          value={`$${totalCost.toFixed(2)}`}
          subtitle="за всё время"
        />
        <MetricCard
          icon={<Clock className="h-5 w-5 text-purple-500" />}
          title="Сэкономлено"
          value={formatMinutes(totalTimeSaved)}
          subtitle="времени сотрудников"
        />
      </div>

      {/* Feedback summary */}
      <div className="flex items-center gap-6 rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-sm text-muted-foreground">Обратная связь:</span>
        <span className="inline-flex items-center gap-1 text-sm text-green-500">
          <ThumbsUp className="h-4 w-4" /> {thumbsUp}
        </span>
        <span className="inline-flex items-center gap-1 text-sm text-red-500">
          <ThumbsDown className="h-4 w-4" /> {thumbsDown}
        </span>
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" /> {feedback.length} всего
        </span>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          {(["metrics", "feedback", "audit"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 text-sm transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-blue-500 text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "metrics"
                ? "Метрики"
                : tab === "feedback"
                  ? "Обратная связь"
                  : "Аудит"}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "metrics" && (
        <MetricsTab metrics={metrics} />
      )}
      {activeTab === "feedback" && (
        <FeedbackTab feedback={feedback} />
      )}
      {activeTab === "audit" && (
        <AuditTab audit={audit} />
      )}
    </div>
  );
}

/* ---- Tab components ---- */

function MetricsTab({ metrics }: { metrics: Metrics[] }) {
  if (metrics.length === 0) {
    return (
      <EmptyState
        icon={<Zap className="h-10 w-10" />}
        text="Метрики пока не собраны"
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Период</TableHead>
            <TableHead className="text-right">Выполнений</TableHead>
            <TableHead className="text-right">Успешных</TableHead>
            <TableHead className="text-right">Ошибок</TableHead>
            <TableHead className="text-right">Ср. время (мс)</TableHead>
            <TableHead className="text-right">Стоимость</TableHead>
            <TableHead className="text-right">Сэкономлено</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {new Date(m.period_start).toLocaleDateString("ru-RU")} —{" "}
                {new Date(m.period_end).toLocaleDateString("ru-RU")}
              </TableCell>
              <TableCell className="text-right tabular-nums">{m.executions}</TableCell>
              <TableCell className="text-right tabular-nums text-green-500">{m.successful}</TableCell>
              <TableCell className="text-right tabular-nums text-red-500">{m.failed}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {m.avg_response_time_ms ?? "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums font-mono">
                ${Number(m.cost_usd).toFixed(2)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {m.time_saved_minutes} мин.
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function FeedbackTab({ feedback }: { feedback: Feedback[] }) {
  if (feedback.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-10 w-10" />}
        text="Обратной связи пока нет"
      />
    );
  }

  return (
    <div className="space-y-3">
      {feedback.map((f) => (
        <div key={f.id} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <FeedbackIcon type={f.type} />
            <span className="text-sm font-medium">
              {FEEDBACK_LABELS[f.type] ?? f.type}
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(f.created_at).toLocaleString("ru-RU")}
            </span>
          </div>
          {f.message && <p className="text-sm text-muted-foreground">{f.message}</p>}
          {f.corrected_output && (
            <div className="mt-2 p-2 rounded bg-muted text-xs font-mono">
              <p className="text-muted-foreground mb-1">Коррекция:</p>
              <p>{f.corrected_output}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AuditTab({ audit }: { audit: AuditEntry[] }) {
  if (audit.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="h-10 w-10" />}
        text="Действий пока нет"
      />
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[160px]">Дата</TableHead>
            <TableHead>Действие</TableHead>
            <TableHead>Chat ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audit.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {new Date(entry.created_at).toLocaleString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm">{entry.action}</span>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground font-mono">
                {entry.chat_id ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ---- Helpers ---- */

const FEEDBACK_LABELS: Record<string, string> = {
  thumbs_up: "Полезно",
  thumbs_down: "Неполезно",
  correction: "Коррекция",
  comment: "Комментарий",
};

function FeedbackIcon({ type }: { type: string }) {
  switch (type) {
    case "thumbs_up":
      return <ThumbsUp className="h-4 w-4 text-green-500" />;
    case "thumbs_down":
      return <ThumbsDown className="h-4 w-4 text-red-500" />;
    case "correction":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
  }
}

function AgentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-400",
    proposed: "bg-cyan-500/10 text-cyan-400",
    approved: "bg-teal-500/10 text-teal-400",
    testing: "bg-purple-500/10 text-purple-400",
    shadow: "bg-blue-500/10 text-blue-400",
    canary: "bg-amber-500/10 text-amber-400",
    active: "bg-green-500/10 text-green-400",
    deprecated: "bg-orange-500/10 text-orange-400",
    retired: "bg-gray-500/10 text-gray-500",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value}</p>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  subtitle,
  alert,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm text-muted-foreground">{title}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p
        className={`text-xs mt-1 ${alert ? "text-red-500" : "text-muted-foreground"}`}
      >
        {alert && <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />}
        {subtitle}
      </p>
    </div>
  );
}

function EmptyState({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
      <div className="mx-auto mb-3 opacity-40">{icon}</div>
      <p className="text-sm">{text}</p>
    </div>
  );
}

function formatMinutes(mins: number): string {
  if (mins >= 1440) return `${(mins / 1440).toFixed(1)} дн.`;
  if (mins >= 60) return `${(mins / 60).toFixed(1)} ч.`;
  return `${mins} мин.`;
}
