import { DashboardStats } from "@/components/admin/DashboardStats";

/**
 * Admin Dashboard — real-time statistics from Supabase.
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

      <DashboardStats />

      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Фазы 1-11 реализованы: инфраструктура, RBAC, ChatManagement, Agent
          Factory, Governance.
          <br />
          Следующий этап: VPS-компоненты (Message Stream, Conversation
          Intelligence, OpenClaw Gateway).
        </p>
      </div>
    </div>
  );
}
