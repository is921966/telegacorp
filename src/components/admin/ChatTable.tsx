"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users, Shield, ShieldAlert, Hash, Megaphone } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ManagedChatInfo } from "@/types/admin";

export function ChatTable() {
  const [chats, setChats] = useState<ManagedChatInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/chats");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setChats(data.chats);
      } catch (err) {
        console.error("Failed to load chats:", err);
        setError("Не удалось загрузить чаты");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Нет управляемых чатов</p>
        <p className="text-xs mt-1">Бот не добавлен как администратор ни в один чат</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Чат</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead className="text-right">Участники</TableHead>
            <TableHead>Шаблон</TableHead>
            <TableHead>Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {chats.map((chat) => (
            <TableRow key={chat.id}>
              <TableCell>
                <Link
                  href={`/admin/chats/${chat.id}`}
                  className="font-medium text-blue-400 hover:underline"
                >
                  {chat.title}
                </Link>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {chat.type === "channel" ? (
                    <Megaphone className="h-3.5 w-3.5" />
                  ) : (
                    <Hash className="h-3.5 w-3.5" />
                  )}
                  {chat.type === "supergroup" ? "Группа" : "Канал"}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {chat.participantCount.toLocaleString()}
              </TableCell>
              <TableCell>
                {chat.templateId ? (
                  <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">
                    Назначен
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {chat.isCompliant ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-400">
                    <Shield className="h-3.5 w-3.5" />
                    OK
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Drift
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
