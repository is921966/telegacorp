"use client";

import { useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { CodeInput } from "@/components/auth/CodeInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { useAuthStore } from "@/store/auth";
import { useTelegramClient } from "@/hooks/useTelegramClient";
import type { CodeDeliveryType } from "@/lib/telegram/auth";

type Resolver<T> = (value: T) => void;

/** Timeout for connection + code sending (30s) */
const CONNECT_TIMEOUT_MS = 30_000;

export function TelegramAuthFlow() {
  const router = useRouter();
  const {
    supabaseUser,
    setTelegramUser,
    setTelegramConnected,
    telegramAuthState,
    setTelegramAuthState,
  } = useAuthStore();
  const { connect } = useTelegramClient();

  // Refs for promise resolvers — GramJS calls us, we wait for UI input
  const phoneResolverRef = useRef<Resolver<string> | null>(null);
  const codeResolverRef = useRef<Resolver<string> | null>(null);
  const passwordResolverRef = useRef<Resolver<string> | null>(null);
  const phoneNumberRef = useRef<string>("");

  // Refs for code-sent phase signaling
  const codeSentResolveRef = useRef<(() => void) | null>(null);
  const codeSentRejectRef = useRef<((err: Error) => void) | null>(null);

  // Track whether code was already sent (to suppress post-migration TIMEOUT noise)
  const codeSentRef = useRef(false);

  if (!supabaseUser) {
    router.push("/auth");
    return null;
  }

  /**
   * Starts the full auth flow via client.start().
   * Returns a promise that resolves when the CODE IS SENT (not full auth).
   * Full auth completion continues in the background.
   */
  const startAuthFlow = useCallback(async (phone: string): Promise<void> => {
    setTelegramAuthState({ error: undefined });
    phoneNumberRef.current = phone;
    codeSentRef.current = false;

    // Promise that resolves when code is sent to user, or rejects on error
    const codeSentPromise = new Promise<void>((resolve, reject) => {
      codeSentResolveRef.current = resolve;
      codeSentRejectRef.current = reject;
    });

    // Reset any stale/broken client singleton before fresh auth
    const { resetClient } = await import("@/lib/telegram/client");
    await resetClient();

    console.log("[TG Auth] Connecting to Telegram...");

    // Connect to Telegram with timeout
    let client: import("telegram").TelegramClient;
    try {
      client = await withTimeout(
        connect(),
        CONNECT_TIMEOUT_MS,
        "Не удалось подключиться к Telegram. Проверьте интернет-соединение."
      );
      console.log("[TG Auth] Connected successfully");
    } catch (err) {
      console.error("[TG Auth] Connection failed:", err);
      const msg = err instanceof Error ? err.message : "Ошибка подключения";
      setTelegramAuthState({ error: msg });
      throw err; // PhoneInput catches this and stops loading
    }

    // Start full auth flow in background — resolves only after FULL auth
    const authPromise = (async () => {
      const { startTelegramAuth, getMe } = await import("@/lib/telegram/auth");
      const { saveSession } = await import("@/lib/telegram/client");
      const { saveTelegramSession } = await import("@/lib/supabase/session-store");

      console.log("[TG Auth] Starting auth for phone:", phone.slice(0, 4) + "***");

      await startTelegramAuth(client, {
        onPhoneNumber: async () => {
          console.log("[TG Auth] Requesting phone number");
          return phone;
        },
        onCode: async (deliveryType: CodeDeliveryType) => {
          console.log("[TG Auth] Code sent! Delivery type:", deliveryType);
          // Code was sent! Mark as sent + signal PhoneInput to stop loading
          codeSentRef.current = true;
          codeSentResolveRef.current?.();
          codeSentResolveRef.current = null;
          codeSentRejectRef.current = null;

          // Show code input UI with delivery type
          setTelegramAuthState({
            step: "code",
            phoneNumber: phone,
            codeDeliveryType: deliveryType,
          });

          // Wait for user to enter the code
          return new Promise<string>((resolve) => {
            codeResolverRef.current = resolve;
          });
        },
        onPassword: async (hint?: string) => {
          console.log("[TG Auth] 2FA password requested, hint:", hint);
          setTelegramAuthState({ step: "password", passwordHint: hint });
          return new Promise<string>((resolve) => {
            passwordResolverRef.current = resolve;
          });
        },
        onError: (err: Error) => {
          console.error("[TG Auth] Auth error:", err.message, err);
          const errorMsg = err.message || "Ошибка авторизации";
          setTelegramAuthState({ error: errorMsg });

          // If code hasn't been sent yet, reject the codeSentPromise
          if (codeSentRejectRef.current) {
            codeSentRejectRef.current(err);
            codeSentResolveRef.current = null;
            codeSentRejectRef.current = null;
          }
        },
      });

      // Auth complete — save session and navigate
      const me = await getMe(client);
      const sessionString = saveSession();
      await saveTelegramSession(
        supabaseUser!.id,
        sessionString,
        supabaseUser!.id,
        undefined,
        phone.slice(-4)
      );

      setTelegramUser(me);
      setTelegramConnected(true);
      setTelegramAuthState({ step: "done" });
      router.push("/chat");
    })();

    // Catch background auth errors (after code was sent)
    authPromise.catch((err) => {
      console.error("Auth flow error:", err);
      setTelegramAuthState({
        error: err instanceof Error ? err.message : "Ошибка авторизации",
      });
      // Reject codeSentPromise if it hasn't resolved yet
      if (codeSentRejectRef.current) {
        codeSentRejectRef.current(
          err instanceof Error ? err : new Error("Ошибка авторизации")
        );
        codeSentResolveRef.current = null;
        codeSentRejectRef.current = null;
      }
    });

    // Await ONLY the code-sending phase (or error/timeout)
    // This is what PhoneInput loading state waits for
    await withTimeout(
      codeSentPromise,
      CONNECT_TIMEOUT_MS,
      "Telegram не отвечает. Попробуйте позже."
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, supabaseUser]);

  const handlePhoneSubmit = async (phone: string) => {
    if (phoneResolverRef.current) {
      phoneResolverRef.current(phone);
      phoneResolverRef.current = null;
    } else {
      // Start auth flow — awaits only until code is sent (or error)
      await startAuthFlow(phone);
    }
  };

  const handleCodeSubmit = async (code: string) => {
    if (codeResolverRef.current) {
      setTelegramAuthState({ error: undefined });
      codeResolverRef.current(code);
      codeResolverRef.current = null;
    }
  };

  const handlePasswordSubmit = async (password: string) => {
    if (passwordResolverRef.current) {
      setTelegramAuthState({ error: undefined });
      passwordResolverRef.current(password);
      passwordResolverRef.current = null;
    }
  };

  /** Resend code via SMS (auth.ResendCode) */
  const handleResendCode = async () => {
    setTelegramAuthState({ error: undefined });
    const { resendCode } = await import("@/lib/telegram/auth");
    const { getExistingClient } = await import("@/lib/telegram/client");
    const client = getExistingClient();
    if (!client) {
      const err = new Error("Нет подключения к Telegram. Нажмите «Назад» и попробуйте снова.");
      setTelegramAuthState({ error: err.message });
      throw err;
    }
    try {
      const newType = await resendCode(client);
      setTelegramAuthState({ codeDeliveryType: newType });
    } catch (err) {
      console.error("[TG Auth] Resend failed:", err);
      const rawMsg = err instanceof Error ? err.message : String(err);

      // User-friendly message for known errors
      let msg: string;
      if (rawMsg.includes("SEND_CODE_UNAVAILABLE")) {
        msg = "SMS-отправка недоступна для данного номера. Код приходит только в приложение Telegram. Подождите 10–15 минут и попробуйте снова (← Назад).";
      } else {
        msg = rawMsg;
      }
      setTelegramAuthState({ error: msg });
      throw new Error(msg); // Rethrow so CodeInput knows it failed
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {telegramAuthState.step === "phone" && (
            <PhoneInput
              onSubmit={handlePhoneSubmit}
              error={telegramAuthState.error}
            />
          )}
          {telegramAuthState.step === "code" && (
            <CodeInput
              phoneNumber={phoneNumberRef.current}
              deliveryType={telegramAuthState.codeDeliveryType}
              onSubmit={handleCodeSubmit}
              onResend={handleResendCode}
              onBack={() => setTelegramAuthState({ step: "phone" })}
              error={telegramAuthState.error}
            />
          )}
          {telegramAuthState.step === "password" && (
            <PasswordInput
              hint={telegramAuthState.passwordHint}
              onSubmit={handlePasswordSubmit}
              error={telegramAuthState.error}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Race a promise against a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}
