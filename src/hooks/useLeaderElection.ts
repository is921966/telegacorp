"use client";

import { useEffect, useCallback } from "react";
import { useSyncStore } from "@/store/sync";
import { useAuthStore } from "@/store/auth";

export function useLeaderElection() {
  const { tabId, isLeader, setIsLeader, setActiveTabs } = useSyncStore();
  const { supabaseUser } = useAuthStore();

  const determineLeader = useCallback(
    (tabs: string[]) => {
      const sorted = [...tabs].sort();
      const leader = sorted[0] === tabId;
      setIsLeader(leader);
      setActiveTabs(sorted);
      return leader;
    },
    [tabId, setIsLeader, setActiveTabs]
  );

  useEffect(() => {
    if (!supabaseUser) return;

    let channel: Awaited<ReturnType<typeof import("@/lib/supabase/sync").createPresenceChannel>> | null = null;

    const setup = async () => {
      const { createPresenceChannel, trackPresence } = await import(
        "@/lib/supabase/sync"
      );

      channel = createPresenceChannel(supabaseUser.id, tabId);

      channel.on("presence", { event: "sync" }, () => {
        const state = channel!.presenceState();
        const tabs = Object.keys(state);
        determineLeader(tabs);
      });

      channel.subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await trackPresence(channel!, tabId);
        }
      });
    };

    setup();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, [supabaseUser, tabId, determineLeader]);

  return { tabId, isLeader };
}
