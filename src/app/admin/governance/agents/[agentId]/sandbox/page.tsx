"use client";

import { useEffect, useState, use } from "react";
import {
  Loader2,
  ChevronRight,
  PlayCircle,
  PauseCircle,
  RotateCcw,
  Shield,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  status: string;
  model: string;
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
  shadow: "Shadow Mode",
  canary: "Canary Deploy",
  active: "Активен",
  deprecated: "Устаревший",
  retired: "Выведен",
};

const LIFECYCLE_STAGES = [
  { key: "approved", label: "Одобрен", icon: CheckCircle2 },
  { key: "testing", label: "Sandbox", icon: Shield },
  { key: "shadow", label: "Shadow", icon: Eye },
  { key: "canary", label: "Canary", icon: AlertTriangle },
  { key: "active", label: "Продакшн", icon: PlayCircle },
];

export default function SandboxPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [agentRes, auditRes] = await Promise.all([
          fetch(`/api/admin/agents/${agentId}`),
          fetch(`/api/admin/agents/${agentId}/audit?limit=20`),
        ]);

        if (!agentRes.ok) throw new Error(`HTTP ${agentRes.status}`);
        const agentData = await agentRes.json();
        setAgent(agentData.agent);

        if (auditRes.ok) {
          const auditData = await auditRes.json();
          setAuditLog(auditData.entries ?? []);
        }
      } catch (err) {
        console.error("Failed to load sandbox data:", err);
        setError("Не удалось загрузить данные");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [agentId]);

  const updateStatus = async (newStatus: string) => {
    setStatusUpdating(true);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh agent
      const agentRes = await fetch(`/api/admin/agents/${agentId}`);
      if (agentRes.ok) {
        const data = await agentRes.json();
        setAgent(data.agent);
      }
    } catch (err) {
      console.error("Failed to update status:", err);
      setError("Не удалось обновить статус");
    } finally {
      setStatusUpdating(false);
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
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
          {error ?? "Агент не найден"}
        </div>
      </div>
    );
  }

  const currentStageIdx = LIFECYCLE_STAGES.findIndex(
    (s) => s.key === agent.status
  );
  const nextStage =
    currentStageIdx >= 0 && currentStageIdx < LIFECYCLE_STAGES.length - 1
      ? LIFECYCLE_STAGES[currentStageIdx + 1]
      : null;
  const prevStage =
    currentStageIdx > 0 ? LIFECYCLE_STAGES[currentStageIdx - 1] : null;

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
          href={`/admin/governance/agents/${agentId}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {agent.name}
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Sandbox & Deploy</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Sandbox & Deployment Pipeline
        </h2>
        <p className="text-muted-foreground text-sm">
          Жизненный цикл агента: тестирование → shadow → canary → production
        </p>
      </div>

      {/* Lifecycle pipeline */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-sm font-semibold mb-4">Стадии деплоя</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {LIFECYCLE_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isCurrent = stage.key === agent.status;
            const isPast = currentStageIdx >= 0 && idx < currentStageIdx;
            const isFuture = currentStageIdx >= 0 && idx > currentStageIdx;

            return (
              <div key={stage.key} className="flex items-center gap-2">
                {idx > 0 && (
                  <div
                    className={`w-8 h-0.5 ${isPast ? "bg-green-500" : "bg-border"}`}
                  />
                )}
                <div
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[80px] ${
                    isCurrent
                      ? "bg-blue-500/10 border border-blue-500/30"
                      : isPast
                        ? "bg-green-500/10"
                        : "bg-muted/50"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      isCurrent
                        ? "text-blue-500"
                        : isPast
                          ? "text-green-500"
                          : "text-muted-foreground/40"
                    }`}
                  />
                  <span
                    className={`text-xs font-medium ${
                      isCurrent
                        ? "text-blue-500"
                        : isPast
                          ? "text-green-500"
                          : "text-muted-foreground/60"
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm">
            Текущая стадия:{" "}
            <span className="font-semibold">
              {STATUS_LABELS[agent.status] ?? agent.status}
            </span>
          </div>
          <div className="flex gap-2">
            {prevStage && (
              <button
                onClick={() => updateStatus(prevStage.key)}
                disabled={statusUpdating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-sm hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                {statusUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" />
                )}
                Откатить
              </button>
            )}
            {nextStage && (
              <button
                onClick={() => updateStatus(nextStage.key)}
                disabled={statusUpdating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {statusUpdating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="h-3.5 w-3.5" />
                )}
                → {nextStage.label}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Shadow mode info */}
      {agent.status === "shadow" && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
          <div className="flex items-start gap-3">
            <Eye className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Shadow Mode активен</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Агент обрабатывает сообщения параллельно с человеком, но{" "}
                <strong>не отправляет ответы</strong> в чат. Все выходные данные
                записываются для сравнения и оценки точности.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Canary mode info */}
      {agent.status === "canary" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm">Canary Deploy</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Агент активен и отвечает в чатах, но каждое действие может быть
                отменено. После N успешных выполнений без коррекций агент будет
                переведён в полную автономию.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Последние действия</h3>
        </div>
        {auditLog.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Действий пока нет
          </div>
        ) : (
          <div className="divide-y divide-border">
            {auditLog.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono">{entry.action}</p>
                  {entry.chat_id && (
                    <p className="text-xs text-muted-foreground">
                      Chat: {entry.chat_id}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                  {new Date(entry.created_at).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
