"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Activity,
  User,
  MessageSquare,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AuditEntry {
  id: number;
  admin_telegram_id: string;
  action_type: string;
  target_chat_id: string | null;
  target_user_id: string | null;
  result_status: string;
  error_message: string | null;
  ip_address: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Журнал аудита</h2>
          <p className="text-sm text-muted-foreground">
            Все действия администраторов
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="w-fit">
          <Download className="h-4 w-4 mr-2" />
          Экспорт CSV
        </Button>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch}>
        <Card className="py-0">
          <CardContent className="p-4">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Тип действия
                </label>
                <Input
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  placeholder="create_template..."
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Chat ID
                </label>
                <Input
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="-100..."
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  С даты
                </label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  По дату
                </label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm">
                <Search className="h-4 w-4 mr-1.5" />
                Поиск
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <Activity className="h-8 w-8 mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Нет записей</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Card list */}
          <div className="space-y-3 md:hidden">
            {entries.map((entry) => (
              <Card key={entry.id} className="py-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-medium">
                          {entry.action_type}
                        </span>
                        <StatusBadge status={entry.result_status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {entry.admin_telegram_id.slice(0, 8)}...
                        </span>
                        {entry.target_chat_id && (
                          <span className="inline-flex items-center gap-1 font-mono">
                            <MessageSquare className="h-3 w-3" />
                            {entry.target_chat_id}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" />
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: Table */}
          <div className="hidden md:block rounded-lg border border-border bg-card">
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
                      {formatDate(entry.created_at)}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm">
                        {entry.action_type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {entry.admin_telegram_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">
                      {entry.target_chat_id ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={entry.result_status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground">
                {page * PAGE_SIZE + 1}&ndash;{Math.min((page + 1) * PAGE_SIZE, total)} из {total}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums px-2">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    success: "bg-green-500/10 text-green-400 border-green-500/30",
    error: "bg-red-500/10 text-red-400 border-red-500/30",
    partial: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  };

  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[status] ?? ""}`}>
      {status}
    </Badge>
  );
}
