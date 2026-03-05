"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
  managedChats: number;
  activeTemplates: number;
  admins: number;
  actionsLast24h: number;
  activeAgents: number;
  newPatterns: number;
}

function StatCard({
  title,
  value,
  loading,
  accent,
}: {
  title: string;
  value: string | number;
  loading: boolean;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      {loading ? (
        <Skeleton className="h-8 w-16 mt-1" />
      ) : (
        <p className={`text-2xl font-bold mt-1 ${accent ? "text-primary" : ""}`}>
          {value}
        </p>
      )}
    </div>
  );
}

export function DashboardStats() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/admin/stats");
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("[Dashboard] Failed to load stats:", err);
        setError("Не удалось загрузить статистику");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Управляемых чатов"
          value={data?.managedChats ?? 0}
          loading={loading}
        />
        <StatCard
          title="Активных шаблонов"
          value={data?.activeTemplates ?? 0}
          loading={loading}
        />
        <StatCard
          title="Администраторов"
          value={data?.admins ?? 0}
          loading={loading}
        />
        <StatCard
          title="Действий за 24ч"
          value={data?.actionsLast24h ?? 0}
          loading={loading}
        />
        <StatCard
          title="Активных агентов"
          value={data?.activeAgents ?? 0}
          loading={loading}
          accent
        />
        <StatCard
          title="Новых паттернов"
          value={data?.newPatterns ?? 0}
          loading={loading}
          accent
        />
      </div>
    </>
  );
}
