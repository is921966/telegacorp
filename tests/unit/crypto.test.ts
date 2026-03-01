import { describe, it, expect } from "vitest";
import { encryptSession, decryptSession } from "@/lib/crypto";

describe("encryptSession / decryptSession", () => {
  it("encrypt then decrypt returns the original string", async () => {
    const original = "1BAAOmTh-session-string-abc123";
    const password = "strongPassword!42";

    const encrypted = await encryptSession(original, password);
    const decrypted = await decryptSession(encrypted, password);

    expect(decrypted).toBe(original);
  });

  it("wrong password fails decryption", async () => {
    const original = "secret-session-data";
    const password = "correctPassword";
    const wrongPassword = "wrongPassword";

    const encrypted = await encryptSession(original, password);

    await expect(
      decryptSession(encrypted, wrongPassword)
    ).rejects.toThrow();
  });

  it("different passwords produce different ciphertext", async () => {
    const original = "same-session-data";
    const passwordA = "passwordAlpha";
    const passwordB = "passwordBeta";

    const encryptedA = await encryptSession(original, passwordA);
    const encryptedB = await encryptSession(original, passwordB);

    // Even with the same plaintext, different passwords (and random salt/iv)
    // must produce different ciphertext
    expect(encryptedA).not.toBe(encryptedB);
  });

  it("same password with same plaintext produces different ciphertext (random salt/iv)", async () => {
    const original = "same-session-data";
    const password = "samePassword";

    const encrypted1 = await encryptSession(original, password);
    const encrypted2 = await encryptSession(original, password);

    // Random salt + IV means each encryption is unique
    expect(encrypted1).not.toBe(encrypted2);

    // Both should still decrypt correctly
    expect(await decryptSession(encrypted1, password)).toBe(original);
    expect(await decryptSession(encrypted2, password)).toBe(original);
  });
});
