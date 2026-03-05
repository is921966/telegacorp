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

/** Map GramJS class names to our delivery types */
function parseDeliveryType(className: string): CodeDeliveryType {
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
  return map[className] || "unknown";
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

/**
 * Start the Telegram auth flow with manual sendCode + signIn.
 * Unlike client.start(), this gives us visibility into the code delivery type.
 *
 * GramJS handles DC migration automatically during sendCode().
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

  // Step 1: Send code — GramJS handles DC migration internally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sentCode: any;
  try {
    sentCode = await client.sendCode({ apiId, apiHash }, phone);
  } catch (err) {
    callbacks.onError(
      err instanceof Error ? err : new Error(String(err))
    );
    throw err;
  }

  // Log full response for debugging
  console.log("[TG Auth] sendCode response:", JSON.stringify(sentCode, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v
  ));

  const deliveryType = parseDeliveryType(
    sentCode.type?.className || (sentCode.isCodeViaApp ? "SentCodeTypeApp" : "unknown")
  );
  const phoneCodeHash: string = sentCode.phoneCodeHash || "";
  console.log("[TG Auth] Code delivery type:", deliveryType);
  console.log("[TG Auth] Phone code hash:", phoneCodeHash.slice(0, 8) + "...");
  if (sentCode.nextType) {
    console.log("[TG Auth] Next type available:", sentCode.nextType?.className);
  }
  if (sentCode.timeout) {
    console.log("[TG Auth] Timeout for next type:", sentCode.timeout, "sec");
  }

  // Step 2: Get code from user (pass delivery type for UI hint)
  const code = await callbacks.onCode(deliveryType);

  // Step 3: Sign in with the code
  try {
    await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: phone,
        phoneCodeHash: phoneCodeHash,
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
