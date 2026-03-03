import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadPhase =
  | "queued"          // Waiting in queue
  | "transcoding"     // FFmpeg.wasm transcoding to LQ
  | "generating_thumb" // Extracting thumbnail frame
  | "uploading_thumb" // Uploading thumb to Telegram
  | "uploading_video" // Uploading video chunks to Telegram
  | "publishing"      // Sending the final message
  | "done"            // Successfully published
  | "error"           // Failed (see errorMessage)
  | "cancelled";      // User cancelled

export interface UploadTask {
  /** Unique local identifier */
  id: string;
  /** Chat to send the video to */
  chatId: string;
  /** Original file name */
  fileName: string;
  /** Original file size in bytes */
  originalSize: number;
  /** Transcoded file size (after LQ transcode) */
  transcodedSize?: number;
  /** Current phase */
  phase: UploadPhase;
  /** Overall progress 0-100 */
  progress: number;
  /** Phase-specific progress 0-100 */
  phaseProgress: number;
  /** Error message if phase === "error" */
  errorMessage?: string;
  /** Timestamp when upload started */
  startedAt: number;
  /** Timestamp when upload finished (done/error/cancelled) */
  finishedAt?: number;
  /** Caption text */
  caption?: string;
  /** Reply-to message ID */
  replyToId?: number;
  /** Number of chunk retries during upload */
  chunkRetries: number;
  /** Whether upload was resumed (after app restart) */
  wasResumed: boolean;
  /** AbortController signal key for cancellation */
  abortKey?: string;
}

// ---------------------------------------------------------------------------
// Metrics (TZ Section 11)
// ---------------------------------------------------------------------------

export interface UploadMetrics {
  /** Time from file selection to message publish (ms) */
  totalDurationMs: number;
  /** Time spent transcoding (ms) */
  transcodeDurationMs: number;
  /** Time spent uploading (ms) */
  uploadDurationMs: number;
  /** Total chunk retries across all chunks */
  totalChunkRetries: number;
  /** Whether any part was resumed from a previous attempt */
  wasResumed: boolean;
  /** Average upload speed in bytes/second */
  avgUploadSpeed: number;
  /** Original file size */
  originalSize: number;
  /** Transcoded file size */
  transcodedSize: number;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface UploadStore {
  /** Active and recent upload tasks (keyed by task ID) */
  tasks: Record<string, UploadTask>;
  /** Completed upload metrics (last 50) */
  metrics: UploadMetrics[];

  // Actions
  addTask: (task: UploadTask) => void;
  updateTask: (id: string, updates: Partial<UploadTask>) => void;
  removeTask: (id: string) => void;
  cancelTask: (id: string) => void;
  addMetrics: (m: UploadMetrics) => void;
  getActiveTaskForChat: (chatId: string) => UploadTask | undefined;
  reset: () => void;
}

/** Global abort controllers for cancellation */
const abortControllers = new Map<string, AbortController>();

export function getAbortController(key: string): AbortController {
  let ctrl = abortControllers.get(key);
  if (!ctrl) {
    ctrl = new AbortController();
    abortControllers.set(key, ctrl);
  }
  return ctrl;
}

export function cleanAbortController(key: string) {
  abortControllers.delete(key);
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  tasks: {},
  metrics: [],

  addTask: (task) =>
    set((state) => ({
      tasks: { ...state.tasks, [task.id]: task },
    })),

  updateTask: (id, updates) =>
    set((state) => {
      const existing = state.tasks[id];
      if (!existing) return state;
      return {
        tasks: { ...state.tasks, [id]: { ...existing, ...updates } },
      };
    }),

  removeTask: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.tasks;
      cleanAbortController(id);
      return { tasks: rest };
    }),

  cancelTask: (id) => {
    const task = get().tasks[id];
    if (!task) return;

    // Signal abort to running operations
    const ctrl = abortControllers.get(id);
    if (ctrl) ctrl.abort();
    cleanAbortController(id);

    set((state) => ({
      tasks: {
        ...state.tasks,
        [id]: { ...task, phase: "cancelled", finishedAt: Date.now() },
      },
    }));
  },

  addMetrics: (m) =>
    set((state) => ({
      metrics: [...state.metrics.slice(-49), m],
    })),

  getActiveTaskForChat: (chatId) => {
    const tasks = get().tasks;
    return Object.values(tasks).find(
      (t) =>
        t.chatId === chatId &&
        t.phase !== "done" &&
        t.phase !== "error" &&
        t.phase !== "cancelled"
    );
  },

  reset: () => {
    for (const ctrl of abortControllers.values()) ctrl.abort();
    abortControllers.clear();
    set({ tasks: {}, metrics: [] });
  },
}));
