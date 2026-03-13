/**
 * Platform abstraction layer for cross-platform storage and configuration.
 * Each platform (web, mobile) must call `initPlatform()` at startup.
 */

export interface PlatformStorage {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
}

export interface PlatformConfig {
  apiBaseUrl: string;
  telegramApiId: number;
  telegramApiHash: string;
  deviceModel: string;
}

let _storage: PlatformStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

let _config: PlatformConfig = {
  apiBaseUrl: "",
  telegramApiId: 0,
  telegramApiHash: "",
  deviceModel: "Telegram Corp",
};

export function initPlatform(storage: PlatformStorage, config: PlatformConfig) {
  _storage = storage;
  _config = config;
}

export function getPlatformStorage(): PlatformStorage {
  return _storage;
}

export function getPlatformConfig(): PlatformConfig {
  return _config;
}
