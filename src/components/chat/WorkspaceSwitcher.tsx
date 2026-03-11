"use client";

import { useState, useEffect, useCallback } from "react";
import { useCorporateStore, type Workspace } from "@/store/corporate";
import { useAuthStore } from "@/store/auth";
import { AddCompanyModal } from "@/components/chat/AddCompanyModal";

/**
 * Segmented control for switching between Personal and Work workspaces.
 * Shows live time counter for each workspace.
 * Only visible if the user is in ≥1 managed (corporate) chat.
 */
export function WorkspaceSwitcher() {
  const workspace = useCorporateStore((s) => s.workspace);
  const managedChatIds = useCorporateStore((s) => s.managedChatIds);
  const switchWorkspace = useCorporateStore((s) => s.switchWorkspace);
  const isLoaded = useCorporateStore((s) => s.isLoaded);
  const personalSeconds = useCorporateStore((s) => s.personalSeconds);
  const workSeconds = useCorporateStore((s) => s.workSeconds);
  const getCurrentElapsed = useCorporateStore((s) => s.getCurrentElapsed);
  const workCompanies = useAuthStore((s) => s.workCompanies);

  const [showAddCompany, setShowAddCompany] = useState(false);
  const [liveElapsed, setLiveElapsed] = useState(0);

  // Tick live elapsed every second
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveElapsed(getCurrentElapsed());
    }, 1000);
    return () => clearInterval(interval);
  }, [getCurrentElapsed]);

  // Don't render if no managed chats or config not loaded yet
  if (!isLoaded || managedChatIds.size === 0) return null;

  const handleWorkClick = () => {
    if (workCompanies.length === 0) {
      setShowAddCompany(true);
    } else {
      switchWorkspace("work");
    }
  };

  const personalTotal =
    workspace === "personal" ? personalSeconds + liveElapsed : personalSeconds;
  const workTotal =
    workspace === "work" ? workSeconds + liveElapsed : workSeconds;

  return (
    <>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
        <WorkspaceButton
          label="💬 Личное"
          value="personal"
          current={workspace}
          seconds={personalTotal}
          onSelect={switchWorkspace}
        />
        <WorkspaceButton
          label="🏢 Рабочее"
          value="work"
          current={workspace}
          seconds={workTotal}
          onSelect={() => handleWorkClick()}
        />
      </div>

      <AddCompanyModal
        open={showAddCompany}
        onOpenChange={setShowAddCompany}
        onAdded={() => switchWorkspace("work")}
      />
    </>
  );
}

function formatTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours}ч ${minutes}м ${secs}с`;
  if (minutes > 0) return `${minutes}м ${secs}с`;
  return `${secs}с`;
}

function WorkspaceButton({
  label,
  value,
  current,
  seconds,
  onSelect,
}: {
  label: string;
  value: Workspace;
  current: Workspace;
  seconds: number;
  onSelect: (ws: Workspace) => void;
}) {
  const isActive = current === value;
  const isWork = value === "work";

  return (
    <button
      onClick={() => onSelect(value)}
      className={`
        flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all
        ${
          isActive && isWork
            ? "bg-teal-500/15 text-teal-600 dark:text-teal-400 shadow-sm"
            : isActive
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
        }
      `}
    >
      <span>{label}</span>
      <span className="text-[10px] tabular-nums opacity-60">
        {formatTime(seconds)}
      </span>
    </button>
  );
}
