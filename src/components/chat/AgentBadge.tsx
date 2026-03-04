"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentBadgeProps {
  agentName: string;
  status?: string;
  size?: "sm" | "md";
  className?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/15 text-green-500 border-green-500/30",
  canary: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  shadow: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  testing: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

/**
 * AgentBadge — visual indicator that a message came from an AI agent.
 * Shown in chat messages within the work workspace.
 */
export function AgentBadge({
  agentName,
  status = "active",
  size = "sm",
  className,
}: AgentBadgeProps) {
  const colorClass =
    STATUS_COLORS[status] ?? "bg-muted text-muted-foreground border-border";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium select-none",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        colorClass,
        className
      )}
      title={`AI-агент: ${agentName} (${status})`}
    >
      <Bot className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      {agentName}
    </span>
  );
}
