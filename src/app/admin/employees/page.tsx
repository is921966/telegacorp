"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Search,
  Users,
  Shield,
  Building2,
  ChevronLeft,
  ChevronRight,
  Phone,
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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Employee {
  telegram_id: string;
  first_name: string;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  photo_url: string | null;
  last_seen_at: string | null;
  created_at: string;
  role: string | null;
  companies: Array<{ email: string; domain: string; enabled: boolean }>;
}

type FilterType = "all" | "admins" | "with_company";

const PAGE_SIZE = 50;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Супер-админ",
  chat_manager: "Менеджер чатов",
  viewer: "Просмотр",
  agent_manager: "Менеджер агентов",
  compliance_officer: "Комплаенс",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [page, setPage] = useState(0);

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(page * PAGE_SIZE));
      if (search) params.set("search", search);
      if (filter !== "all") params.set("filter", filter);

      const res = await fetch(`/api/admin/employees?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEmployees(data.employees ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error("Failed to load employees:", err);
      setError("Не удалось загрузить список сотрудников");
    } finally {
      setIsLoading(false);
    }
  }, [search, filter, page]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchEmployees();
  };

  const handleFilterChange = (value: string) => {
    setFilter(value as FilterType);
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Сотрудники</h2>
        <p className="text-sm text-muted-foreground">
          Зарегистрированные пользователи Telegram Corp
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, username или телефону..."
            className="pl-9"
          />
        </div>
        <Button type="submit" size="sm" className="shrink-0">
          Найти
        </Button>
      </form>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={handleFilterChange}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="all" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span>Все</span>
          </TabsTrigger>
          <TabsTrigger value="admins" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            <span>Админы</span>
          </TabsTrigger>
          <TabsTrigger value="with_company" className="gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">С компанией</span>
            <span className="xs:hidden">Компания</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
      ) : employees.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8">
            <Users className="h-8 w-8 mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Нет сотрудников</p>
            {search && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Попробуйте изменить поисковый запрос
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Card list */}
          <div className="space-y-3 md:hidden">
            {employees.map((emp) => (
              <Card key={emp.telegram_id} className="py-0">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0">
                      {emp.photo_url ? (
                        <AvatarImage src={emp.photo_url} alt={emp.first_name} />
                      ) : null}
                      <AvatarFallback>
                        {emp.first_name[0]}
                        {emp.last_name?.[0] ?? ""}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {emp.first_name} {emp.last_name ?? ""}
                        </span>
                        {emp.role && (
                          <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                            <Shield className="h-2.5 w-2.5" />
                            {ROLE_LABELS[emp.role] ?? emp.role}
                          </Badge>
                        )}
                      </div>
                      {emp.username && (
                        <p className="text-sm text-muted-foreground">@{emp.username}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                        {emp.phone && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Phone className="h-3 w-3" />
                            +{emp.phone}
                          </span>
                        )}
                        {emp.last_seen_at && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Clock className="h-3 w-3" />
                            {formatDate(emp.last_seen_at)}
                          </span>
                        )}
                      </div>
                      {emp.companies.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {emp.companies
                            .filter((c) => c.enabled)
                            .map((c) => (
                              <Badge key={c.email} variant="outline" className="text-[10px] px-1.5 py-0 text-blue-400 border-blue-500/30">
                                {c.domain}
                              </Badge>
                            ))}
                        </div>
                      )}
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
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Компания</TableHead>
                  <TableHead>Роль</TableHead>
                  <TableHead className="text-right">Последний вход</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.telegram_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {emp.photo_url ? (
                            <AvatarImage src={emp.photo_url} alt={emp.first_name} />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {emp.first_name[0]}
                            {emp.last_name?.[0] ?? ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium text-sm">
                            {emp.first_name} {emp.last_name ?? ""}
                          </span>
                          <p className="text-xs text-muted-foreground/60">
                            ID: {emp.telegram_id}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {emp.username ? (
                        <span className="text-sm text-muted-foreground">
                          @{emp.username}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.phone ? (
                        <span className="text-sm tabular-nums text-muted-foreground">
                          +{emp.phone}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.companies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {emp.companies
                            .filter((c) => c.enabled)
                            .map((c) => (
                              <Badge key={c.email} variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                                {c.domain}
                              </Badge>
                            ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {emp.role ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Shield className="h-3 w-3" />
                          {ROLE_LABELS[emp.role] ?? emp.role}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {emp.last_seen_at ? (
                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {formatDate(emp.last_seen_at)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
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
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} из {total}
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

      {/* Summary */}
      {!isLoading && !error && (
        <p className="text-xs text-muted-foreground/60 text-center">
          Всего: {total}
        </p>
      )}
    </div>
  );
}
