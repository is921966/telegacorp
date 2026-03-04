"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  X,
  Shield,
  Zap,
  Clock,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentInfo {
  id: string;
  name: string;
  description: string | null;
  status: string;
  model: string;
  assigned_chats: number[];
  created_at: string;
}

interface AgentInfoPanelProps {
  agentId: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
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

/**
 * AgentInfoPanel — sidebar panel showing agent details in chat.
 * Opens when clicking on an agent badge or from the chat menu.
 */
export function AgentInfoPanel({
  agentId,
  isOpen,
  onClose,
  className,
}: AgentInfoPanelProps) {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [metrics, setMetrics] = useState<{
    executions: number;
    accuracy: number;
    costUsd: number;
    timeSavedMin: number;
    thumbsUp: number;
    thumbsDown: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !agentId) return;

    setIsLoading(true);
    (async () => {
      try {
        const [agentRes, metricsRes, feedbackRes] = await Promise.all([
          fetch(`/api/admin/agents/${agentId}`),
          fetch(`/api/admin/agents/${agentId}/metrics`),
          fetch(`/api/admin/agents/${agentId}/feedback`),
        ]);

        if (agentRes.ok) {
          const data = await agentRes.json();
          setAgent(data.agent);
        }

        let totalExec = 0;
        let totalCorrections = 0;
        let totalCost = 0;
        let totalTimeSaved = 0;

        if (metricsRes.ok) {
          const data = await metricsRes.json();
          const items = data.metrics ?? [];
          for (const m of items) {
            totalExec += m.executions;
            totalCorrections += m.user_corrections;
            totalCost += Number(m.cost_usd);
            totalTimeSaved += m.time_saved_minutes;
          }
        }

        let thumbsUp = 0;
        let thumbsDown = 0;
        if (feedbackRes.ok) {
          const data = await feedbackRes.json();
          const items = data.feedback ?? [];
          thumbsUp = items.filter((f: { type: string }) => f.type === "thumbs_up").length;
          thumbsDown = items.filter((f: { type: string }) => f.type === "thumbs_down").length;
        }

        setMetrics({
          executions: totalExec,
          accuracy: totalExec > 0 ? ((totalExec - totalCorrections) / totalExec) * 100 : 0,
          costUsd: totalCost,
          timeSavedMin: totalTimeSaved,
          thumbsUp,
          thumbsDown,
        });
      } catch (err) {
        console.error("Failed to load agent info:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isOpen, agentId]);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-full w-80 bg-card border-l border-border shadow-lg z-40 flex flex-col",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-blue-500" />
          <h3 className="font-semibold text-sm">AI-агент</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : agent ? (
          <>
            {/* Agent identity */}
            <div className="text-center">
              <div className="inline-flex h-14 w-14 rounded-full bg-blue-500/10 items-center justify-center mb-2">
                <Bot className="h-7 w-7 text-blue-500" />
              </div>
              <h4 className="font-semibold">{agent.name}</h4>
              <span className={`text-xs px-2 py-0.5 rounded ${statusColor(agent.status)}`}>
                {STATUS_LABELS[agent.status] ?? agent.status}
              </span>
              {agent.description && (
                <p className="text-xs text-muted-foreground mt-2">
                  {agent.description}
                </p>
              )}
            </div>

            {/* Details */}
            <div className="space-y-2">
              <DetailRow label="Модель" value={agent.model} />
              <DetailRow
                label="Создан"
                value={new Date(agent.created_at).toLocaleDateString("ru-RU")}
              />
              <DetailRow
                label="Чатов"
                value={String(agent.assigned_chats?.length ?? 0)}
              />
            </div>

            {/* Metrics */}
            {metrics && (
              <div className="space-y-3 pt-3 border-t border-border">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Метрики
                </h5>
                <div className="grid grid-cols-2 gap-2">
                  <MetricItem
                    icon={<Zap className="h-3.5 w-3.5 text-amber-500" />}
                    label="Выполнений"
                    value={String(metrics.executions)}
                  />
                  <MetricItem
                    icon={<Shield className="h-3.5 w-3.5 text-blue-500" />}
                    label="Точность"
                    value={`${metrics.accuracy.toFixed(0)}%`}
                  />
                  <MetricItem
                    icon={<DollarSign className="h-3.5 w-3.5 text-green-500" />}
                    label="Расходы"
                    value={`$${metrics.costUsd.toFixed(2)}`}
                  />
                  <MetricItem
                    icon={<Clock className="h-3.5 w-3.5 text-purple-500" />}
                    label="Сэкономлено"
                    value={formatMins(metrics.timeSavedMin)}
                  />
                </div>

                {/* Feedback summary */}
                <div className="flex items-center gap-4 pt-2">
                  <span className="inline-flex items-center gap-1 text-sm text-green-500">
                    <ThumbsUp className="h-3.5 w-3.5" /> {metrics.thumbsUp}
                  </span>
                  <span className="inline-flex items-center gap-1 text-sm text-red-500">
                    <ThumbsDown className="h-3.5 w-3.5" /> {metrics.thumbsDown}
                  </span>
                </div>
              </div>
            )}

            {/* Admin link */}
            <div className="pt-3 border-t border-border">
              <a
                href={`/admin/governance/agents/${agentId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline"
              >
                Открыть в Governance Portal →
              </a>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Агент не найден
          </p>
        )}
      </div>
    </div>
  );
}

/* ---- Helpers ---- */

function statusColor(status: string): string {
  const map: Record<string, string> = {
    active: "bg-green-500/10 text-green-400",
    canary: "bg-amber-500/10 text-amber-400",
    shadow: "bg-blue-500/10 text-blue-400",
    testing: "bg-purple-500/10 text-purple-400",
    draft: "bg-gray-500/10 text-gray-400",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-xs">{value}</span>
    </div>
  );
}

function MetricItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 p-2 rounded bg-muted/50">
      {icon}
      <div>
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-xs font-semibold">{value}</p>
      </div>
    </div>
  );
}

function formatMins(mins: number): string {
  if (mins >= 60) return `${(mins / 60).toFixed(1)}ч`;
  return `${mins}мин`;
}
