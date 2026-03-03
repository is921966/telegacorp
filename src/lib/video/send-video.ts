/**
 * Video Send Pipeline (TZ Sections 5-9)
 *
 * Orchestrates the full video sending workflow:
 * 1. Media Preprocessor: extract metadata, generate thumbnail, transcode LQ
 * 2. Upload Manager: upload thumb first, then video (chunked with resume)
 * 3. Message Publisher: send inputMediaUploadedDocument with supports_streaming
 *
 * Updates the upload store at each phase for UI progress display.
 */

import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { transcodeLQ, extractMetadata, terminateFFmpeg } from "./transcoder";
import { generateThumbnail, generateThumbnailFromData } from "./thumbnail";
import { uploadFile } from "@/lib/telegram/upload-manager";
import { useUploadStore, getAbortController, cleanAbortController } from "@/store/upload";
import type { UploadTask } from "@/store/upload";
import { logUploadEvent, classifyError } from "./metrics";
import { callWithFloodWait } from "@/lib/telegram/flood-wait";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendVideoOptions {
  /** Chat ID to send to */
  chatId: string;
  /** Video file from file picker */
  file: File;
  /** Optional caption */
  caption?: string;
  /** Reply-to message ID */
  replyToId?: number;
}

// ---------------------------------------------------------------------------
// Main send pipeline
// ---------------------------------------------------------------------------

/**
 * Send a video message through the full pipeline (TZ Sections 5-9).
 *
 * Flow:
 * 1. Create upload task in store
 * 2. Extract metadata + validate
 * 3. Generate thumbnail (TZ 7.1)
 * 4. Transcode to LQ (TZ 6.1)
 * 5. Upload thumbnail first (TZ 8.3)
 * 6. Upload video (chunked with resume, TZ 8.1-8.2)
 * 7. Publish message with inputMediaUploadedDocument + supports_streaming (TZ 9.1)
 */
export async function sendVideo(
  client: TelegramClient,
  options: SendVideoOptions
): Promise<void> {
  const { chatId, file, caption, replyToId } = options;
  const taskId = generateTaskId();
  const startTime = Date.now();

  // 1. Create upload task in store
  const task: UploadTask = {
    id: taskId,
    chatId,
    fileName: file.name,
    originalSize: file.size,
    phase: "queued",
    progress: 0,
    phaseProgress: 0,
    startedAt: startTime,
    caption,
    replyToId,
    chunkRetries: 0,
    wasResumed: false,
    abortKey: taskId,
  };
  useUploadStore.getState().addTask(task);

  const abortCtrl = getAbortController(taskId);
  const signal = abortCtrl.signal;

  const updateTask = (updates: Partial<UploadTask>) =>
    useUploadStore.getState().updateTask(taskId, updates);

  logUploadEvent({
    localUploadId: taskId,
    chatId,
    phase: "start",
    event: "upload_started",
    details: file.name + " (" + String(Math.round(file.size / 1024)) + " KB)",
  });

  try {
    // 2. Generate thumbnail FIRST (TZ 7.1: immediately after file selection)
    updateTask({ phase: "generating_thumb", phaseProgress: 0 });
    logUploadEvent({
      localUploadId: taskId, chatId, phase: "generating_thumb", event: "thumb_start",
    });

    const thumbResult = await generateThumbnail(file, signal);

    logUploadEvent({
      localUploadId: taskId, chatId, phase: "generating_thumb", event: "thumb_done",
      bytesTransferred: thumbResult.size,
    });

    updateTask({ progress: 5, phaseProgress: 100 });

    // 3. Transcode to LQ (TZ 6.1)
    updateTask({ phase: "transcoding", phaseProgress: 0 });
    logUploadEvent({
      localUploadId: taskId, chatId, phase: "transcoding", event: "transcode_start",
    });

    let transcodeTimedOut = false;
    const transcodeStart = Date.now();

    // Set up 60s fallback timer (TZ 6.2)
    const transcodeTimeout = setTimeout(() => {
      transcodeTimedOut = true;
    }, 60_000);

    let videoData: Uint8Array;
    let videoDuration: number;
    let videoWidth: number;
    let videoHeight: number;
    let hasAudio: boolean;

    try {
      const result = await transcodeLQ(
        file,
        (progress) => {
          updateTask({ phaseProgress: progress, progress: 5 + Math.round(progress * 0.35) });
        },
        signal
      );

      videoData = result.data;
      videoDuration = result.duration;
      videoWidth = result.width;
      videoHeight = result.height;
      hasAudio = result.hasAudio;

      logUploadEvent({
        localUploadId: taskId, chatId, phase: "transcoding", event: "transcode_done",
        durationMs: result.transcodeDurationMs,
        bytesTransferred: result.size,
      });
    } catch (err) {
      // TZ 6.2: fallback — if transcode fails or is too slow, send as file
      if (transcodeTimedOut || signal.aborted) {
        logUploadEvent({
          localUploadId: taskId, chatId, phase: "transcoding",
          event: "transcode_fallback",
          errorType: transcodeTimedOut ? "timeout" : classifyError(err),
          details: "Falling back to original file",
        });

        const meta = await extractMetadata(file);
        videoData = new Uint8Array(await file.arrayBuffer());
        videoDuration = meta.duration;
        videoWidth = meta.width;
        videoHeight = meta.height;
        hasAudio = meta.hasAudio;
      } else {
        throw err;
      }
    } finally {
      clearTimeout(transcodeTimeout);
    }

    updateTask({
      progress: 40,
      phaseProgress: 100,
      transcodedSize: videoData.length,
    });

    // Regenerate thumbnail from transcoded data for better accuracy
    let thumbBlob = thumbResult.blob;
    let thumbWidth = thumbResult.width;
    let thumbHeight = thumbResult.height;
    try {
      const betterThumb = await generateThumbnailFromData(videoData, "video/mp4", signal);
      thumbBlob = betterThumb.blob;
      thumbWidth = betterThumb.width;
      thumbHeight = betterThumb.height;
    } catch {
      // Keep original thumbnail
    }

    // 4. Upload thumbnail first (TZ 8.3: thumb always before video)
    updateTask({ phase: "uploading_thumb", phaseProgress: 0 });
    logUploadEvent({
      localUploadId: taskId, chatId, phase: "uploading_thumb", event: "thumb_upload_start",
    });

    const thumbData = new Uint8Array(await thumbBlob.arrayBuffer());
    const thumbUploadResult = await uploadFile(
      client,
      thumbData,
      "thumb.jpg",
      taskId + "_thumb",
      (uploaded, total) => {
        updateTask({ phaseProgress: Math.round((uploaded / total) * 100) });
      },
      signal
    );

    logUploadEvent({
      localUploadId: taskId, chatId, phase: "uploading_thumb", event: "thumb_upload_done",
      bytesTransferred: thumbData.length,
      durationMs: thumbUploadResult.durationMs,
    });

    updateTask({ progress: 45, phaseProgress: 100 });

    // 5. Upload video (TZ 8.1-8.2: chunked with resume)
    updateTask({ phase: "uploading_video", phaseProgress: 0 });
    logUploadEvent({
      localUploadId: taskId, chatId, phase: "uploading_video", event: "video_upload_start",
      bytesTransferred: videoData.length,
    });

    const videoUploadResult = await uploadFile(
      client,
      videoData,
      file.name.replace(/\.[^.]+$/, ".mp4"),
      taskId + "_video",
      (uploaded, total) => {
        const phaseProgress = Math.round((uploaded / total) * 100);
        const overallProgress = 45 + Math.round((uploaded / total) * 45);
        updateTask({ phaseProgress, progress: overallProgress });
      },
      signal
    );

    logUploadEvent({
      localUploadId: taskId, chatId, phase: "uploading_video", event: "video_upload_done",
      bytesTransferred: videoData.length,
      durationMs: videoUploadResult.durationMs,
      chunkRetries: videoUploadResult.totalRetries,
    });

    updateTask({
      progress: 90,
      phaseProgress: 100,
      chunkRetries: videoUploadResult.totalRetries,
      wasResumed: videoUploadResult.wasResumed,
    });

    // 6. Publish message (TZ 9.1: inputMediaUploadedDocument + supports_streaming)
    updateTask({ phase: "publishing", phaseProgress: 0 });
    logUploadEvent({
      localUploadId: taskId, chatId, phase: "publishing", event: "publish_start",
    });

    // Build video attributes
    const videoAttributes = [
      new Api.DocumentAttributeVideo({
        duration: Math.round(videoDuration),
        w: videoWidth,
        h: videoHeight,
        supportsStreaming: true, // TZ 9.1: always set
        roundMessage: false,
      }),
      new Api.DocumentAttributeFilename({
        fileName: file.name.replace(/\.[^.]+$/, ".mp4"),
      }),
    ];

    // Build the media input (TZ 9.1)
    const inputMedia = new Api.InputMediaUploadedDocument({
      file: videoUploadResult.inputFile,
      thumb: thumbUploadResult.inputFile,
      mimeType: "video/mp4",
      attributes: videoAttributes,
      forceFile: false,
    });

    // Send the message
    await callWithFloodWait(() =>
      client.invoke(
        new Api.messages.SendMedia({
          peer: chatId,
          media: inputMedia,
          message: caption || "",
          replyTo: replyToId
            ? new Api.InputReplyToMessage({ replyToMsgId: replyToId })
            : undefined,
          randomId: BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)) as any,
        })
      )
    );

    const totalDurationMs = Date.now() - startTime;

    logUploadEvent({
      localUploadId: taskId, chatId, phase: "done", event: "upload_complete",
      durationMs: totalDurationMs,
      bytesTransferred: videoData.length,
      chunkRetries: videoUploadResult.totalRetries,
    });

    updateTask({
      phase: "done",
      progress: 100,
      phaseProgress: 100,
      finishedAt: Date.now(),
    });

    // Store metrics
    useUploadStore.getState().addMetrics({
      totalDurationMs,
      transcodeDurationMs: transcodeStart ? Date.now() - transcodeStart - videoUploadResult.durationMs : 0,
      uploadDurationMs: videoUploadResult.durationMs,
      totalChunkRetries: videoUploadResult.totalRetries,
      wasResumed: videoUploadResult.wasResumed,
      avgUploadSpeed: videoUploadResult.avgSpeed,
      originalSize: file.size,
      transcodedSize: videoData.length,
    });

    // Clean up FFmpeg memory when done
    terminateFFmpeg();

  } catch (err) {
    const errorType = classifyError(err);
    const errorMessage = (err as Error)?.message || String(err);

    logUploadEvent({
      localUploadId: taskId,
      chatId,
      phase: useUploadStore.getState().tasks[taskId]?.phase || "unknown",
      event: "upload_error",
      errorType,
      details: errorMessage,
    });

    updateTask({
      phase: signal.aborted ? "cancelled" : "error",
      errorMessage: signal.aborted ? "Cancelled" : errorMessage,
      finishedAt: Date.now(),
    });
  } finally {
    cleanAbortController(taskId);
  }
}

/**
 * Check if a file is a video.
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/") ||
    /\.(mp4|mov|avi|mkv|webm|m4v|3gp|wmv|flv)$/i.test(file.name);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateTaskId(): string {
  return "upload_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}
