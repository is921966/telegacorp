import { supabase } from "./client";

export async function cacheMedia(
  chatId: string,
  messageId: string,
  buffer: Uint8Array,
  mimeType: string
): Promise<string> {
  const path = `${chatId}/${messageId}`;

  const { error } = await supabase.storage
    .from("telegram-media")
    .upload(path, buffer, {
      contentType: mimeType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error && !error.message.includes("already exists")) {
    throw error;
  }

  return path;
}

export async function getCachedMediaUrl(
  chatId: string,
  messageId: string
): Promise<string | null> {
  const path = `${chatId}/${messageId}`;

  const { data, error } = await supabase.storage
    .from("telegram-media")
    .createSignedUrl(path, 3600);

  if (error) return null;
  return data.signedUrl;
}

export async function getMediaWithFallback(
  chatId: string,
  messageId: string,
  downloadFromTelegram: () => Promise<Uint8Array>,
  mimeType = "application/octet-stream"
): Promise<string> {
  const cachedUrl = await getCachedMediaUrl(chatId, messageId);
  if (cachedUrl) return cachedUrl;

  const buffer = await downloadFromTelegram();

  // Cache in background
  cacheMedia(chatId, messageId, buffer, mimeType).catch(console.warn);

  // Return blob URL for immediate display
  const blob = new Blob([new Uint8Array(buffer) as BlobPart], { type: mimeType });
  return URL.createObjectURL(blob);
}
