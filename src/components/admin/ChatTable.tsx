"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users, Shield, ShieldAlert, Hash, Megaphone, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ManagedChatInfo } from "@/types/admin";

export function ChatTable() {
  const [chats, setChats] = useState<ManagedChatInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleWorkspace = async (chatId: string, hasTemplate: boolean) => {
    setTogglingId(chatId);
    try {
      const method = hasTemplate ? "DELETE" : "PUT";
      const res = await fetch(`/api/admin/chats/${chatId}/workspace`, { method });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Update local state
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                templateId: hasTemplate ? null : "default",
                isCompliant: true,
              }
            : c
        )
      );
      toast.success(hasTemplate ? "Убран из рабочей области" : "Добавлен в рабочую область");
    } catch (err) {
      console.error("Failed to toggle workspace:", err);
      toast.error("Не удалось изменить рабочую область");
    } finally {
      setTogglingId(null);
    }
  };

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
      <Card>
        <CardContent className="flex flex-col items-center py-8">
          <Users className="h-8 w-8 mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Нет управляемых чатов</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Бот не добавлен как администратор ни в один чат
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile: Card list */}
      <div className="space-y-3 md:hidden">
        {chats.map((chat) => (
          <Card key={chat.id} className="py-0">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/admin/chats/${chat.id}`}
                      className="font-medium text-sm text-blue-400 hover:underline"
                    >
                      {chat.title}
                    </Link>
                    {chat.isCompliant ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-400 border-green-500/30">
                        <Shield className="h-2.5 w-2.5 mr-0.5" />
                        OK
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-400 border-amber-500/30">
                        <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
                        Drift
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      {chat.type === "channel" ? (
                        <Megaphone className="h-3 w-3" />
                      ) : (
                        <Hash className="h-3 w-3" />
                      )}
                      {chat.type === "supergroup" ? "Группа" : "Канал"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {chat.participantCount.toLocaleString()}
                    </span>
                    <button
                      onClick={() => toggleWorkspace(chat.id, !!chat.templateId)}
                      disabled={togglingId === chat.id}
                      className="inline-flex items-center"
                    >
                      {togglingId === chat.id ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : (
                        <Badge
                          variant="outline"
                          className={
                            chat.templateId
                              ? "text-[10px] px-1.5 py-0 text-green-400 border-green-500/30 cursor-pointer hover:border-green-400/60"
                              : "text-[10px] px-1.5 py-0 text-muted-foreground border-border cursor-pointer hover:border-muted-foreground/60"
                          }
                        >
                          <Building2 className="h-2.5 w-2.5 mr-0.5" />
                          {chat.templateId ? "Рабочая" : "Не рабочая"}
                        </Badge>
                      )}
                    </button>
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
              <TableHead>Чат</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead className="text-right">Участники</TableHead>
              <TableHead>Рабочая</TableHead>
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
                  <button
                    onClick={() => toggleWorkspace(chat.id, !!chat.templateId)}
                    disabled={togglingId === chat.id}
                  >
                    {togglingId === chat.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Badge
                        variant="outline"
                        className={
                          chat.templateId
                            ? "text-xs text-green-400 border-green-500/30 cursor-pointer hover:border-green-400/60"
                            : "text-xs text-muted-foreground border-border cursor-pointer hover:border-muted-foreground/60"
                        }
                      >
                        <Building2 className="h-3 w-3 mr-1" />
                        {chat.templateId ? "Да" : "Нет"}
                      </Badge>
                    )}
                  </button>
                </TableCell>
                <TableCell>
                  {chat.templateId ? (
                    <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                      Назначен
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">&mdash;</span>
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
    </>
  );
}
