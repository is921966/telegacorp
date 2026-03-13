"use client";

import { useState, useEffect, useCallback } from "react";
import { useUIStore } from "@/store/ui";
import { useChatsStore } from "@/store/chats";
import { useCorporateStore } from "@/store/corporate";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AvatarPicker } from "@/components/shared/AvatarPicker";
import { useLazyAvatar } from "@/hooks/useLazyAvatar";
import { useTelegramClient } from "@/hooks/useTelegramClient";
import {
  X,
  Pencil,
  Check,
  Copy,
  Link,
  LogOut,
  UserPlus,
  Loader2,
  MoreVertical,
  Trash2,
  Building2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { TelegramContact } from "@/types/telegram";

const avatarColors = [
  "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-green-500",
  "bg-teal-500", "bg-blue-500", "bg-indigo-500", "bg-purple-500",
];

function getAvatarColor(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
}

function MemberRow({
  member,
  isOwner,
  onRemove,
}: {
  member: TelegramContact;
  isOwner?: boolean;
  onRemove?: () => void;
}) {
  const { ref: avatarRef, avatarUrl } = useLazyAvatar(member.id);

  return (
    <div
      ref={avatarRef}
      className="flex items-center gap-3 px-4 py-[6px] hover:bg-accent/50"
    >
      <Avatar className="h-10 w-10 shrink-0">
        {avatarUrl && <AvatarImage src={avatarUrl} alt={member.firstName} />}
        <AvatarFallback
          className={cn("text-white text-sm font-medium", getAvatarColor(member.id))}
        >
          {getInitials(`${member.firstName} ${member.lastName || ""}`)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-normal">
            {member.firstName} {member.lastName || ""}
          </span>
          {isOwner && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              owner
            </Badge>
          )}
        </div>
        {member.username && (
          <span className="block truncate text-[13px] text-muted-foreground">
            @{member.username}
          </span>
        )}
      </div>
      {onRemove && !isOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function GroupInfo() {
  const {
    isGroupInfoOpen,
    isEditingGroupInfo,
    selectedChatId,
    toggleGroupInfo,
    setEditingGroupInfo,
  } = useUIStore();
  const { dialogs } = useChatsStore();
  const { client } = useTelegramClient();

  const dialog = dialogs.find((d) => d.id === selectedChatId);

  const [members, setMembers] = useState<TelegramContact[]>([]);
  const [totalMembers, setTotalMembers] = useState(0);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [about, setAbout] = useState("");
  const [inviteLink, setInviteLink] = useState<string | undefined>();

  // Edit mode state
  const [editTitle, setEditTitle] = useState("");
  const [editAbout, setEditAboutText] = useState("");
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isTogglingWorkspace, setIsTogglingWorkspace] = useState(false);
  const isManagedChat = useCorporateStore((s) => s.isManagedChat);
  const loadConfig = useCorporateStore((s) => s.loadConfig);

  const [photoUrl, setPhotoUrl] = useState<string | undefined>();

  // Load group data when panel opens
  const loadGroupData = useCallback(async () => {
    if (!client || !selectedChatId || !isGroupInfoOpen) return;
    if (!dialog || (dialog.type !== "group" && dialog.type !== "channel")) return;

    setIsLoadingMembers(true);

    try {
      // Load avatar
      const { getCachedAvatar, downloadAvatar } = await import(
        "@/lib/telegram/photos"
      );
      const cached = getCachedAvatar(selectedChatId);
      if (cached) {
        setPhotoUrl(cached);
      } else {
        const url = await downloadAvatar(client, selectedChatId);
        if (url) setPhotoUrl(url);
      }

      // Load full info (about, invite link)
      const { getChatFullInfo, getParticipants } = await import(
        "@/lib/telegram/groups"
      );

      const fullInfo = await getChatFullInfo(client, selectedChatId);
      setAbout(fullInfo.about);
      setInviteLink(fullInfo.inviteLink);

      // Load participants
      const result = await getParticipants(client, selectedChatId);
      setMembers(result.participants);
      setTotalMembers(result.total);
    } catch (err) {
      console.error("Failed to load group info:", err);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [client, selectedChatId, isGroupInfoOpen, dialog]);

  useEffect(() => {
    loadGroupData();
  }, [loadGroupData]);

  // Reset edit state when entering edit mode
  useEffect(() => {
    if (isEditingGroupInfo && dialog) {
      setEditTitle(dialog.title);
      setEditAboutText(about);
      setEditPhotoFile(null);
      setEditPhotoPreview(null);
    }
  }, [isEditingGroupInfo, dialog, about]);

  // Reset state when panel closes
  useEffect(() => {
    if (!isGroupInfoOpen) {
      setEditingGroupInfo(false);
      setMembers([]);
      setAbout("");
      setInviteLink(undefined);
      setPhotoUrl(undefined);
    }
  }, [isGroupInfoOpen, setEditingGroupInfo]);

  if (!dialog || (dialog.type !== "group" && dialog.type !== "channel")) return null;

  const initials = getInitials(dialog.title);

  const handleSave = async () => {
    if (!client || !selectedChatId || isSaving) return;
    setIsSaving(true);

    try {
      const { editChatTitle, editAbout: editAboutApi, setChatPhoto } =
        await import("@/lib/telegram/groups");

      // Save title if changed
      if (editTitle.trim() && editTitle.trim() !== dialog.title) {
        await editChatTitle(client, selectedChatId, editTitle.trim());
      }

      // Save about if changed
      if (editAbout !== about) {
        await editAboutApi(client, selectedChatId, editAbout);
        setAbout(editAbout);
      }

      // Upload photo if changed
      if (editPhotoFile) {
        await setChatPhoto(client, selectedChatId, editPhotoFile);
        if (editPhotoPreview) setPhotoUrl(editPhotoPreview);
      }

      toast.success("Изменения сохранены");
      setEditingGroupInfo(false);
    } catch (err) {
      console.error("Failed to save group info:", err);
      toast.error(
        err instanceof Error ? err.message : "Не удалось сохранить"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) {
      // Generate a link
      if (!client || !selectedChatId) return;
      try {
        const { getInviteLink } = await import("@/lib/telegram/groups");
        const link = await getInviteLink(client, selectedChatId);
        setInviteLink(link);
        await navigator.clipboard.writeText(link);
        toast.success("Ссылка скопирована");
      } catch (err) {
        console.error("Failed to get invite link:", err);
        toast.error("Не удалось получить ссылку");
      }
    } else {
      await navigator.clipboard.writeText(inviteLink);
      toast.success("Ссылка скопирована");
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!client || !selectedChatId) return;
    try {
      const { removeParticipant } = await import("@/lib/telegram/groups");
      await removeParticipant(client, selectedChatId, userId);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      setTotalMembers((prev) => prev - 1);
      toast.success("Участник удалён");
    } catch (err) {
      console.error("Failed to remove member:", err);
      toast.error("Не удалось удалить участника");
    }
  };

  const isInWorkspace = selectedChatId ? isManagedChat(selectedChatId) : false;
  const isSupergroup = dialog?.type === "channel" || dialog?.type === "group";

  const handleAddToWorkspace = async () => {
    if (!client || !selectedChatId || isTogglingWorkspace) return;
    setIsTogglingWorkspace(true);
    try {
      const { promoteBotAdmin } = await import("@/lib/telegram/groups");
      const botInfo = await fetch("/api/bot-info").then((r) => r.json());
      if (botInfo.username) {
        await promoteBotAdmin(client, selectedChatId, botInfo.username);
      }
      const res = await fetch("/api/corporate/register-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: selectedChatId }),
      });
      if (!res.ok) throw new Error("Failed to register");
      await loadConfig();
      toast.success("Чат добавлен в рабочую область");
    } catch (err) {
      console.error("Failed to add to workspace:", err);
      toast.error("Не удалось добавить в рабочую область");
    } finally {
      setIsTogglingWorkspace(false);
    }
  };

  const handleRemoveFromWorkspace = async () => {
    if (!selectedChatId || isTogglingWorkspace) return;
    setIsTogglingWorkspace(true);
    try {
      const res = await fetch("/api/corporate/register-chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: selectedChatId }),
      });
      if (!res.ok) throw new Error("Failed to unregister");
      await loadConfig();
      toast.success("Чат убран из рабочей области");
    } catch (err) {
      console.error("Failed to remove from workspace:", err);
      toast.error("Не удалось убрать из рабочей области");
    } finally {
      setIsTogglingWorkspace(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!client || !selectedChatId) return;
    try {
      // Leave: delete self from chat
      const { Api } = await import("telegram");
      const { callWithFloodWait } = await import("@/lib/telegram/flood-wait");
      const entity = await client.getEntity(selectedChatId);

      if (entity instanceof Api.Channel) {
        await callWithFloodWait(() =>
          client.invoke(new Api.channels.LeaveChannel({ channel: entity }))
        );
      } else if (entity instanceof Api.Chat) {
        const me = await client.getMe();
        await callWithFloodWait(() =>
          client.invoke(
            new Api.messages.DeleteChatUser({
              chatId: entity.id,
              userId: new Api.InputUserSelf(),
            })
          )
        );
      }

      toast.success("Вы покинули группу");
      toggleGroupInfo();
      useUIStore.getState().selectChat(null);
    } catch (err) {
      console.error("Failed to leave group:", err);
      toast.error("Не удалось покинуть группу");
    }
  };

  return (
    <Sheet open={isGroupInfoOpen} onOpenChange={toggleGroupInfo}>
      <SheetContent className="w-full sm:w-80 p-0 [&>button]:hidden">
        <VisuallyHidden.Root><SheetTitle>Информация о группе</SheetTitle></VisuallyHidden.Root>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleGroupInfo}>
              <X className="h-5 w-5" />
            </Button>
            <h2 className="text-base font-semibold">Информация</h2>
          </div>
          {isEditingGroupInfo ? (
            <Button
              size="sm"
              disabled={isSaving}
              onClick={handleSave}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditingGroupInfo(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-52px)]">
          {/* Avatar + Title */}
          <div className="flex flex-col items-center px-4 py-6">
            {isEditingGroupInfo ? (
              <>
                <AvatarPicker
                  preview={editPhotoPreview || photoUrl || null}
                  fallbackInitials={initials}
                  fallbackColor="bg-blue-500"
                  size="lg"
                  onSelect={(file, preview) => {
                    setEditPhotoFile(file);
                    setEditPhotoPreview(preview);
                  }}
                  onRemove={() => {
                    setEditPhotoFile(null);
                    setEditPhotoPreview(null);
                  }}
                />
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={255}
                  className="mt-4 text-center text-lg h-11"
                  placeholder="Название"
                />
                <textarea
                  value={editAbout}
                  onChange={(e) => setEditAboutText(e.target.value)}
                  className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[60px] focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Описание"
                  rows={3}
                />
              </>
            ) : (
              <>
                <Avatar className="h-20 w-20 mb-3">
                  {photoUrl && (
                    <AvatarImage src={photoUrl} alt={dialog.title} />
                  )}
                  <AvatarFallback className="text-2xl bg-blue-500 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg font-semibold text-center">
                  {dialog.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {totalMembers > 0
                    ? `${totalMembers} участник${totalMembers === 1 ? "" : totalMembers < 5 ? "а" : "ов"}`
                    : dialog.type === "channel"
                      ? "Канал"
                      : "Группа"}
                </p>
              </>
            )}
          </div>

          {/* About section */}
          {about && !isEditingGroupInfo && (
            <>
              <Separator />
              <div className="px-4 py-3">
                <span className="text-xs text-muted-foreground">Описание</span>
                <p className="text-sm mt-1 whitespace-pre-wrap">{about}</p>
              </div>
            </>
          )}

          {/* Invite link */}
          <Separator />
          <button
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
            onClick={handleCopyLink}
          >
            <Link className="h-5 w-5 text-blue-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-blue-500">
                {inviteLink ? "Скопировать ссылку" : "Получить ссылку"}
              </span>
              {inviteLink && (
                <span className="block text-xs text-muted-foreground truncate">
                  {inviteLink}
                </span>
              )}
            </div>
            <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          {/* Workspace toggle */}
          {isSupergroup && (
            <>
              <Separator />
              <button
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left",
                  isTogglingWorkspace ? "opacity-50 pointer-events-none" : "hover:bg-accent/50"
                )}
                onClick={isInWorkspace ? handleRemoveFromWorkspace : handleAddToWorkspace}
                disabled={isTogglingWorkspace}
              >
                {isTogglingWorkspace ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
                ) : (
                  <Building2 className={cn("h-5 w-5 shrink-0", isInWorkspace ? "text-green-500" : "text-muted-foreground")} />
                )}
                <span className={cn("text-sm", isInWorkspace ? "text-green-500" : "text-muted-foreground")}>
                  {isInWorkspace ? "Убрать из рабочей области" : "Добавить в рабочую область"}
                </span>
              </button>
            </>
          )}

          {/* Members */}
          <Separator />
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              Участники{totalMembers > 0 ? ` (${totalMembers})` : ""}
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-blue-500">
              <UserPlus className="h-4 w-4 mr-1" />
              Добавить
            </Button>
          </div>

          {isLoadingMembers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            members.map((member, index) => (
              <MemberRow
                key={member.id}
                member={member}
                isOwner={index === 0}
                onRemove={() => handleRemoveMember(member.id)}
              />
            ))
          )}

          {/* Leave group */}
          <Separator className="mt-2" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/10 transition-colors text-left text-destructive">
                <LogOut className="h-5 w-5 shrink-0" />
                <span className="text-sm">Покинуть группу</span>
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Покинуть группу?</AlertDialogTitle>
                <AlertDialogDescription>
                  Вы уверены, что хотите покинуть &quot;{dialog.title}&quot;?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLeaveGroup}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Покинуть
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
