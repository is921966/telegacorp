"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { CodeInput } from "@/components/auth/CodeInput";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { QrCodeLogin } from "@/components/auth/QrCodeLogin";
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

  // QR code auth state
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrExpires, setQrExpires] = useState<number | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

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

  // ─── Helper: complete auth (save session, navigate) ───────────────
  const completeAuth = async (
    client: import("telegram").TelegramClient,
    phoneSuffix?: string
  ) => {
    const { getMe } = await import("@/lib/telegram/auth");
    const { saveSession } = await import("@/lib/telegram/client");
    const { saveTelegramSession } = await import(
      "@/lib/supabase/session-store"
    );

    const me = await getMe(client);
    const sessionString = saveSession();
    await saveTelegramSession(
      supabaseUser!.id,
      sessionString,
      supabaseUser!.id,
      undefined,
      phoneSuffix || me.phone?.slice(-4)
    );

    setTelegramUser(me);
    setTelegramConnected(true);
    setTelegramAuthState({ step: "done" });
    router.push("/chat");
  };

  // ─── QR code auth flow ────────────────────────────────────────────
  const startQrAuthFlow = useCallback(async () => {
    setTelegramAuthState({ step: "qr", error: undefined });
    setQrUrl(null);
    setQrExpires(null);
    setQrLoading(true);

    // Reset stale client
    const { resetClient } = await import("@/lib/telegram/client");
    await resetClient();

    console.log("[TG Auth] Starting QR auth flow...");

    let client: import("telegram").TelegramClient;
    try {
      client = await withTimeout(
        connect(),
        CONNECT_TIMEOUT_MS,
        "Не удалось подключиться к Telegram. Проверьте интернет-соединение."
      );
      console.log("[TG Auth] Connected for QR auth");
    } catch (err) {
      console.error("[TG Auth] QR connection failed:", err);
      setQrLoading(false);
      setTelegramAuthState({
        step: "qr",
        error:
          err instanceof Error ? err.message : "Ошибка подключения",
      });
      return;
    }

    try {
      const { startQrAuth } = await import("@/lib/telegram/auth");

      await startQrAuth(client, {
        onQrCode: (data) => {
          setQrUrl(data.url);
          setQrExpires(data.expires);
          setQrLoading(false);
        },
        onPassword: async (hint?: string) => {
          console.log("[TG Auth] QR → 2FA password required");
          setTelegramAuthState({ step: "password", passwordHint: hint });
          return new Promise<string>((resolve) => {
            passwordResolverRef.current = resolve;
          });
        },
        onError: (err: Error) => {
          console.error("[TG Auth] QR auth error:", err.message);
          setQrLoading(false);
          // Show error on the current step (don't force back to QR if we're on password step)
          const currentStep = useAuthStore.getState().telegramAuthState.step;
          if (currentStep === "password") {
            // Password error — keep on password screen, just show the error
            setTelegramAuthState({ error: err.message || "Ошибка авторизации" });
          } else {
            setTelegramAuthState({
              step: "qr",
              error: err.message || "Ошибка авторизации",
            });
          }
        },
      });

      // QR auth complete
      await completeAuth(client);
    } catch (err) {
      console.error("[TG Auth] QR auth failed:", err);
      setQrLoading(false);
      const errMsg = err instanceof Error ? err.message : "Ошибка авторизации";
      // Don't show "AUTH_USER_CANCEL" to user — it's an internal GramJS signal
      if (errMsg === "AUTH_USER_CANCEL") {
        console.log("[TG Auth] QR auth cancelled by user/error handler");
        return;
      }
      const currentStep = useAuthStore.getState().telegramAuthState.step;
      if (currentStep === "password") {
        setTelegramAuthState({ error: errMsg });
      } else {
        setTelegramAuthState({
          step: "qr",
          error: errMsg,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, supabaseUser]);

  // Auto-start QR auth flow on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { startQrAuthFlow(); }, []);

  // ─── Phone number auth flow ───────────────────────────────────────
  const startAuthFlow = useCallback(
    async (phone: string): Promise<void> => {
      setTelegramAuthState({ error: undefined });
      phoneNumberRef.current = phone;
      codeSentRef.current = false;

      const codeSentPromise = new Promise<void>((resolve, reject) => {
        codeSentResolveRef.current = resolve;
        codeSentRejectRef.current = reject;
      });

      const { resetClient } = await import("@/lib/telegram/client");
      await resetClient();

      console.log("[TG Auth] Connecting to Telegram...");

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
        const msg =
          err instanceof Error ? err.message : "Ошибка подключения";
        setTelegramAuthState({ error: msg });
        throw err;
      }

      const authPromise = (async () => {
        const { startTelegramAuth } = await import("@/lib/telegram/auth");

        console.log(
          "[TG Auth] Starting auth for phone:",
          phone.slice(0, 4) + "***"
        );

        await startTelegramAuth(client, {
          onPhoneNumber: async () => {
            console.log("[TG Auth] Requesting phone number");
            return phone;
          },
          onCode: async (deliveryType: CodeDeliveryType) => {
            console.log("[TG Auth] Code sent! Delivery type:", deliveryType);
            codeSentRef.current = true;
            codeSentResolveRef.current?.();
            codeSentResolveRef.current = null;
            codeSentRejectRef.current = null;

            const { getLastSendCodeResult } = await import(
              "@/lib/telegram/auth"
            );
            const lastResult = getLastSendCodeResult();

            setTelegramAuthState({
              step: "code",
              phoneNumber: phone,
              codeDeliveryType: deliveryType,
              codeLength: lastResult?.codeLength,
            });

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

            if (codeSentRejectRef.current) {
              codeSentRejectRef.current(err);
              codeSentResolveRef.current = null;
              codeSentRejectRef.current = null;
            }
          },
        });

        await completeAuth(client, phone.slice(-4));
      })();

      authPromise.catch((err) => {
        console.error("Auth flow error:", err);
        setTelegramAuthState({
          error: err instanceof Error ? err.message : "Ошибка авторизации",
        });
        if (codeSentRejectRef.current) {
          codeSentRejectRef.current(
            err instanceof Error ? err : new Error("Ошибка авторизации")
          );
          codeSentResolveRef.current = null;
          codeSentRejectRef.current = null;
        }
      });

      await withTimeout(
        codeSentPromise,
        CONNECT_TIMEOUT_MS,
        "Telegram не отвечает. Попробуйте позже."
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connect, supabaseUser]
  );

  // ─── Handlers ─────────────────────────────────────────────────────

  const handlePhoneSubmit = async (phone: string) => {
    if (phoneResolverRef.current) {
      phoneResolverRef.current(phone);
      phoneResolverRef.current = null;
    } else {
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

  const handleResendCode = async () => {
    setTelegramAuthState({ error: undefined });
    const { resendCode } = await import("@/lib/telegram/auth");
    const { getExistingClient } = await import("@/lib/telegram/client");
    const client = getExistingClient();
    if (!client) {
      const err = new Error(
        "Нет подключения к Telegram. Нажмите «Назад» и попробуйте снова."
      );
      setTelegramAuthState({ error: err.message });
      throw err;
    }
    try {
      const newType = await resendCode(client);
      setTelegramAuthState({ codeDeliveryType: newType });
    } catch (err) {
      console.error("[TG Auth] Resend failed:", err);
      const rawMsg = err instanceof Error ? err.message : String(err);

      let msg: string;
      if (rawMsg.includes("SEND_CODE_UNAVAILABLE")) {
        msg = "SMS-отправка недоступна. Попробуйте войти через QR-код (← Назад).";
      } else {
        msg = rawMsg;
      }
      setTelegramAuthState({ error: msg });
      throw new Error(msg);
    }
  };

  const handleSwitchToQr = () => {
    setTelegramAuthState({ step: "qr", error: undefined });
    startQrAuthFlow();
  };

  const handleSwitchToPhone = () => {
    setQrUrl(null);
    setQrExpires(null);
    setQrLoading(false);
    setTelegramAuthState({ step: "phone", error: undefined });
  };

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {telegramAuthState.step === "qr" && (
            <QrCodeLogin
              qrUrl={qrUrl}
              expires={qrExpires}
              isLoading={qrLoading}
              onBack={handleSwitchToPhone}
              error={telegramAuthState.error}
            />
          )}
          {telegramAuthState.step === "phone" && (
            <>
              <PhoneInput
                onSubmit={handlePhoneSubmit}
                error={telegramAuthState.error}
              />
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={handleSwitchToQr}
                  className="text-sm text-primary hover:underline"
                >
                  ← Войти по QR-коду
                </button>
              </div>
            </>
          )}
          {telegramAuthState.step === "code" && (
            <CodeInput
              phoneNumber={phoneNumberRef.current}
              deliveryType={telegramAuthState.codeDeliveryType}
              codeLength={telegramAuthState.codeLength}
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
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}
