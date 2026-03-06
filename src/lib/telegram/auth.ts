import { Api } from "telegram";
import type { TelegramClient } from "telegram";

/** Human-readable code delivery type */
export type CodeDeliveryType =
  | "app"
  | "sms"
  | "call"
  | "flash_call"
  | "missed_call"
  | "fragment"
  | "email"
  | "unknown";

/** Map GramJS class names to our delivery types.
 * GramJS TL objects may have className with or without "auth." prefix
 * (e.g., "auth.SentCodeTypeApp" or "SentCodeTypeApp").
 */
function parseDeliveryType(className: string): CodeDeliveryType {
  // Strip "auth." prefix if present (direct invoke returns "auth.SentCodeTypeApp")
  const normalized = className.replace(/^auth\./, "");
  const map: Record<string, CodeDeliveryType> = {
    SentCodeTypeSms: "sms",
    SentCodeTypeApp: "app",
    SentCodeTypeCall: "call",
    SentCodeTypeFlashCall: "flash_call",
    SentCodeTypeMissedCall: "missed_call",
    SentCodeTypeFragmentSms: "fragment",
    SentCodeTypeEmailCode: "email",
    SentCodeTypeSetUpEmailRequired: "email",
    SentCodeTypeFirebaseSms: "sms",
  };
  return map[normalized] || "unknown";
}

/** User-friendly delivery description (Russian) */
export function deliveryTypeLabel(type: CodeDeliveryType): string {
  const labels: Record<CodeDeliveryType, string> = {
    app: "в приложение Telegram",
    sms: "по SMS",
    call: "голосовым звонком",
    flash_call: "звонком (код — последние цифры номера)",
    missed_call: "пропущенным звонком (код — последние цифры номера)",
    fragment: "через Fragment",
    email: "на email",
    unknown: "неизвестным способом",
  };
  return labels[type];
}

/** Result of sendCode — needed for resend and signIn */
export interface SendCodeResult {
  phoneCodeHash: string;
  deliveryType: CodeDeliveryType;
  phone: string;
  codeLength?: number;
}

/** Module-level state so resendCode can access it */
let lastSendCodeResult: SendCodeResult | null = null;

export function getLastSendCodeResult(): SendCodeResult | null {
  return lastSendCodeResult;
}

/**
 * Resend the verification code via an alternative method (usually SMS).
 * Calls auth.ResendCode which uses the `nextType` from the original sendCode.
 */
export async function resendCode(
  client: TelegramClient
): Promise<CodeDeliveryType> {
  if (!lastSendCodeResult) {
    throw new Error("Сначала запросите код (sendCode не был вызван)");
  }

  const { phone, phoneCodeHash } = lastSendCodeResult;

  console.log("[TG Auth] Resending code for:", phone.slice(0, 4) + "***");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await client.invoke(
    new Api.auth.ResendCode({
      phoneNumber: phone,
      phoneCodeHash: phoneCodeHash,
    })
  );

  console.log("[TG Auth] ResendCode response:", JSON.stringify(result, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v
  ));

  const newDeliveryType = parseDeliveryType(
    result.type?.className || "unknown"
  );

  // Update the hash if it changed
  if (result.phoneCodeHash) {
    lastSendCodeResult.phoneCodeHash = result.phoneCodeHash;
  }
  lastSendCodeResult.deliveryType = newDeliveryType;

  console.log("[TG Auth] Resend delivery type:", newDeliveryType);
  return newDeliveryType;
}

/**
 * Cancel any previous auth attempt for the given phone number.
 * This resets Telegram's auth state so a fresh code can be sent.
 */
async function cancelPreviousAuth(
  client: TelegramClient,
  phone: string,
  phoneCodeHash: string
): Promise<void> {
  try {
    console.log("[TG Auth] Cancelling previous auth for:", phone.slice(0, 4) + "***");
    await client.invoke(
      new Api.auth.CancelCode({
        phoneNumber: phone,
        phoneCodeHash: phoneCodeHash,
      })
    );
    console.log("[TG Auth] Previous auth cancelled successfully");
  } catch (err) {
    // CancelCode may fail if there's no active auth — that's OK
    const rpcErr = err as { errorMessage?: string };
    console.log("[TG Auth] CancelCode result:", rpcErr.errorMessage || "ok");
  }
}

/**
 * Deep-inspect a TL object and log all its fields for debugging.
 * GramJS TL objects have nested className properties.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function inspectTLObject(obj: any, prefix = ""): void {
  if (!obj || typeof obj !== "object") {
    console.log(`${prefix} = ${obj}`);
    return;
  }
  if (obj.className) {
    console.log(`${prefix}.className = ${obj.className}`);
  }
  for (const key of Object.keys(obj)) {
    if (key === "className" || key.startsWith("_")) continue;
    const val = obj[key];
    if (val && typeof val === "object" && val.className) {
      inspectTLObject(val, `${prefix}.${key}`);
    } else if (typeof val === "bigint") {
      console.log(`${prefix}.${key} = ${val.toString()} (bigint)`);
    } else if (val !== undefined && val !== null) {
      console.log(`${prefix}.${key} = ${JSON.stringify(val)}`);
    }
  }
}

/**
 * Start the Telegram auth flow with DIRECT auth.SendCode invocation.
 * Uses raw TL API instead of GramJS wrapper for full response visibility.
 * Cancels any previous auth attempt before sending a fresh code.
 *
 * GramJS handles DC migration automatically during invoke().
 */
export async function startTelegramAuth(
  client: TelegramClient,
  callbacks: {
    onPhoneNumber: () => Promise<string>;
    onCode: (deliveryType: CodeDeliveryType) => Promise<string>;
    onPassword: (hint?: string) => Promise<string>;
    onError: (err: Error) => void;
  }
): Promise<void> {
  const phone = await callbacks.onPhoneNumber();

  const apiId = Number(process.env.NEXT_PUBLIC_TELEGRAM_API_ID);
  const apiHash = (process.env.NEXT_PUBLIC_TELEGRAM_API_HASH || "").trim();

  console.log("[TG Auth] ========== AUTH DIAGNOSTIC START ==========");
  console.log("[TG Auth] Phone:", phone.slice(0, 4) + "****" + phone.slice(-2));
  console.log("[TG Auth] API ID:", apiId);
  console.log("[TG Auth] API Hash:", apiHash.slice(0, 8) + "...");
  console.log("[TG Auth] Client connected:", client.connected);
  console.log("[TG Auth] Timestamp:", new Date().toISOString());

  // Cancel any previous auth attempt to force a fresh code
  if (lastSendCodeResult && lastSendCodeResult.phone === phone) {
    await cancelPreviousAuth(client, phone, lastSendCodeResult.phoneCodeHash);
    lastSendCodeResult = null;
  }

  // Step 1: Send code via DIRECT TL API invocation (not client.sendCode wrapper)
  // This gives us the full auth.SentCode TL response with all fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sentCode: any;
  try {
    console.log("[TG Auth] Invoking auth.SendCode directly...");
    sentCode = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: phone,
        apiId: apiId,
        apiHash: apiHash,
        settings: new Api.CodeSettings({
          allowFlashcall: false,
          currentNumber: false,
          allowAppHash: true,
          allowMissedCall: false,
          allowFirebase: false,
        }),
      })
    );
  } catch (err) {
    console.error("[TG Auth] auth.SendCode FAILED:", err);
    // Check for PHONE_MIGRATE_X — GramJS should handle this automatically
    const rpcErr = err as { errorMessage?: string };
    if (rpcErr.errorMessage?.startsWith("PHONE_MIGRATE_")) {
      console.log("[TG Auth] DC migration required:", rpcErr.errorMessage);
      console.log("[TG Auth] Falling back to client.sendCode() for auto-migration...");
      // Fallback to GramJS wrapper which handles DC migration
      try {
        sentCode = await client.sendCode({ apiId, apiHash }, phone);
      } catch (err2) {
        callbacks.onError(
          err2 instanceof Error ? err2 : new Error(String(err2))
        );
        throw err2;
      }
    } else {
      callbacks.onError(
        err instanceof Error ? err : new Error(String(err))
      );
      throw err;
    }
  }

  // Log FULL TL response — every field
  console.log("[TG Auth] ===== sendCode RAW RESPONSE =====");
  console.log("[TG Auth] Response className:", sentCode?.className);
  inspectTLObject(sentCode, "[TG Auth] sentCode");
  console.log("[TG Auth] JSON:", JSON.stringify(sentCode, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v
  , 2));
  console.log("[TG Auth] ===== END RAW RESPONSE =====");

  // Extract delivery type from the full TL response
  const typeClassName: string =
    sentCode?.type?.className ||
    (sentCode?.isCodeViaApp ? "SentCodeTypeApp" : "unknown");
  const deliveryType = parseDeliveryType(typeClassName);
  const phoneCodeHash: string = sentCode?.phoneCodeHash || "";
  const codeLength: number = sentCode?.type?.length || sentCode?.codeLength || 5;
  const timeout: number | undefined = sentCode?.timeout;
  const nextTypeClassName: string = sentCode?.nextType?.className || "none";

  // Store for resendCode
  lastSendCodeResult = { phoneCodeHash, deliveryType, phone, codeLength };

  console.log("[TG Auth] ===== DELIVERY ANALYSIS =====");
  console.log("[TG Auth] type.className:", typeClassName);
  console.log("[TG Auth] Delivery type:", deliveryType);
  console.log("[TG Auth] Code length:", codeLength);
  console.log("[TG Auth] Timeout (until resend):", timeout, "seconds");
  console.log("[TG Auth] nextType.className:", nextTypeClassName);
  console.log("[TG Auth] Phone code hash:", phoneCodeHash);
  console.log("[TG Auth] ===== END ANALYSIS =====");

  // Step 2: Get code from user (pass delivery type for UI hint)
  const code = await callbacks.onCode(deliveryType);

  // Step 3: Sign in with the code (use latest hash — might have been updated by resend)
  const currentHash = lastSendCodeResult?.phoneCodeHash || phoneCodeHash;
  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash: currentHash,
        phoneCode: code,
      })
    );
  } catch (err: unknown) {
    const rpcErr = err as { errorMessage?: string };

    if (rpcErr.errorMessage === "SESSION_PASSWORD_NEEDED") {
      // Step 4: 2FA password required
      console.log("[TG Auth] 2FA password required");
      const pwdInfo = await client.invoke(new Api.account.GetPassword());
      const hint = pwdInfo.hint || undefined;
      const password = await callbacks.onPassword(hint);

      // Compute SRP check and verify
      const { computeCheck } = await import("telegram/Password");
      const srpCheck = await computeCheck(pwdInfo, password);
      await client.invoke(
        new Api.auth.CheckPassword({ password: srpCheck })
      );
    } else if (rpcErr.errorMessage === "PHONE_CODE_INVALID") {
      throw new Error("Неверный код. Попробуйте ещё раз.");
    } else if (rpcErr.errorMessage === "PHONE_CODE_EXPIRED") {
      throw new Error("Код истёк. Запросите новый код.");
    } else {
      throw err;
    }
  }
}

export async function getMe(client: TelegramClient) {
  const me = await client.getMe();
  return {
    id: me.id.toString(),
    firstName: me.firstName || "",
    lastName: me.lastName || "",
    username: me.username || "",
    phone: me.phone || "",
  };
}
