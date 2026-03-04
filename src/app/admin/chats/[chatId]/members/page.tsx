"use client";

import { useEffect, useState, useCallback } from "react";
import { use } from "react";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Crown,
  ShieldCheck,
  Ban,
  UserX,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChatParticipantInfo } from "@/types/admin";

type FilterType = "all" | "admins" | "banned" | "kicked";

export default function MembersPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const [participants, setParticipants] = useState<ChatParticipantInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterType>("all");
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = 50;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/admin/chats/${chatId}/participants?filter=${filter}&offset=${offset}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setParticipants(data.participants);
      setTotal(data.total);
    } catch (err) {
      console.error("Failed to load participants:", err);
      setError("Не удалось загрузить участников");
    } finally {
      setIsLoading(false);
    }
  }, [chatId, filter, offset]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFilterChange = (f: FilterType) => {
    setFilter(f);
    setOffset(0);
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/chats/${chatId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к чату
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Участники</h2>
        <p className="text-muted-foreground">
          Всего: {total.toLocaleString()}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "admins", "banned", "kicked"] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterChange(f)}
            className={[
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              filter === f
                ? "bg-blue-500/20 text-blue-400"
                : "bg-muted text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            {f === "all" && "Все"}
            {f === "admins" && "Админы"}
            {f === "banned" && "Забанены"}
            {f === "kicked" && "Кикнуты"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : participants.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Нет участников с фильтром «{filter}»
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead>Дата вступления</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {participants.map((p) => (
                  <TableRow key={p.userId}>
                    <TableCell>
                      <span className="font-medium">
                        {[p.firstName, p.lastName].filter(Boolean).join(" ") ||
                          `ID: ${p.userId}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.username ? `@${p.username}` : "—"}
                    </TableCell>
                    <TableCell>
                      {p.isCreator && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                          <Crown className="h-3 w-3" /> Создатель
                        </span>
                      )}
                      {p.isAdmin && !p.isCreator && (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                          <ShieldCheck className="h-3 w-3" /> Админ
                        </span>
                      )}
                      {p.isBanned && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <Ban className="h-3 w-3" /> Забанен
                        </span>
                      )}
                      {!p.isCreator && !p.isAdmin && !p.isBanned && (
                        <span className="text-xs text-muted-foreground">Участник</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {p.joinedDate
                        ? new Date(p.joinedDate).toLocaleDateString("ru-RU")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                className="px-3 py-1.5 rounded-md text-sm bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                ← Назад
              </button>
              <span className="text-sm text-muted-foreground">
                {offset + 1}–{Math.min(offset + limit, total)} из {total}
              </span>
              <button
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
                className="px-3 py-1.5 rounded-md text-sm bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                Далее →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
