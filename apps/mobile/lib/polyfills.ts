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
