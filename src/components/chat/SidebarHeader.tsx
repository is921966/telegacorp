"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import { Menu, SquarePen, CheckSquare } from "lucide-react";
import { useRouter } from "next/navigation";

export function SidebarHeader() {
  const router = useRouter();
  const { telegramUser } = useAuthStore();

  const name = telegramUser?.firstName || "User";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b">
      <div className="flex items-center gap-2">
        {/* Hamburger menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Меню"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">Чаты</h1>
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Отметить все как прочитанные"
        >
          <CheckSquare className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Новое сообщение"
        >
          <SquarePen className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
