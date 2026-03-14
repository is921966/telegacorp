/**
 * Crypto shim for React Native.
 * Tries react-native-quick-crypto (native, fast) with graceful fallback
 * to basic Web Crypto API (available in Hermes) for Expo Go compatibility.
 */
let quickCrypto;
try {
  quickCrypto = require("react-native-quick-crypto");
} catch {
  // react-native-quick-crypto requires NitroModules (native build only).
  // Fall back to basic crypto API available in Hermes engine.
  console.warn(
    "[crypto shim] react-native-quick-crypto not available, using basic fallback. " +
      "GramJS auth features may not work in Expo Go. Use a development build for full support."
  );
}

// Export quick-crypto if available, otherwise a minimal shim
if (quickCrypto) {
  module.exports = quickCrypto;
} else {
  // Minimal crypto shim — enough for app to load without crashing.
  // Full crypto (PBKDF2, AES, SRP) requires a development build.
  module.exports = {
    getRandomValues:
      globalThis.crypto?.getRandomValues?.bind(globalThis.crypto) ||
      function (arr) {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      },
    randomBytes: function (size) {
      const bytes = new Uint8Array(size);
      if (globalThis.crypto?.getRandomValues) {
        globalThis.crypto.getRandomValues(bytes);
      } else {
        for (let i = 0; i < size; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
      return bytes;
    },
    createHash: function () {
      console.warn("[crypto shim] createHash not available in Expo Go");
      return {
        update: function () { return this; },
        digest: function () { return ""; },
      };
    },
    createHmac: function () {
      console.warn("[crypto shim] createHmac not available in Expo Go");
      return {
        update: function () { return this; },
        digest: function () { return ""; },
      };
    },
    pbkdf2: function () {
      console.warn("[crypto shim] pbkdf2 not available in Expo Go");
    },
    pbkdf2Sync: function () {
      console.warn("[crypto shim] pbkdf2Sync not available in Expo Go");
      return Buffer.alloc(0);
    },
    subtle: globalThis.crypto?.subtle || {},
  };
}
