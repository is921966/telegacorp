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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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
      await fetchPatterns();
    } catch (err) {
      console.error(`Failed to ${action} pattern:`, err);
      setError(`Не удалось ${action === "approved" ? "одобрить" : "отклонить"} паттерн`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
          Паттерны автоматизации
        </h2>
        <p className="text-sm text-muted-foreground">
          Обнаруженные Conversation Intelligence паттерны ручного труда
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTER_OPTIONS.map((s) => (
          <Badge
            key={s}
            variant={statusFilter === s ? "default" : "secondary"}
            className="cursor-pointer text-xs px-2.5 py-1"
            onClick={() => setStatusFilter(s)}
          >
            {s === "all" ? "Все" : STATUS_LABELS[s] ?? s}
          </Badge>
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
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <Brain className="h-8 w-8 mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Паттерны пока не обнаружены</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Conversation Intelligence Layer начнёт выявлять паттерны после запуска VPS
            </p>
          </CardContent>
        </Card>
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
    <Card className="py-0 overflow-hidden">
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
          <p className="text-sm font-medium line-clamp-2 sm:truncate">{pattern.description}</p>
          <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
            <PatternStatusBadge status={pattern.status} />
            {pattern.confidence !== null && (
              <span className="text-xs text-muted-foreground">
                {(pattern.confidence * 100).toFixed(0)}%
              </span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
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
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
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
                : "\u2014"}
            </p>
          )}

          {/* Actions */}
          {canReview && (
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                size="sm"
                onClick={onApprove}
                disabled={isActionLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isActionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Одобрить
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onReject}
                disabled={isActionLoading}
              >
                {isActionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                )}
                Отклонить
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ---- Helpers ---- */

function PatternStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    new: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    proposed: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    approved: "bg-green-500/10 text-green-400 border-green-500/30",
    automated: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[status] ?? ""}`}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
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
