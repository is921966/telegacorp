import type { TelegramClient } from "telegram";
import { Api } from "telegram";
import { callWithFloodWait } from "./flood-wait";

export async function downloadMedia(
  client: TelegramClient,
  message: Api.Message,
  onProgress?: (received: number, total: number) => void
): Promise<Buffer> {
  // GramJS OnProgress: (progress: number) => void where progress is 0..1
  const progressFn = onProgress
    ? (progress: number) => {
        onProgress(Math.round(progress * 100), 100);
      }
    : undefined;

  return callWithFloodWait(() =>
    client.downloadMedia(message, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progressCallback: progressFn as any,
    })
  ) as Promise<Buffer>;
}

export async function downloadProfilePhoto(
  client: TelegramClient,
  entityId: string
): Promise<Buffer | null> {
  try {
    const entity = await client.getEntity(entityId);
    const photo = await client.downloadProfilePhoto(entity);
    return photo as Buffer | null;
  } catch {
    return null;
  }
}

export async function sendFile(
  client: TelegramClient,
  chatId: string,
  file: File,
  caption?: string,
  onProgress?: (sent: number, total: number) => void
) {
  const { CustomFile } = await import("telegram/client/uploads");
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const toUpload = new CustomFile(file.name, file.size, "", buffer);

  // GramJS OnProgress: (progress: number) => void where progress is 0..1
  const progressFn = onProgress
    ? (progress: number) => {
        onProgress(Math.round(progress * file.size), file.size);
      }
    : undefined;

  return callWithFloodWait(() =>
    client.sendFile(chatId, {
      file: toUpload,
      caption,
      workers: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progressCallback: progressFn as any,
    })
  );
}

/**
 * Download a video using iterDownload for chunk-by-chunk progress
 * and lower peak memory usage (Uint8Array[] vs single Buffer).
 */
export async function downloadVideoAsBlob(
  client: TelegramClient,
  media: Api.MessageMediaDocument,
  onProgress?: (bytesReceived: number, totalBytes: number) => void
): Promise<{ blob: Blob; mimeType: string } | null> {
  const doc = (media).document;
  if (!(doc instanceof Api.Document)) return null;

  const mimeType = doc.mimeType || "video/mp4";
  const totalSize = Number(doc.size ?? 0);
  const chunks: Uint8Array[] = [];
  let bytesReceived = 0;

  const iter = client.iterDownload({
    file: media,
    requestSize: 512 * 1024,
  });

  for await (const chunk of iter) {
    chunks.push(new Uint8Array(chunk));
    bytesReceived += chunk.length;
    if (onProgress && totalSize > 0) {
      onProgress(bytesReceived, totalSize);
    }
  }

  const blob = new Blob(chunks as BlobPart[], { type: mimeType });
  return { blob, mimeType };
}
