"use client";

import { useState } from "react";
import { Radio, CircleOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MonitoringToggleProps {
  chatId: string | number;
  initialEnabled?: boolean;
  className?: string;
  /** Callback when monitoring state changes */
  onChange?: (enabled: boolean) => void;
}

/**
 * MonitoringToggle — toggle AI monitoring for a corporate chat.
 * Shown in the chat header or settings for managed chats in the work workspace.
 * Consent must be obtained from chat participants before enabling.
 */
export function MonitoringToggle({
  chatId,
  initialEnabled = false,
  className,
  onChange,
}: MonitoringToggleProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isLoading, setIsLoading] = useState(false);

  const toggle = async () => {
    const newState = !enabled;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/admin/monitoring/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monitoring_enabled: newState,
          ...(newState && { consent_obtained_at: new Date().toISOString() }),
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEnabled(newState);
      onChange?.(newState);
    } catch (err) {
      console.error("Failed to toggle monitoring:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={isLoading}
      title={enabled ? "AI-мониторинг включён" : "AI-мониторинг выключен"}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors",
        enabled
          ? "bg-green-500/15 text-green-500 hover:bg-green-500/25"
          : "bg-muted text-muted-foreground hover:bg-muted/80",
        isLoading && "opacity-60",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : enabled ? (
        <Radio className="h-3.5 w-3.5" />
      ) : (
        <CircleOff className="h-3.5 w-3.5" />
      )}
      {enabled ? "AI ON" : "AI OFF"}
    </button>
  );
}
