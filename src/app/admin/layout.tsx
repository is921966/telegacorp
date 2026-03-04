import type { ReactNode } from "react";

/**
 * Admin panel layout — standalone, no TelegramSessionProvider.
 * Supabase auth is validated by middleware before reaching this layout.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Telegram Corp Admin</h1>
          </div>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="/admin" className="hover:text-foreground transition-colors">
              Dashboard
            </a>
            <a href="/admin/chats" className="hover:text-foreground transition-colors">
              Чаты
            </a>
            <a href="/admin/templates" className="hover:text-foreground transition-colors">
              Шаблоны
            </a>
            <a href="/admin/audit" className="hover:text-foreground transition-colors">
              Аудит
            </a>
            <a href="/admin/archive" className="hover:text-foreground transition-colors">
              Архив
            </a>
            <a href="/admin/governance" className="hover:text-foreground transition-colors">
              Governance
            </a>
            <a href="/" className="hover:text-foreground transition-colors">
              ← Клиент
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
