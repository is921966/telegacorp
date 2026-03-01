import type { TelegramClient } from "telegram";
import type { Api } from "telegram";
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
