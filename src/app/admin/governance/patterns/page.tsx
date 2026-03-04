"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  Users,
  ChevronRight,
} from "lucide-react";

interface Pattern {
  id: string;
  description: string;
  frequency: string | null;
  avg_duration_minutes: number | null;
  participants: number[];
  estimated_roi_monthly: number | null;
  confidence: number | null;
  status: string;
  detected_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  new: "Новый",
  proposed: "Предложен",
  approved: "Одобрен",
  automated: "Автоматизирован",
  rejected: "Отклонён",
};

const STATUS_FILTER_OPTIONS = ["all", "new", "proposed", "approved", "automated", "rejected"] as const;

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchPatterns = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/patterns?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPatterns(data.patterns ?? []);
    } catch (err) {
      console.error("Failed to load patterns:", err);
      setError("Не удалось загрузить паттерны");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  const handleAction = async (
    patternId: string,
    action: "approved" | "rejected"
  ) => {
    setActionLoading(patternId);
    try {
      const res = await fetch(`/api/admin/patterns/${patternId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Refresh list
      await fetchPatterns();
    } catch (err) {
      console.error(`Failed to ${action} pattern:`, err);
      setError(`Не удалось ${action === "approved" ? "одобрить" : "отклонить"} паттерн`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Паттерны автоматизации
        </h2>
        <p className="text-muted-foreground">
          Обнаруженные Conversation Intelligence паттерны ручного труда
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTER_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s === "all" ? "Все" : STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : patterns.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Паттерны пока не обнаружены</p>
          <p className="text-xs mt-1">
            Conversation Intelligence Layer начнёт выявлять паттерны после запуска VPS
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              isExpanded={expandedId === pattern.id}
              onToggle={() =>
                setExpandedId(expandedId === pattern.id ? null : pattern.id)
              }
              onApprove={() => handleAction(pattern.id, "approved")}
              onReject={() => handleAction(pattern.id, "rejected")}
              isActionLoading={actionLoading === pattern.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Pattern card ---- */

function PatternCard({
  pattern,
  isExpanded,
  onToggle,
  onApprove,
  onReject,
  isActionLoading,
}: {
  pattern: Pattern;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  isActionLoading: boolean;
}) {
  const canReview = ["new", "proposed"].includes(pattern.status);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
            isExpanded ? "rotate-90" : ""
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{pattern.description}</p>
          <div className="flex items-center gap-3 mt-1">
            <PatternStatusBadge status={pattern.status} />
            {pattern.confidence !== null && (
              <span className="text-xs text-muted-foreground">
                {(pattern.confidence * 100).toFixed(0)}% уверенность
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(pattern.detected_at).toLocaleDateString("ru-RU")}
            </span>
          </div>
        </div>
        {pattern.estimated_roi_monthly !== null && (
          <div className="text-right shrink-0">
            <p className="text-sm font-semibold text-green-500">
              +${pattern.estimated_roi_monthly.toFixed(0)}/мес
            </p>
            <p className="text-xs text-muted-foreground">ROI</p>
          </div>
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-4 space-y-3 bg-muted/10">
          <div className="grid gap-3 sm:grid-cols-3">
            {pattern.frequency && (
              <DetailItem
                icon={<Clock className="h-4 w-4" />}
                label="Частота"
                value={pattern.frequency}
              />
            )}
            {pattern.avg_duration_minutes !== null && (
              <DetailItem
                icon={<Clock className="h-4 w-4" />}
                label="Ср. длительность"
                value={`${pattern.avg_duration_minutes} мин.`}
              />
            )}
            {pattern.participants.length > 0 && (
              <DetailItem
                icon={<Users className="h-4 w-4" />}
                label="Участников"
                value={String(pattern.participants.length)}
              />
            )}
            {pattern.estimated_roi_monthly !== null && (
              <DetailItem
                icon={<DollarSign className="h-4 w-4" />}
                label="ROI / мес"
                value={`$${pattern.estimated_roi_monthly.toFixed(2)}`}
              />
            )}
          </div>

          {pattern.reviewed_by && (
            <p className="text-xs text-muted-foreground">
              Рецензент: {pattern.reviewed_by.slice(0, 8)}... ·{" "}
              {pattern.reviewed_at
                ? new Date(pattern.reviewed_at).toLocaleString("ru-RU")
                : "—"}
            </p>
          )}

          {/* Actions */}
          {canReview && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <button
                onClick={onApprove}
                disabled={isActionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-green-600 text-white text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isActionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Одобрить
              </button>
              <button
                onClick={onReject}
                disabled={isActionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-red-600 text-white text-sm hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isActionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Отклонить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Helpers ---- */

function PatternStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-cyan-500/10 text-cyan-400",
    proposed: "bg-blue-500/10 text-blue-400",
    approved: "bg-green-500/10 text-green-400",
    automated: "bg-purple-500/10 text-purple-400",
    rejected: "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
