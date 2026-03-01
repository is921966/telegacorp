"use client";

import { useUIStore } from "@/store/ui";
import { useChatsStore } from "@/store/chats";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X } from "lucide-react";

export function GroupInfo() {
  const { isGroupInfoOpen, selectedChatId, toggleGroupInfo } = useUIStore();
  const { dialogs } = useChatsStore();

  const dialog = dialogs.find((d) => d.id === selectedChatId);
  if (!dialog || dialog.type !== "group") return null;

  const initials = dialog.title
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <Sheet open={isGroupInfoOpen} onOpenChange={toggleGroupInfo}>
      <SheetContent className="w-80 p-0">
        <SheetHeader className="p-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Group Info</SheetTitle>
            <Button variant="ghost" size="icon" onClick={toggleGroupInfo}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-64px)]">
          <div className="flex flex-col items-center px-4 pb-4">
            <Avatar className="h-20 w-20 mb-3">
              <AvatarFallback className="text-2xl bg-blue-500 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-lg font-semibold">{dialog.title}</h3>
            <p className="text-sm text-muted-foreground">Group</p>
          </div>
          <Separator />
          <div className="p-4">
            <h4 className="text-sm font-medium mb-3">Members</h4>
            <p className="text-sm text-muted-foreground">
              Member list loads when connected to Telegram
            </p>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
