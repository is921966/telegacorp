"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Shield,
  ChevronRight,
  ChevronLeft,
  Search,
  Bot,
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

interface AuditEntry {
  id: number;
  agent_id: string | null;
  action: string;
  chat_id: number | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface AgentInfo {
  id: string;
  name: string;
  status: string;
}

const PAGE_SIZE = 50;

export default function AgentAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("all");
  const [page, setPage] = useState(0);

  // Load agents for filter dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents ?? []);
        }
      } catch {
        // Non-critical
      }
    })();
  }, []);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (selectedAgentId === "all") {
        // Fetch audit from all agents — aggregate from each agent's audit endpoint
        // For simplicity, use the first few agents or a dedicated endpoint
        // For now, if we have agents, fetch from the first agent
        // TODO: Add a dedicated /api/admin/governance/audit endpoint that returns all agent audit logs
        const allEntries: AuditEntry[] = [];
        const agentsToFetch = agents.slice(0, 10); // Limit to prevent too many requests

        await Promise.all(
          agentsToFetch.map(async (agent) => {
            try {
              const res = await fetch(
                `/api/admin/agents/${agent.id}/audit?limit=50`
              );
              if (res.ok) {
                const data = await res.json();
                allEntries.push(...(data.entries ?? []));
              }
            } catch {
              // Skip failed agent
            }
          })
        );

        // Sort by date descending
        allEntries.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setEntries(allEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE));
      } else {
        const res = await fetch(
          `/api/admin/agents/${selectedAgentId}/audit?limit=${PAGE_SIZE}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEntries(data.entries ?? []);
      }
    } catch (err) {
      console.error("Failed to load agent audit log:", err);
      setError("Не удалось загрузить журнал");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAgentId, agents, page]);

  useEffect(() => {
    if (agents.length > 0 || selectedAgentId !== "all") {
      fetchEntries();
    } else {
      setIsLoading(false);
    }
  }, [fetchEntries, agents.length, selectedAgentId]);

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return "—";
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name ?? agentId.slice(0, 8) + "...";
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/admin/governance"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Governance
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Аудит агентов</span>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Журнал действий агентов
        </h2>
        <p className="text-muted-foreground text-sm">
          Все действия, выполненные AI-агентами в корпоративных чатах
        </p>
      </div>

      {/* Agent filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Агент:</label>
        <select
          value={selectedAgentId}
          onChange={(e) => {
            setSelectedAgentId(e.target.value);
            setPage(0);
          }}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-sm"
        >
          <option value="all">Все агенты</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name} ({agent.status})
            </option>
          ))}
        </select>
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
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <Shield className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Действий агентов пока нет</p>
          <p className="text-xs mt-1">
            Записи появятся после начала работы агентов
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">Дата</TableHead>
                <TableHead>Агент</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Chat ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={`${entry.id}-${entry.agent_id}`}>
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
                    <div className="flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-sm">{getAgentName(entry.agent_id)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm">{entry.action}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {entry.chat_id ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
