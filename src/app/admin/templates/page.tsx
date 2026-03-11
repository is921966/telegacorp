"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PolicyTemplate } from "@/types/admin";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<PolicyTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/templates");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setTemplates(data.templates);
      } catch (err) {
        console.error("Failed to load templates:", err);
        setError("Не удалось загрузить шаблоны");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Шаблоны политик
          </h2>
          <p className="text-sm text-muted-foreground">
            Конфигурации настроек для корпоративных чатов
          </p>
        </div>
        <Button asChild size="sm" className="w-fit">
          <Link href="/admin/templates/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Создать шаблон
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <FileText className="h-8 w-8 mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Нет шаблонов</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Создайте первый шаблон для стандартизации настроек чатов
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Card list */}
          <div className="space-y-3 md:hidden">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="py-0">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/admin/templates/${tpl.id}`}
                          className="font-medium text-sm text-blue-400 hover:underline"
                        >
                          {tpl.name}
                        </Link>
                        {tpl.is_active ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-400 border-green-500/30">
                            <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                            Активен
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border">
                            <XCircle className="h-2.5 w-2.5 mr-0.5" />
                            Неактивен
                          </Badge>
                        )}
                      </div>
                      {tpl.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {tpl.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">v{tpl.version}</span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="h-3 w-3" />
                          {new Date(tpl.created_at).toLocaleDateString("ru-RU")}
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
                  <TableHead>Название</TableHead>
                  <TableHead>Описание</TableHead>
                  <TableHead>Версия</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Создан</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl) => (
                  <TableRow key={tpl.id}>
                    <TableCell>
                      <Link
                        href={`/admin/templates/${tpl.id}`}
                        className="font-medium text-blue-400 hover:underline"
                      >
                        {tpl.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[300px] truncate">
                      {tpl.description || "\u2014"}
                    </TableCell>
                    <TableCell className="tabular-nums">v{tpl.version}</TableCell>
                    <TableCell>
                      {tpl.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle className="h-3.5 w-3.5" /> Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <XCircle className="h-3.5 w-3.5" /> Неактивен
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground tabular-nums">
                      {new Date(tpl.created_at).toLocaleDateString("ru-RU")}
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
