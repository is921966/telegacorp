/**
 * Admin Dashboard — placeholder page for Phase 1.
 * Will be expanded in later phases with widgets/stats.
 */
export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Корпоративное администрирование Telegram
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Placeholder stat cards */}
        <StatCard title="Управляемых чатов" value="—" />
        <StatCard title="Активных шаблонов" value="—" />
        <StatCard title="Администраторов" value="—" />
        <StatCard title="Действий за 24ч" value="—" />
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Фаза 1 завершена: инфраструктура, RBAC, API-скелеты, серверный GramJS.
          <br />
          Следующий этап: Фаза 2 — ChatManagementService и полноценный UI.
        </p>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
