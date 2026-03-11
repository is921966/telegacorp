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
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <h1 className="text-base sm:text-lg font-semibold shrink-0">Admin</h1>
          <nav className="flex items-center gap-1 sm:gap-3 text-sm text-muted-foreground overflow-x-auto scrollbar-none">
            <a href="/admin" className="shrink-0 px-2 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors">
              Dashboard
            </a>
            <a href="/admin/employees" className="shrink-0 px-2 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors">
              Сотрудники
            </a>
            <a href="/admin/chats" className="shrink-0 px-2 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors">
              Чаты
            </a>
            <a href="/admin/templates" className="shrink-0 px-2 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors">
              Шаблоны
            </a>
            <a href="/admin/audit" className="shrink-0 px-2 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors">
              Аудит
            </a>
            <a href="/admin/archive" className="shrink-0 px-2 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors">
              Архив
            </a>
            <a href="/admin/governance" className="shrink-0 px-2 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors">
              Governance
            </a>
            <a href="/" className="shrink-0 px-2 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors">
              ← Клиент
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 sm:px-6 py-4 sm:py-6">{children}</main>
    </div>
  );
}
