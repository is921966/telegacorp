"use client";

import { useEffect, useState } from "react";
import {
  Users,
  UserCheck,
  UserPlus,
  Phone,
  AtSign,
  Camera,
  Shield,
  Building2,
  Globe,
  Activity,
  Clock,
  Timer,
  Wifi,
  MessageCircle,
  Briefcase,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface EmployeeStatsData {
  total: number;
  activity: { last24h: number; last7d: number; last30d: number };
  newUsers: { last7d: number; last30d: number };
  profile: { withPhone: number; withUsername: number; withPhoto: number };
  admins: { total: number; byRole: Record<string, number> };
  companies: {
    withCompany: number;
    topDomains: { domain: string; count: number }[];
  };
  sessions: {
    total: number;
    active: number;
    avgDurationMinutes: number;
    longestDurationMinutes: number;
    totalTimeMinutes: number;
  };
  workspaceTime: {
    users: number;
    totalPersonalMinutes: number;
    totalWorkMinutes: number;
    avgPersonalMinutes: number;
    avgWorkMinutes: number;
  };
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Супер-админ",
  chat_manager: "Чат-менеджер",
  viewer: "Наблюдатель",
  agent_manager: "Менеджер агентов",
  compliance_officer: "Комплаенс",
};

export function EmployeeStats() {
  const [data, setData] = useState<EmployeeStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/stats/employees");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (err) {
        console.error("[EmployeeStats]", err);
        setError("Не удалось загрузить статистику сотрудников");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  const pct = (n: number, total: number) =>
    total > 0 ? `${((n / total) * 100).toFixed(0)}%` : "0%";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Сотрудники</h3>
        {!loading && data && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {data.total} чел.
          </Badge>
        )}
      </div>

      {/* Row 1: Activity */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniStat
          icon={<Users className="h-4 w-4 text-blue-500" />}
          label="Всего"
          value={data?.total}
          loading={loading}
        />
        <MiniStat
          icon={<Activity className="h-4 w-4 text-green-500" />}
          label="Онлайн 24ч"
          value={data?.activity.last24h}
          sub={data ? pct(data.activity.last24h, data.total) : undefined}
          loading={loading}
        />
        <MiniStat
          icon={<UserCheck className="h-4 w-4 text-emerald-500" />}
          label="Активны 7д"
          value={data?.activity.last7d}
          sub={data ? pct(data.activity.last7d, data.total) : undefined}
          loading={loading}
        />
        <MiniStat
          icon={<UserCheck className="h-4 w-4 text-teal-500" />}
          label="Активны 30д"
          value={data?.activity.last30d}
          sub={data ? pct(data.activity.last30d, data.total) : undefined}
          loading={loading}
        />
      </div>

      {/* Row 2: Sessions / Time in app */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniStat
          icon={<Wifi className="h-4 w-4 text-green-400" />}
          label="Активных сессий"
          value={data?.sessions.active}
          loading={loading}
        />
        <MiniStat
          icon={<Clock className="h-4 w-4 text-indigo-500" />}
          label="Всего сессий"
          value={data?.sessions.total}
          loading={loading}
        />
        <MiniStat
          icon={<Timer className="h-4 w-4 text-orange-500" />}
          label="Ср. сессия"
          value={data ? undefined : undefined}
          valueStr={data ? formatDuration(data.sessions.avgDurationMinutes) : undefined}
          loading={loading}
        />
        <MiniStat
          icon={<Clock className="h-4 w-4 text-rose-500" />}
          label="Суммарно в приложении"
          value={data ? undefined : undefined}
          valueStr={data ? formatDuration(data.sessions.totalTimeMinutes) : undefined}
          loading={loading}
        />
      </div>

      {/* Row 3: Workspace time (Personal / Work) */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MiniStat
          icon={<MessageCircle className="h-4 w-4 text-blue-400" />}
          label="Личное (всего)"
          valueStr={data ? formatDuration(data.workspaceTime.totalPersonalMinutes) : undefined}
          loading={loading}
        />
        <MiniStat
          icon={<Briefcase className="h-4 w-4 text-teal-500" />}
          label="Рабочее (всего)"
          valueStr={data ? formatDuration(data.workspaceTime.totalWorkMinutes) : undefined}
          loading={loading}
        />
        <MiniStat
          icon={<MessageCircle className="h-4 w-4 text-blue-300" />}
          label="Ср. в Личном"
          valueStr={data ? formatDuration(data.workspaceTime.avgPersonalMinutes) : undefined}
          loading={loading}
        />
        <MiniStat
          icon={<Briefcase className="h-4 w-4 text-teal-400" />}
          label="Ср. в Рабочем"
          valueStr={data ? formatDuration(data.workspaceTime.avgWorkMinutes) : undefined}
          loading={loading}
        />
      </div>

      {/* Row 4: Growth + Profile */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat
          icon={<UserPlus className="h-4 w-4 text-cyan-500" />}
          label="Новых за 7д"
          value={data?.newUsers.last7d}
          loading={loading}
        />
        <MiniStat
          icon={<UserPlus className="h-4 w-4 text-cyan-400" />}
          label="Новых за 30д"
          value={data?.newUsers.last30d}
          loading={loading}
        />
        <MiniStat
          icon={<Phone className="h-4 w-4 text-amber-500" />}
          label="С телефоном"
          value={data?.profile.withPhone}
          sub={data ? pct(data.profile.withPhone, data.total) : undefined}
          loading={loading}
        />
        <MiniStat
          icon={<AtSign className="h-4 w-4 text-purple-500" />}
          label="С username"
          value={data?.profile.withUsername}
          sub={data ? pct(data.profile.withUsername, data.total) : undefined}
          loading={loading}
        />
        <MiniStat
          icon={<Camera className="h-4 w-4 text-pink-500" />}
          label="С фото"
          value={data?.profile.withPhoto}
          sub={data ? pct(data.profile.withPhoto, data.total) : undefined}
          loading={loading}
        />
      </div>

      {/* Row 3: Admins + Companies side by side */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Admin roles */}
        <Card className="py-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Роли</p>
              {!loading && data && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {data.admins.total} админов
                </span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : data && Object.keys(data.admins.byRole).length > 0 ? (
              <div className="space-y-1.5">
                {Object.entries(data.admins.byRole)
                  .sort((a, b) => b[1] - a[1])
                  .map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {ROLE_LABELS[role] ?? role}
                      </span>
                      <span className="font-medium tabular-nums">{count}</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Нет данных</p>
            )}
          </CardContent>
        </Card>

        {/* Companies */}
        <Card className="py-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Компании</p>
              {!loading && data && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {data.companies.withCompany} привязано
                </span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : data && data.companies.topDomains.length > 0 ? (
              <div className="space-y-1.5">
                {data.companies.topDomains.map((d) => (
                  <div key={d.domain} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                      <Globe className="h-3 w-3 shrink-0" />
                      <span className="truncate">{d.domain}</span>
                    </span>
                    <span className="font-medium tabular-nums shrink-0 ml-2">{d.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Нет привязанных компаний</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes >= 1440) {
    const days = minutes / 1440;
    return `${days.toFixed(1)} дн.`;
  }
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${hours.toFixed(1)} ч.`;
  }
  return `${minutes} мин.`;
}

function MiniStat({
  icon,
  label,
  value,
  valueStr,
  sub,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  valueStr?: string;
  sub?: string;
  loading: boolean;
}) {
  return (
    <Card className="py-0">
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          {icon}
          <p className="text-xs text-muted-foreground truncate">{label}</p>
        </div>
        {loading ? (
          <Skeleton className="h-6 w-10" />
        ) : (
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tabular-nums">
              {valueStr ?? (value ?? 0)}
            </span>
            {sub && (
              <span className="text-xs text-muted-foreground">{sub}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
