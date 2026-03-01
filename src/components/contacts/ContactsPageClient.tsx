"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ContactListItem } from "@/components/contacts/ContactListItem";
import { useContacts } from "@/hooks/useContacts";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import { Search, Users, UserPlus, ArrowUpDown } from "lucide-react";

export function ContactsPageClient() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const { selectChat } = useUIStore();
  const { groupedContacts, contacts, isLoading, error, searchQuery, setSearchQuery } = useContacts();
  const [photoMap, setPhotoMap] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Load avatars for visible contacts (get client from module singleton)
  useEffect(() => {
    if (!isTelegramConnected || contacts.length === 0) return;

    let cancelled = false;
    (async () => {
      const { getConnectedClient } = await import("@/lib/telegram/client");
      const client = await getConnectedClient();
      if (!client || cancelled) return;

      const { downloadAvatar, getCachedAvatar } = await import("@/lib/telegram/photos");
      const toLoad = contacts.filter((c) => getCachedAvatar(c.id) === undefined);
      if (toLoad.length === 0) {
        const newMap: Record<string, string> = {};
        for (const c of contacts) {
          const url = getCachedAvatar(c.id);
          if (url) newMap[c.id] = url;
        }
        setPhotoMap(newMap);
        return;
      }

      const BATCH_SIZE = 5;
      for (let i = 0; i < toLoad.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = toLoad.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(batch.map((c) => downloadAvatar(client, c.id)));
        if (!cancelled) {
          const newMap: Record<string, string> = {};
          for (const c of contacts) {
            const url = getCachedAvatar(c.id);
            if (url) newMap[c.id] = url;
          }
          setPhotoMap(newMap);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isTelegramConnected, contacts]);

  // Sort letters: Latin → Cyrillic → digits/symbols
  const letters = Object.keys(groupedContacts).sort((a, b) => {
    const catA = /[A-Z]/i.test(a) ? 0 : /[А-ЯЁ]/i.test(a) ? 1 : 2;
    const catB = /[A-Z]/i.test(b) ? 0 : /[А-ЯЁ]/i.test(b) ? 1 : 2;
    if (catA !== catB) return catA - catB;
    if (catA === 0) return a.localeCompare(b, "en");
    if (catA === 1) return a.localeCompare(b, "ru");
    return a.localeCompare(b);
  });

  // Scroll to section when tapping alphabet index
  const scrollToLetter = useCallback((letter: string) => {
    const el = sectionRefs.current[letter];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

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
              {/* Main scrollable list */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 pr-5">
                {letters.map((letter) => (
                  <div
                    key={letter}
                    ref={(el) => { sectionRefs.current[letter] = el; }}
                  >
                    <div className="sticky top-0 z-10 bg-background px-4 py-1">
                      <span className="text-[13px] font-medium text-muted-foreground">{letter}</span>
                    </div>
                    {groupedContacts[letter].map((contact) => (
                      <ContactListItem
                        key={contact.id}
                        contact={contact}
                        photoUrl={photoMap[contact.id]}
                        onClick={() => selectChat(contact.id)}
                      />
                    ))}
                  </div>
                ))}
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
