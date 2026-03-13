/**
 * Initialize @corp/shared platform layer for React Native.
 *
 * Must be called once at app startup, after polyfills.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { initPlatform, type PlatformStorage } from "@corp/shared";

// TODO: Move to app config / environment variables
const API_BASE_URL = "https://telegram-corp.vercel.app";
const TELEGRAM_API_ID = 0; // Set from environment
const TELEGRAM_API_HASH = ""; // Set from environment

/**
 * AsyncStorage adapter implementing PlatformStorage interface.
 * AsyncStorage is async, but PlatformStorage supports Promise returns.
 */
const asyncStorageAdapter: PlatformStorage = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export function initMobilePlatform() {
  initPlatform(asyncStorageAdapter, {
    apiBaseUrl: API_BASE_URL,
    telegramApiId: TELEGRAM_API_ID,
    telegramApiHash: TELEGRAM_API_HASH,
    deviceModel: "Telegram Corp iOS",
  });
}
