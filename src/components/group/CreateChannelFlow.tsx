"use client";

import { useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/store/ui";
import { useChatsStore } from "@/store/chats";
import { useCorporateStore } from "@/store/corporate";
import { AvatarPicker } from "@/components/shared/AvatarPicker";
import { Step1SelectMembers } from "./Step1SelectMembers";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { TelegramDialog } from "@/types/telegram";

function Step1ChannelDetails() {
  const createFlow = useUIStore((s) => s.createFlow);
  const closeCreateFlow = useUIStore((s) => s.closeCreateFlow);
  const setCreateFlowStep = useUIStore((s) => s.setCreateFlowStep);
  const setCreateFlowTitle = useUIStore((s) => s.setCreateFlowTitle);
  const setCreateFlowAbout = useUIStore((s) => s.setCreateFlowAbout);
  const setCreateFlowPhoto = useUIStore((s) => s.setCreateFlowPhoto);
  const setCreateFlowWorkspace = useUIStore((s) => s.setCreateFlowWorkspace);
  const inputRef = useRef<HTMLInputElement>(null);

  const title = createFlow?.title || "";
  const about = createFlow?.about || "";
  const photoPreview = createFlow?.photoPreview || null;
  const isWorkspace = createFlow?.isWorkspace ?? true;

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const titleInitials = title.trim()
    ? title
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : "NK";

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={closeCreateFlow}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-base font-semibold">Новый канал</h2>
        </div>
        <Button
          size="sm"
          disabled={!title.trim()}
          onClick={() => setCreateFlowStep(2)}
        >
          Далее
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center gap-4 py-6 px-4">
          <AvatarPicker
            preview={photoPreview}
            fallbackInitials={titleInitials}
            fallbackColor="bg-purple-500"
            size="lg"
            onSelect={(file, preview) => setCreateFlowPhoto(file, preview)}
            onRemove={() => setCreateFlowPhoto(null, null)}
          />

          <Input
            ref={inputRef}
            placeholder="Название канала"
            value={title}
            onChange={(e) => setCreateFlowTitle(e.target.value)}
            maxLength={255}
            className="text-center text-lg h-11"
          />

          <textarea
            placeholder="Описание (необязательно)"
            value={about}
            onChange={(e) => setCreateFlowAbout(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
            rows={3}
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
      </div>
    </div>
  );
}

function Step2ChannelType() {
  const createFlow = useUIStore((s) => s.createFlow);
  const setCreateFlowStep = useUIStore((s) => s.setCreateFlowStep);
  const setCreateFlowPublic = useUIStore((s) => s.setCreateFlowPublic);
  const setCreateFlowLink = useUIStore((s) => s.setCreateFlowLink);

  const isPublic = createFlow?.isPublic || false;
  const publicLink = createFlow?.publicLink || "";

  return (
    <div className="flex flex-col h-full">
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
          <h2 className="text-base font-semibold">Тип канала</h2>
        </div>
        <Button
          size="sm"
          disabled={isPublic && !publicLink.trim()}
          onClick={() => setCreateFlowStep(3)}
        >
          Далее
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Public option */}
        <button
          className={`w-full rounded-lg border p-4 text-left transition-colors ${
            isPublic
              ? "border-blue-500 bg-blue-500/10"
              : "border-border hover:bg-accent/50"
          }`}
          onClick={() => setCreateFlowPublic(true)}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                isPublic ? "border-blue-500" : "border-muted-foreground"
              }`}
            >
              {isPublic && (
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              )}
            </div>
            <div>
              <span className="text-sm font-medium">Публичный</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Любой может найти и подписаться
              </p>
            </div>
          </div>
        </button>

        {/* Public link input */}
        {isPublic && (
          <div className="space-y-2">
            <Label className="text-sm">Ссылка</Label>
            <div className="flex items-center gap-0 rounded-md border border-input">
              <span className="text-sm text-muted-foreground pl-3 shrink-0">
                t.me/
              </span>
              <Input
                value={publicLink}
                onChange={(e) =>
                  setCreateFlowLink(
                    e.target.value.replace(/[^a-zA-Z0-9_]/g, "")
                  )
                }
                placeholder="channelname"
                className="border-0 focus-visible:ring-0 pl-0"
              />
            </div>
          </div>
        )}

        {/* Private option */}
        <button
          className={`w-full rounded-lg border p-4 text-left transition-colors ${
            !isPublic
              ? "border-blue-500 bg-blue-500/10"
              : "border-border hover:bg-accent/50"
          }`}
          onClick={() => setCreateFlowPublic(false)}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                !isPublic ? "border-blue-500" : "border-muted-foreground"
              }`}
            >
              {!isPublic && (
                <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              )}
            </div>
            <div>
              <span className="text-sm font-medium">Приватный</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Доступ только по приглашению
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

function Step3CreateChannel() {
  const createFlow = useUIStore((s) => s.createFlow);
  const setCreateFlowStep = useUIStore((s) => s.setCreateFlowStep);
  const setCreateFlowCreating = useUIStore((s) => s.setCreateFlowCreating);
  const closeCreateFlow = useUIStore((s) => s.closeCreateFlow);
  const selectChat = useUIStore((s) => s.selectChat);
  const loadConfig = useCorporateStore((s) => s.loadConfig);

  const isCreating = createFlow?.isCreating || false;
  const isWorkspace = createFlow?.isWorkspace ?? true;

  const handleCreate = async () => {
    if (!createFlow || isCreating) return;
    setCreateFlowCreating(true);

    try {
      const { getConnectedClient } = await import("@/lib/telegram/client");
      const client = await getConnectedClient();
      if (!client) throw new Error("Нет подключения к Telegram");

      const { createChannel, setChatPhoto, setChannelUsername, inviteToChannel } =
        await import("@/lib/telegram/groups");

      // Create channel
      const channelId = await createChannel(
        client,
        createFlow.title.trim(),
        createFlow.about
      );

      // Set username if public
      if (createFlow.isPublic && createFlow.publicLink.trim()) {
        try {
          await setChannelUsername(
            client,
            channelId,
            createFlow.publicLink.trim()
          );
        } catch (err) {
          console.warn("Failed to set channel username:", err);
          toast.error("Не удалось установить ссылку канала");
        }
      }

      // Upload photo
      if (createFlow.photoFile) {
        try {
          await setChatPhoto(client, channelId, createFlow.photoFile);
        } catch (err) {
          console.warn("Failed to set channel photo:", err);
        }
      }

      // Invite selected subscribers
      if (createFlow.selectedMembers.length > 0) {
        try {
          await inviteToChannel(
            client,
            channelId,
            createFlow.selectedMembers.map((m) => m.id)
          );
        } catch (err) {
          console.warn("Failed to invite subscribers:", err);
        }
      }

      // Workspace: add corporate bot as admin and register in corporate system
      if (isWorkspace) {
        const { promoteBotAdmin } = await import("@/lib/telegram/groups");

        // Add corporate bot and promote to admin
        try {
          const botInfo = await fetch("/api/bot-info").then((r) => r.json());
          if (botInfo.username) {
            await promoteBotAdmin(client, channelId, botInfo.username);
          }
        } catch (err) {
          console.warn("Failed to add corporate bot:", err);
        }

        // Register in corporate system (bind to default template)
        try {
          await fetch("/api/corporate/register-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chatId: channelId }),
          });
        } catch (err) {
          console.warn("Failed to register channel:", err);
        }
      }

      // Add the new channel to dialog store so it renders immediately
      const newDialog: TelegramDialog = {
        id: channelId,
        type: "channel",
        title: createFlow.title.trim(),
        unreadCount: 0,
        unreadMentionsCount: 0,
        isPinned: false,
        folderId: 0,
        apiOrder: 0,
      };
      useChatsStore.getState().syncDialogs([newDialog]);

      // Refresh corporate config so the new channel appears in "work" workspace
      if (isWorkspace) {
        loadConfig();
      }

      toast.success("Канал создан");
      closeCreateFlow();
      selectChat(channelId);
    } catch (err) {
      console.error("Failed to create channel:", err);
      toast.error(
        err instanceof Error ? err.message : "Не удалось создать канал"
      );
    } finally {
      setCreateFlowCreating(false);
    }
  };

  return (
    <Step1SelectMembers
      title="Добавить подписчиков"
      nextLabel={isCreating ? "" : "Создать"}
      skipLabel="Пропустить"
      onBack={() => setCreateFlowStep(2)}
      onNext={handleCreate}
      onSkip={handleCreate}
    />
  );
}

export function CreateChannelFlow() {
  const createFlow = useUIStore((s) => s.createFlow);
  const closeCreateFlow = useUIStore((s) => s.closeCreateFlow);

  if (!createFlow || createFlow.type !== "channel") return null;

  return (
    <Sheet
      open={createFlow.isOpen}
      onOpenChange={(open) => {
        if (!open) closeCreateFlow();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 [&>button]:hidden"
      >
        <VisuallyHidden.Root><SheetTitle>Новый канал</SheetTitle></VisuallyHidden.Root>
        {createFlow.step === 1 && <Step1ChannelDetails />}
        {createFlow.step === 2 && <Step2ChannelType />}
        {createFlow.step === 3 && <Step3CreateChannel />}
      </SheetContent>
    </Sheet>
  );
}
