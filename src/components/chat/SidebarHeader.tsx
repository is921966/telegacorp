"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/store/ui";
import { Menu, SquarePen, MessageCircle, Users, Megaphone } from "lucide-react";

export function SidebarHeader() {
  const { setCurrentView, toggleSidebar, openCreateGroup, openCreateChannel } =
    useUIStore();

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 md:hidden"
          title="Меню"
          onClick={toggleSidebar}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">Чаты</h1>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Создать"
          >
            <SquarePen className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setCurrentView("contacts")}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Новое сообщение
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openCreateGroup}>
            <Users className="h-4 w-4 mr-2" />
            Новая группа
          </DropdownMenuItem>
          <DropdownMenuItem onClick={openCreateChannel}>
            <Megaphone className="h-4 w-4 mr-2" />
            Новый канал
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
