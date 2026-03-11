"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, X, Search } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useLazyAvatar } from "@/hooks/useLazyAvatar";
import { cn } from "@/lib/utils";
import type { TelegramContact } from "@/types/telegram";

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

function charCategory(ch: string): number {
  if (/[A-Za-z]/.test(ch)) return 0;
  if (/[А-Яа-яЁё]/.test(ch)) return 1;
  return 2;
}

function contactNameCompare(a: string, b: string): number {
  const catA = charCategory(a[0] || "");
  const catB = charCategory(b[0] || "");
  if (catA !== catB) return catA - catB;
  if (catA === 0) return a.localeCompare(b, "en", { sensitivity: "base" });
  if (catA === 1) return a.localeCompare(b, "ru", { sensitivity: "base" });
  return a.localeCompare(b);
}

interface ContactRowProps {
  contact: TelegramContact;
  isSelected: boolean;
  onToggle: () => void;
}

function ContactRow({ contact, isSelected, onToggle }: ContactRowProps) {
  const { ref: avatarRef, avatarUrl } = useLazyAvatar(contact.id);

  return (
    <div
      ref={avatarRef}
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      className="flex w-full items-center gap-3 px-4 py-[6px] text-left transition-colors hover:bg-accent/50 active:bg-accent/80 cursor-pointer"
    >
      <Checkbox
        checked={isSelected}
        className="shrink-0"
        tabIndex={-1}
      />
      <Avatar className="h-10 w-10 shrink-0">
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
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-normal leading-tight">
          {contact.firstName} {contact.lastName || ""}
        </span>
        {contact.username && (
          <span className="block truncate text-[13px] text-muted-foreground leading-tight mt-0.5">
            @{contact.username}
          </span>
        )}
      </div>
    </div>
  );
}

interface Step1SelectMembersProps {
  title?: string;
  nextLabel?: string;
  skipLabel?: string;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
}

export function Step1SelectMembers({
  title = "Новая группа",
  nextLabel = "Далее",
  skipLabel,
  onBack,
  onNext,
  onSkip,
}: Step1SelectMembersProps) {
  const createFlow = useUIStore((s) => s.createFlow);
  const toggleMember = useUIStore((s) => s.toggleMember);
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<TelegramContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadInProgress = useRef(false);

  const selectedMembers = createFlow?.selectedMembers || [];

  // Load contacts on mount
  const loadContacts = useCallback(async () => {
    if (loadInProgress.current) return;
    loadInProgress.current = true;
    setIsLoading(true);

    try {
      const { getConnectedClient } = await import("@/lib/telegram/client");
      const client = await getConnectedClient();
      if (!client) return;

      const { getContacts } = await import("@/lib/telegram/contacts");
      const result = await getContacts(client);
      setContacts(result);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setIsLoading(false);
      loadInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Filter and group contacts
  const filteredContacts = useMemo(() => {
    if (!searchQuery) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter((c) => {
      const fullName = `${c.firstName} ${c.lastName || ""}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (c.username || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q)
      );
    });
  }, [contacts, searchQuery]);

  const groupedContacts = useMemo(() => {
    const sorted = [...filteredContacts].sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName || ""}`.trim();
      const nameB = `${b.firstName} ${b.lastName || ""}`.trim();
      return contactNameCompare(nameA, nameB);
    });

    const groups: Record<string, TelegramContact[]> = {};
    for (const contact of sorted) {
      const firstChar = (contact.firstName[0] || "#").toUpperCase();
      if (!groups[firstChar]) groups[firstChar] = [];
      groups[firstChar].push(contact);
    }
    return groups;
  }, [filteredContacts]);

  const isSelected = (id: string) =>
    selectedMembers.some((m) => m.id === id);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onBack}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {selectedMembers.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedMembers.length} выбрано
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onSkip && skipLabel && (
            <Button variant="ghost" size="sm" onClick={onSkip}>
              {skipLabel}
            </Button>
          )}
          <Button
            size="sm"
            disabled={selectedMembers.length === 0}
            onClick={onNext}
          >
            {nextLabel}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск контактов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Selected chips */}
      {selectedMembers.length > 0 && (
        <div className="px-3 py-2 border-b shrink-0 overflow-x-auto">
          <div className="flex gap-1.5 min-w-max">
            {selectedMembers.map((m) => (
              <Badge
                key={m.id}
                variant="secondary"
                className="flex items-center gap-1 pl-1.5 pr-1 py-0.5 cursor-pointer"
                onClick={() => toggleMember(m)}
              >
                <span className="text-xs truncate max-w-[100px]">
                  {m.firstName}
                </span>
                <X className="h-3 w-3 shrink-0" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Contact list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            Загрузка контактов...
          </div>
        ) : Object.keys(groupedContacts).length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            {searchQuery ? "Ничего не найдено" : "Нет контактов"}
          </div>
        ) : (
          Object.entries(groupedContacts).map(([letter, group]) => (
            <div key={letter}>
              <div className="px-4 py-1 text-xs font-medium text-blue-500 bg-background sticky top-0 z-10">
                {letter}
              </div>
              {group.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  isSelected={isSelected(contact.id)}
                  onToggle={() => toggleMember(contact)}
                />
              ))}
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
}
