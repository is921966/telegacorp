"use client";

import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useChatsStore } from "@/store/chats";
import { useCorporateStore } from "@/store/corporate";
import { useLazyAvatar } from "@/hooks/useLazyAvatar";
import { AvatarPicker } from "@/components/shared/AvatarPicker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TelegramContact, TelegramDialog } from "@/types/telegram";

const avatarColors = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500",
  "bg-teal-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500",
];

function getAvatarColor(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function getInitials(firstName: string, lastName?: string): string {
  const f = firstName?.[0] || "";
  const l = lastName?.[0] || "";
  return (f + l).toUpperCase() || "?";
}

function MemberAvatar({ contact }: { contact: TelegramContact }) {
  const { ref: avatarRef, avatarUrl } = useLazyAvatar(contact.id);

  return (
    <div ref={avatarRef} className="flex flex-col items-center gap-1 w-16">
      <Avatar className="h-10 w-10">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={contact.firstName} />}
        <AvatarFallback
          className={cn(
            "text-white text-sm font-medium",
            getAvatarColor(contact.id)
          )}
        >
          {getInitials(contact.firstName, contact.lastName)}
        </AvatarFallback>
      </Avatar>
      <span className="text-[11px] text-muted-foreground truncate w-full text-center">
        {contact.firstName}
      </span>
    </div>
  );
}

export function Step2GroupDetails() {
  const createFlow = useUIStore((s) => s.createFlow);
  const setCreateFlowStep = useUIStore((s) => s.setCreateFlowStep);
  const setCreateFlowTitle = useUIStore((s) => s.setCreateFlowTitle);
  const setCreateFlowPhoto = useUIStore((s) => s.setCreateFlowPhoto);
  const setCreateFlowCreating = useUIStore((s) => s.setCreateFlowCreating);
  const setCreateFlowWorkspace = useUIStore((s) => s.setCreateFlowWorkspace);
  const closeCreateFlow = useUIStore((s) => s.closeCreateFlow);
  const selectChat = useUIStore((s) => s.selectChat);
  const loadConfig = useCorporateStore((s) => s.loadConfig);
  const inputRef = useRef<HTMLInputElement>(null);

  const title = createFlow?.title || "";
  const photoPreview = createFlow?.photoPreview || null;
  const selectedMembers = createFlow?.selectedMembers || [];
  const isCreating = createFlow?.isCreating || false;
  const isWorkspace = createFlow?.isWorkspace ?? true;

  // Auto-focus the title input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || isCreating) return;
    setCreateFlowCreating(true);

    try {
      const { getConnectedClient } = await import("@/lib/telegram/client");
      const client = await getConnectedClient();
      if (!client) throw new Error("Нет подключения к Telegram");

      let chatId: string;
      const userIds = selectedMembers.map((m) => m.id);

      if (isWorkspace) {
        // Work group: create supergroup (supports all corporate features)
        const { createSupergroup, inviteToChannel, setChatPhoto, promoteBotAdmin } =
          await import("@/lib/telegram/groups");

        chatId = await createSupergroup(client, title.trim(), "");

        // Invite selected members
        if (userIds.length > 0) {
          try {
            await inviteToChannel(client, chatId, userIds);
          } catch (err) {
            console.warn("Failed to invite some members:", err);
          }
        }

        // Upload photo if selected
        if (createFlow?.photoFile) {
          try {
            await setChatPhoto(client, chatId, createFlow.photoFile);
          } catch (err) {
            console.warn("Failed to set group photo:", err);
          }
        }

        // Add corporate bot and promote to admin
        try {
          const botInfo = await fetch("/api/bot-info").then((r) => r.json());
          if (botInfo.username) {
            await promoteBotAdmin(client, chatId, botInfo.username);
          }
        } catch (err) {
          console.warn("Failed to add corporate bot:", err);
        }

        // Register in corporate system (bind to default template)
        try {
          await fetch("/api/corporate/register-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId }),
          });
        } catch (err) {
          console.warn("Failed to register chat:", err);
        }

        // Add the new chat to dialog store
        const newDialog: TelegramDialog = {
          id: chatId,
          type: "group",
          title: title.trim(),
          unreadCount: 0,
          unreadMentionsCount: 0,
          isPinned: false,
          folderId: 0,
          apiOrder: 0,
        };
        useChatsStore.getState().syncDialogs([newDialog]);

        // Refresh corporate config so the new chat appears in "work" workspace
        loadConfig();
      } else {
        // Personal group: regular group creation
        const { createGroup, setChatPhoto } = await import(
          "@/lib/telegram/groups"
        );

        chatId = await createGroup(client, title.trim(), userIds);

        // Upload photo if selected
        if (createFlow?.photoFile) {
          try {
            await setChatPhoto(client, chatId, createFlow.photoFile);
          } catch (err) {
            console.warn("Failed to set group photo:", err);
          }
        }

        // Add the new chat to dialog store
        const newDialog: TelegramDialog = {
          id: chatId,
          type: "group",
          title: title.trim(),
          unreadCount: 0,
          unreadMentionsCount: 0,
          isPinned: false,
          folderId: 0,
          apiOrder: 0,
        };
        useChatsStore.getState().syncDialogs([newDialog]);
      }

      toast.success("Группа создана");
      closeCreateFlow();
      selectChat(chatId);
    } catch (err) {
      console.error("Failed to create group:", err);
      toast.error(
        err instanceof Error ? err.message : "Не удалось создать группу"
      );
    } finally {
      setCreateFlowCreating(false);
    }
  };

  const titleInitials = title.trim()
    ? title
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "NG";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setCreateFlowStep(1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-base font-semibold">Новая группа</h2>
        </div>
        <Button
          size="sm"
          disabled={!title.trim() || isCreating}
          onClick={handleCreate}
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Создать"
          )}
        </Button>
      </div>

      {/* Group details */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-4 py-6 px-4">
          <AvatarPicker
            preview={photoPreview}
            fallbackInitials={titleInitials}
            fallbackColor="bg-blue-500"
            size="lg"
            onSelect={(file, preview) => setCreateFlowPhoto(file, preview)}
            onRemove={() => setCreateFlowPhoto(null, null)}
          />

          <Input
            ref={inputRef}
            placeholder="Название группы"
            value={title}
            onChange={(e) => setCreateFlowTitle(e.target.value)}
            maxLength={255}
            className="text-center text-lg h-11"
          />

          {/* Workspace toggle */}
          <div
            className="flex items-center gap-3 w-full cursor-pointer select-none"
            onClick={() => setCreateFlowWorkspace(!isWorkspace)}
          >
            <Checkbox
              checked={isWorkspace}
              onCheckedChange={(checked) => setCreateFlowWorkspace(!!checked)}
            />
            <span className="text-sm text-foreground">
              Рабочая область
            </span>
          </div>
        </div>

        {/* Selected members preview */}
        {selectedMembers.length > 0 && (
          <div className="px-4 pb-4">
            <div className="text-sm text-muted-foreground mb-3">
              {selectedMembers.length}{" "}
              {selectedMembers.length === 1
                ? "участник"
                : selectedMembers.length < 5
                  ? "участника"
                  : "участников"}
            </div>
            <div className="flex flex-wrap gap-3">
              {selectedMembers.map((m) => (
                <MemberAvatar key={m.id} contact={m} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
