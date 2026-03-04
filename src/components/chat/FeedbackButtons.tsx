"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackButtonsProps {
  agentId: string;
  /** The agent output text this feedback applies to */
  originalOutput?: string;
  className?: string;
  /** Callback after feedback is submitted */
  onFeedback?: (type: "thumbs_up" | "thumbs_down" | "correction") => void;
}

/**
 * FeedbackButtons — 👍👎 buttons for rating agent responses in chat.
 * Visible only in the work workspace for messages from AI agents.
 */
export function FeedbackButtons({
  agentId,
  originalOutput,
  className,
  onFeedback,
}: FeedbackButtonsProps) {
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");

  const submitFeedback = async (
    type: "thumbs_up" | "thumbs_down" | "correction",
    extra?: { message?: string; corrected_output?: string }
  ) => {
    setSubmitting(type);
    try {
      const res = await fetch(`/api/admin/agents/${agentId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          original_output: originalOutput,
          ...extra,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSubmitted(type);
      onFeedback?.(type);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setSubmitting(null);
    }
  };

  const handleCorrection = () => {
    if (!correctionText.trim()) return;
    submitFeedback("correction", {
      corrected_output: correctionText,
      message: "User correction",
    });
    setShowCorrection(false);
    setCorrectionText("");
  };

  if (submitted) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        {submitted === "thumbs_up" && (
          <ThumbsUp className="h-3 w-3 text-green-500" />
        )}
        {submitted === "thumbs_down" && (
          <ThumbsDown className="h-3 w-3 text-red-500" />
        )}
        {submitted === "correction" && (
          <MessageSquare className="h-3 w-3 text-amber-500" />
        )}
        <span>Спасибо</span>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-0.5">
        <FeedbackBtn
          icon={<ThumbsUp className="h-3 w-3" />}
          loading={submitting === "thumbs_up"}
          title="Полезно"
          onClick={() => submitFeedback("thumbs_up")}
        />
        <FeedbackBtn
          icon={<ThumbsDown className="h-3 w-3" />}
          loading={submitting === "thumbs_down"}
          title="Не полезно"
          onClick={() => submitFeedback("thumbs_down")}
        />
        <FeedbackBtn
          icon={<MessageSquare className="h-3 w-3" />}
          loading={false}
          title="Коррекция"
          onClick={() => setShowCorrection((v) => !v)}
        />
      </div>

      {showCorrection && (
        <div className="flex gap-1">
          <input
            type="text"
            value={correctionText}
            onChange={(e) => setCorrectionText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCorrection()}
            placeholder="Правильный ответ..."
            className="flex-1 px-2 py-1 rounded border border-border bg-background text-xs"
            autoFocus
          />
          <button
            onClick={handleCorrection}
            disabled={!correctionText.trim() || submitting === "correction"}
            className="px-2 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting === "correction" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              "OK"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function FeedbackBtn({
  icon,
  loading,
  title,
  onClick,
}: {
  icon: React.ReactNode;
  loading: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : icon}
    </button>
  );
}
