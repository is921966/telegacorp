"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AuditEntry {
  id: number;
  admin_user_id: string;
  action_type: string;
  target_chat_id: string | null;
  target_user_id: string | null;
  result_status: string;
  error_message: string | null;
  ip_address: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionType, setActionType] = useState("");
  const [chatId, setChatId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (actionType) params.set("actionType", actionType);
      if (chatId) params.set("chatId", chatId);
      if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
      if (dateTo) params.set("to", new Date(dateTo).toISOString());

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Failed to load audit log:", err);
      setError("Не удалось загрузить журнал аудита");
    } finally {
      setIsLoading(false);
    }
  }, [actionType, chatId, dateFrom, dateTo, page]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchEntries();
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (actionType) params.set("actionType", actionType);
    if (chatId) params.set("chatId", chatId);
    if (dateFrom) params.set("from", new Date(dateFrom).toISOString());
    if (dateTo) params.set("to", new Date(dateTo).toISOString());
    window.open(`/api/admin/audit/export?${params.toString()}`, "_blank");
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Журнал аудита</h2>
          <p className="text-muted-foreground">
            Все действия администраторов
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm transition-colors"
        >
          <Download className="h-4 w-4" />
          Экспорт CSV
        </button>
      </div>

      {/* Filters */}
      <form
        onSubmit={handleSearch}
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Тип действия
            </label>
            <input
              type="text"
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              placeholder="create_template..."
              className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Chat ID
            </label>
            <input
              type="text"
              value={chatId}
              onChange={(e) => setChatId(e.target.value)}
              placeholder="-100..."
              className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              С даты
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              По дату
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 transition-colors"
          >
            <Search className="h-4 w-4" />
            Поиск
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <p className="text-sm">Нет записей</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Дата</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Админ</TableHead>
                <TableHead>Chat ID</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">
                      {entry.action_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {entry.admin_user_id.slice(0, 8)}...
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {entry.target_chat_id ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={entry.result_status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, total)} из {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-green-500/10 text-green-400",
    error: "bg-red-500/10 text-red-400",
    partial: "bg-amber-500/10 text-amber-400",
  };

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
