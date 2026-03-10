"use client";

import { useState } from "react";
import { useCorporateStore, type Workspace } from "@/store/corporate";
import { useAuthStore } from "@/store/auth";
import { AddCompanyModal } from "@/components/chat/AddCompanyModal";

/**
 * Segmented control for switching between Personal and Work workspaces.
 * Only visible if the user is in ≥1 managed (corporate) chat.
 */
export function WorkspaceSwitcher() {
  const workspace = useCorporateStore((s) => s.workspace);
  const managedChatIds = useCorporateStore((s) => s.managedChatIds);
  const switchWorkspace = useCorporateStore((s) => s.switchWorkspace);
  const isLoaded = useCorporateStore((s) => s.isLoaded);
  const workCompanies = useAuthStore((s) => s.workCompanies);

  const [showAddCompany, setShowAddCompany] = useState(false);

  // Don't render if no managed chats or config not loaded yet
  if (!isLoaded || managedChatIds.size === 0) return null;

  const handleWorkClick = () => {
    if (workCompanies.length === 0) {
      setShowAddCompany(true);
    } else {
      switchWorkspace("work");
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
        <WorkspaceButton
          label="💬 Личное"
          value="personal"
          current={workspace}
          onSelect={switchWorkspace}
        />
        <WorkspaceButton
          label="🏢 Рабочее"
          value="work"
          current={workspace}
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

function WorkspaceButton({
  label,
  value,
  current,
  onSelect,
}: {
  label: string;
  value: Workspace;
  current: Workspace;
  onSelect: (ws: Workspace) => void;
}) {
  const isActive = current === value;
  const isWork = value === "work";

  return (
    <button
      onClick={() => onSelect(value)}
      className={`
        flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all
        ${
          isActive && isWork
            ? "bg-teal-500/15 text-teal-600 dark:text-teal-400 shadow-sm"
            : isActive
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
        }
      `}
    >
      {label}
    </button>
  );
}
