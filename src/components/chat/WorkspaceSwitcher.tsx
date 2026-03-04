"use client";

import { useCorporateStore, type Workspace } from "@/store/corporate";

/**
 * Segmented control for switching between Personal and Work workspaces.
 * Only visible if the user is in ≥1 managed (corporate) chat.
 */
export function WorkspaceSwitcher() {
  const workspace = useCorporateStore((s) => s.workspace);
  const managedChatIds = useCorporateStore((s) => s.managedChatIds);
  const switchWorkspace = useCorporateStore((s) => s.switchWorkspace);
  const isLoaded = useCorporateStore((s) => s.isLoaded);

  // Don't render if no managed chats or config not loaded yet
  if (!isLoaded || managedChatIds.size === 0) return null;

  return (
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
        onSelect={switchWorkspace}
      />
    </div>
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

  return (
    <button
      onClick={() => onSelect(value)}
      className={`
        flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all
        ${
          isActive
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }
      `}
    >
      {label}
    </button>
  );
}
