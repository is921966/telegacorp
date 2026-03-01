"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
import { useContactsStore } from "@/store/contacts";
import { useAuthStore } from "@/store/auth";

/** Consider cached contacts stale after 5 minutes */
const STALE_TIMEOUT = 5 * 60 * 1000;

// Sort order: Latin letters → Cyrillic letters → digits/symbols
function charCategory(ch: string): number {
  if (/[A-Za-z]/.test(ch)) return 0; // Latin
  if (/[А-Яа-яЁё]/.test(ch)) return 1; // Cyrillic
  return 2; // digits, symbols, other
}

function contactNameCompare(a: string, b: string): number {
  const catA = charCategory(a[0] || "");
  const catB = charCategory(b[0] || "");
  if (catA !== catB) return catA - catB;
  if (catA === 0) return a.localeCompare(b, "en", { sensitivity: "base" });
  if (catA === 1) return a.localeCompare(b, "ru", { sensitivity: "base" });
  return a.localeCompare(b);
}

export function useContacts() {
  const isTelegramConnected = useAuthStore((s) => s.isTelegramConnected);
  const {
    contacts, isLoading, error, searchQuery, lastFetchedAt,
    setContacts, setLoading, setError, setSearchQuery,
  } = useContactsStore();
  const loadInProgress = useRef(false);

  const loadContacts = useCallback(async () => {
    if (!isTelegramConnected) return;
    if (loadInProgress.current) return;
    loadInProgress.current = true;

    const { getConnectedClient } = await import("@/lib/telegram/client");
    const client = await getConnectedClient();
    if (!client) {
      loadInProgress.current = false;
      return;
    }

    const hasCached = useContactsStore.getState().contacts.length > 0;
    if (!hasCached) setLoading(true);

    try {
      const { getContacts } = await import("@/lib/telegram/contacts");
      const result = await getContacts(client);
      setContacts(result);
    } catch (err) {
      console.error("Failed to load contacts:", err);
      if (!hasCached) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить контакты");
      }
    } finally {
      if (!hasCached) setLoading(false);
      loadInProgress.current = false;
    }
  }, [isTelegramConnected, setContacts, setLoading, setError]);

  // Stale-while-revalidate: show cached data immediately, refresh in background
  useEffect(() => {
    if (!isTelegramConnected) return;

    const hasCached = contacts.length > 0;
    const isStale = Date.now() - lastFetchedAt > STALE_TIMEOUT;

    if (!hasCached || isStale) {
      loadContacts();
    }
  }, [isTelegramConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter contacts by search query (client-side filtering)
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

  // Group contacts alphabetically: Latin first, then Cyrillic, then digits/symbols
  const groupedContacts = useMemo(() => {
    const sorted = [...filteredContacts].sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName || ""}`.trim();
      const nameB = `${b.firstName} ${b.lastName || ""}`.trim();
      return contactNameCompare(nameA, nameB);
    });

    const groups: Record<string, typeof sorted> = {};
    for (const contact of sorted) {
      const firstChar = (contact.firstName[0] || "#").toUpperCase();
      if (!groups[firstChar]) groups[firstChar] = [];
      groups[firstChar].push(contact);
    }
    return groups;
  }, [filteredContacts]);

  return {
    contacts: filteredContacts,
    groupedContacts,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    loadContacts,
  };
}
