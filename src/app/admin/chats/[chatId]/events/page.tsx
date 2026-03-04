"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Loader2, ArrowLeft, ScrollText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChatEventEntry } from "@/types/admin";

export default function EventLogPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = use(params);
  const [events, setEvents] = useState<ChatEventEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/admin/chats/${chatId}/event-log?limit=100`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEvents(data.events);
      } catch (err) {
        console.error("Failed to load event log:", err);
        setError("Не удалось загрузить журнал событий");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [chatId]);

  return (
    <div className="space-y-6">
      <Link
        href={`/admin/chats/${chatId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Назад к чату
      </Link>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Журнал событий</h2>
        <p className="text-muted-foreground">
          Admin log из Telegram (хранится 48 часов)
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Нет событий за последние 48 часов</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Действие</TableHead>
                <TableHead>Пользователь</TableHead>
                <TableHead>ID события</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event, i) => (
                <TableRow key={event.event_id || i}>
                  <TableCell className="text-sm tabular-nums">
                    {new Date(event.date).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                      {formatAction(event.action ?? "unknown")}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {event.user_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {event.event_id}
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

/** Convert GramJS class name to human-readable action */
function formatAction(className: string): string {
  // e.g., "ChannelAdminLogEventActionEditMessage" → "Edit Message"
  const clean = className
    .replace("ChannelAdminLogEventAction", "")
    .replace(/([A-Z])/g, " $1")
    .trim();
  return clean || className;
}
