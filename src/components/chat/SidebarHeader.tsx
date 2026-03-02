"use client";

import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui";
import { Menu, SquarePen } from "lucide-react";

export function SidebarHeader() {
  const { setCurrentView, toggleSidebar } = useUIStore();

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b">
      <div className="flex items-center gap-2">
        {/* Hamburger menu button */}
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
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        title="Новое сообщение"
        onClick={() => setCurrentView("contacts")}
      >
        <SquarePen className="h-4 w-4" />
      </Button>
    </div>
  );
}
