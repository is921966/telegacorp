/**
 * Polyfills for React Native — MUST be imported before any other code.
 *
 * GramJS requires: Buffer, crypto, URL, getRandomValues
 */

// 1. Buffer (GramJS uses Buffer extensively for MTProto)
import { Buffer } from "buffer";
(globalThis as Record<string, unknown>).Buffer = Buffer;

// 2. Crypto (GramJS PBKDF2, AES, SRP)
import "react-native-get-random-values";
// react-native-quick-crypto provides crypto.subtle for GramJS SRP

// 3. URL polyfill (GramJS constructs URLs internally)
import "react-native-url-polyfill/auto";

// 3.5. crypto.randomUUID polyfill (Hermes doesn't have it, Zustand stores use it)
if (typeof globalThis.crypto !== "undefined" && !globalThis.crypto.randomUUID) {
  (globalThis.crypto as Record<string, unknown>).randomUUID = (): string => {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 1
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
      ""
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

// 4. TextEncoder/TextDecoder (may be needed by some GramJS paths)
if (typeof globalThis.TextEncoder === "undefined") {
  // Basic TextEncoder polyfill for utf-8
  globalThis.TextEncoder = class TextEncoder {
    encoding = "utf-8";
    encode(str: string): Uint8Array {
      const buf = Buffer.from(str, "utf-8");
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    encodeInto(
      str: string,
      dest: Uint8Array
    ): { read: number; written: number } {
      const encoded = this.encode(str);
      const written = Math.min(encoded.length, dest.length);
      dest.set(encoded.subarray(0, written));
      return { read: str.length, written };
    }
  } as unknown as typeof TextEncoder;
}

if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = class TextDecoder {
    encoding = "utf-8";
    decode(input?: BufferSource): string {
      if (!input) return "";
      const buf =
        input instanceof ArrayBuffer
          ? Buffer.from(input)
          : Buffer.from(
              input.buffer,
              input.byteOffset,
              input.byteLength
            );
      return buf.toString("utf-8");
    }
  } as unknown as typeof TextDecoder;
}
