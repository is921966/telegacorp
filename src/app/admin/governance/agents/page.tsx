"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Bot,
  ChevronRight,
  Search,
} from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface AgentRow {
  id: string;
  name: string;
  description: string | null;
  status: string;
  model: string;
  assigned_chats: number[];
  created_at: string;
  approved_at: string | null;
  retired_at: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  proposed: "Предложен",
  approved: "Одобрен",
  testing: "Тестирование",
  shadow: "Shadow",
  canary: "Canary",
  active: "Активен",
  deprecated: "Устаревший",
  retired: "Выведен",
};

const STATUS_FILTERS = [
  "all",
  "active",
  "canary",
  "shadow",
  "testing",
  "draft",
  "proposed",
  "deprecated",
  "retired",
] as const;

export default function AgentsListPage() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchAgents = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/agents?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAgents(data.agents ?? []);
    } catch (err) {
      console.error("Failed to load agents:", err);
      setError("Не удалось загрузить агентов");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const filtered = searchQuery
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : agents;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 mb-1 text-sm">
          <Link
            href="/admin/governance"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Governance
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Агенты</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Управление жизненным циклом AI-агентов
        </p>
      </div>

      {/* Filters + Search */}
      <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((s) => (
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

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по имени..."
            className="pl-9"
          />
        </div>
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
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <Bot className="h-8 w-8 mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? "Агенты не найдены" : "Агентов пока нет"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Агенты создаются автоматически после одобрения паттернов
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Card list */}
          <div className="space-y-3 md:hidden">
            {filtered.map((agent) => (
              <Card key={agent.id} className="py-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/admin/governance/agents/${agent.id}`}
                          className="text-sm font-medium text-blue-400 hover:underline"
                        >
                          {agent.name}
                        </Link>
                        <AgentStatusBadge status={agent.status} />
                      </div>
                      {agent.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {agent.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{agent.model}</span>
                        <span>{agent.assigned_chats?.length ?? 0} чатов</span>
                        <span className="tabular-nums">
                          {new Date(agent.created_at).toLocaleDateString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                          })}
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
                  <TableHead>Имя</TableHead>
                  <TableHead className="w-[120px]">Статус</TableHead>
                  <TableHead className="w-[100px]">Модель</TableHead>
                  <TableHead className="w-[80px] text-center">Чатов</TableHead>
                  <TableHead className="w-[140px]">Создан</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((agent) => (
                  <TableRow key={agent.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link
                        href={`/admin/governance/agents/${agent.id}`}
                        className="block"
                      >
                        <p className="text-sm font-medium hover:underline">
                          {agent.name}
                        </p>
                        {agent.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {agent.description}
                          </p>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <AgentStatusBadge status={agent.status} />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {agent.model}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm tabular-nums">
                        {agent.assigned_chats?.length ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {new Date(agent.created_at).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function AgentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-500/10 text-gray-400 border-gray-500/30",
    proposed: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    approved: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    testing: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    shadow: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    canary: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    active: "bg-green-500/10 text-green-400 border-green-500/30",
    deprecated: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    retired: "bg-gray-500/10 text-gray-500 border-gray-500/30",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${styles[status] ?? ""}`}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
