"use client";

import { useRef, useCallback, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactListItem } from "@/components/contacts/ContactListItem";
import { useContacts } from "@/hooks/useContacts";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import type { TelegramContact } from "@/types/telegram";
import { Search, Users, UserPlus, ArrowUpDown } from "lucide-react";

type FlatItem =
  | { type: "header"; letter: string }
  | { type: "contact"; contact: TelegramContact };

export function ContactsPageClient() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const { selectChat } = useUIStore();
  const { groupedContacts, contacts, isLoading, error, searchQuery, setSearchQuery } = useContacts();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sort letters: Latin → Cyrillic → digits/symbols
  const letters = Object.keys(groupedContacts).sort((a, b) => {
    const catA = /[A-Z]/i.test(a) ? 0 : /[А-ЯЁ]/i.test(a) ? 1 : 2;
    const catB = /[A-Z]/i.test(b) ? 0 : /[А-ЯЁ]/i.test(b) ? 1 : 2;
    if (catA !== catB) return catA - catB;
    if (catA === 0) return a.localeCompare(b, "en");
    if (catA === 1) return a.localeCompare(b, "ru");
    return a.localeCompare(b);
  });

  // Flatten grouped contacts for virtualizer
  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const letter of letters) {
      items.push({ type: "header", letter });
      for (const contact of groupedContacts[letter]) {
        items.push({ type: "contact", contact });
      }
    }
    return items;
  }, [letters, groupedContacts]);

  // Letter → flat index mapping for alphabet sidebar
  const letterToIndex = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < flatItems.length; i++) {
      const item = flatItems[i];
      if (item.type === "header") {
        map[item.letter] = i;
      }
    }
    return map;
  }, [flatItems]);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => flatItems[index]?.type === "header" ? 28 : 52,
    overscan: 15,
  });

  // Scroll to section when tapping alphabet index
  const scrollToLetter = useCallback((letter: string) => {
    const index = letterToIndex[letter];
    if (index !== undefined) {
      virtualizer.scrollToIndex(index, { align: "start" });
    }
  }, [letterToIndex, virtualizer]);

  // Thin out alphabet index if too many letters to fit
  const MAX_SIDEBAR_LETTERS = 28;
  const sidebarLetters = useMemo(() => {
    if (letters.length <= MAX_SIDEBAR_LETTERS) return letters;
    // Always keep first and last; evenly sample the rest
    const result: string[] = [letters[0]];
    const step = (letters.length - 1) / (MAX_SIDEBAR_LETTERS - 1);
    for (let i = 1; i < MAX_SIDEBAR_LETTERS - 1; i++) {
      result.push(letters[Math.round(i * step)]);
    }
    result.push(letters[letters.length - 1]);
    return result;
  }, [letters]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="mx-auto w-full max-w-lg flex flex-col flex-1 min-h-0">
          {/* Header — Telegram style */}
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => {/* Sort toggle — future feature */}}
              className="flex items-center gap-1 text-sm text-blue-500 font-medium"
            >
              <ArrowUpDown className="h-4 w-4" />
              <span>Sort</span>
            </button>
            <h1 className="text-[17px] font-semibold">Contacts</h1>
            <button
              onClick={() => {/* Add contact — future feature */}}
              className="text-blue-500"
            >
              <UserPlus className="h-5 w-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative px-4 mb-2">
            <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 rounded-lg bg-muted/50 border-0"
            />
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="space-y-1 px-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <p className="text-sm text-destructive">{error}</p>
              <button
                className="mt-3 text-sm text-blue-500"
                onClick={() => window.location.reload()}
              >
                Повторить
              </button>
            </div>
          ) : letters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Users className="h-16 w-16 mb-4 opacity-20" />
              <p className="text-sm">
                {searchQuery ? "Контакты не найдены" : "Нет контактов"}
              </p>
            </div>
          ) : (
            <div className="relative flex-1 min-h-0 flex">
              {/* Virtualized scrollable list */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto min-h-0 pr-5 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-foreground/20 [&:hover::-webkit-scrollbar-thumb]:bg-foreground/35"
              >
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                  {virtualizer.getVirtualItems().map((virtualRow) => {
                    const item = flatItems[virtualRow.index];
                    if (item.type === "header") {
                      return (
                        <div
                          key={`hdr-${item.letter}`}
                          data-index={virtualRow.index}
                          ref={virtualizer.measureElement}
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <div className="bg-background px-4 py-1">
                            <span className="text-[13px] font-medium text-muted-foreground">{item.letter}</span>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div
                        key={item.contact.id}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <ContactListItem
                          contact={item.contact}
                          onClick={() => selectChat(item.contact.id)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Alphabet index sidebar */}
              {!searchQuery && sidebarLetters.length > 0 && (
                <div className="absolute right-0 top-0 bottom-0 flex flex-col items-center justify-center w-4 z-20 select-none py-1">
                  {sidebarLetters.map((letter) => (
                    <button
                      key={letter}
                      onPointerDown={() => scrollToLetter(letter)}
                      className="text-[9px] leading-[13px] text-blue-500 font-bold hover:text-blue-300 active:scale-150 transition-transform"
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
