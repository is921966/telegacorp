"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/employees", label: "Сотрудники" },
  { href: "/admin/chats", label: "Чаты" },
  { href: "/admin/templates", label: "Шаблоны" },
  { href: "/admin/audit", label: "Аудит" },
  { href: "/admin/archive", label: "Архив" },
  { href: "/admin/governance", label: "Governance" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const isActive =
      href === "/admin"
        ? pathname === "/admin"
        : pathname.startsWith(href);
    return `shrink-0 px-2 py-1 rounded-md transition-colors ${
      isActive
        ? "text-foreground bg-muted/60"
        : "hover:text-foreground hover:bg-muted/50"
    }`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Admin header */}
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
          <h1 className="text-base sm:text-lg font-semibold shrink-0">Admin</h1>

          {/* Mobile: hamburger menu */}
          <div className="lg:hidden ml-auto">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64">
                <SheetHeader>
                  <SheetTitle>Admin</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-2">
                  {NAV_ITEMS.map((item) => (
                    <SheetClose asChild key={item.href}>
                      <a
                        href={item.href}
                        className={`px-3 py-2 rounded-md text-sm transition-colors ${
                          (item.href === "/admin"
                            ? pathname === "/admin"
                            : pathname.startsWith(item.href))
                            ? "text-foreground bg-muted font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {item.label}
                      </a>
                    </SheetClose>
                  ))}
                  <div className="border-t border-border my-2" />
                  <SheetClose asChild>
                    <a
                      href="/"
                      className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      ← Клиент
                    </a>
                  </SheetClose>
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop: inline nav */}
          <nav className="hidden lg:flex items-center gap-1 sm:gap-3 text-sm text-muted-foreground">
            {NAV_ITEMS.map((item) => (
              <a key={item.href} href={item.href} className={linkClass(item.href)}>
                {item.label}
              </a>
            ))}
            <a href="/" className="shrink-0 px-2 py-1 rounded-md hover:text-foreground hover:bg-muted/50 transition-colors">
              ← Клиент
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 sm:px-6 py-4 sm:py-6">{children}</main>
    </div>
  );
}
