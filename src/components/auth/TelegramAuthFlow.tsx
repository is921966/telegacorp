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
import { checkIsMobile } from "@/hooks/useIsMobile";
import type { CodeDeliveryType, MobileQrAuthController, MobileQrCheckResult } from "@/lib/telegram/auth";

type Resolver<T> = (value: T) => void;

/** Timeout for connection + code sending (30s) */
const CONNECT_TIMEOUT_MS = 30_000;

/** Mobile QR auth polling interval (3s) */
const MOBILE_QR_POLL_MS = 3_000;

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

  // Mobile QR auth state
  const [isChecking, setIsChecking] = useState(false);
  const mobileQrControllerRef = useRef<MobileQrAuthController | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMobileRef = useRef(false);
  const mobileClientRef = useRef<import("telegram").TelegramClient | null>(null);

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

  // Redirect to auth if no Supabase user (must be in effect, not during render)
  useEffect(() => {
    if (!supabaseUser) router.replace("/auth");
  }, [supabaseUser, router]);

  if (!supabaseUser) return null;

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

    // Save session to Supabase — non-critical, don't block auth if it fails
    try {
      await saveTelegramSession(
        supabaseUser!.id,
        sessionString,
        supabaseUser!.id,
        undefined,
        phoneSuffix || me.phone?.slice(-4)
      );
    } catch (err) {
      console.warn("[TG Auth] Failed to save session to Supabase:", err);
    }

    setTelegramUser(me);
    setTelegramConnected(true);
    setTelegramAuthState({ step: "done" });

    // Upsert user profile to telegram_users directory
    import("@/lib/supabase/telegram-users")
      .then(({ upsertTelegramUser }) => upsertTelegramUser(me))
      .catch(() => {});

    // Save telegram_id to user_metadata (for middleware admin lookup)
    import("@/lib/supabase/client")
      .then(({ supabase }) => supabase.auth.updateUser({ data: { telegram_id: me.id } }))
      .catch(() => {});

    // Load work companies from Supabase table (or migrate localStorage data)
    try {
      const { loadWorkCompanies, saveWorkCompanies } = await import("@/lib/supabase/work-companies");
      const companies = await loadWorkCompanies(me.id);
      if (companies.length > 0) {
        useAuthStore.getState().setWorkCompanies(companies);
      } else {
        const localCompanies = useAuthStore.getState().workCompanies;
        if (localCompanies.length > 0) {
          saveWorkCompanies(me.id, localCompanies).catch(() => {});
        }
      }
    } catch {
      // Non-critical — localStorage data stays
    }

    router.push("/chat");
  };

  // ─── Helper: stop mobile polling ────────────────────────────────────
  const stopMobilePolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    mobileQrControllerRef.current?.cancel();
    mobileQrControllerRef.current = null;
  };

  // ─── Helper: handle mobile QR check result ─────────────────────────
  const handleMobileQrResult = async (
    result: MobileQrCheckResult,
    client: import("telegram").TelegramClient,
  ): Promise<boolean> => {
    switch (result.status) {
      case "success": {
        stopMobilePolling();
        setIsChecking(false);
        await completeAuth(client);
        return true;
      }
      case "pending": {
        setQrUrl(result.qrData.url);
        setQrExpires(result.qrData.expires);
        setIsChecking(false);
        return false;
      }
      case "password_needed": {
        stopMobilePolling();
        setIsChecking(false);
        const { getPasswordHint } = await import("@/lib/telegram/auth");
        const hint = await getPasswordHint(client);
        setTelegramAuthState({ step: "password", passwordHint: hint });
        return true;
      }
      case "error": {
        console.error("[TG Auth] Mobile QR check error:", result.error);
        setIsChecking(false);
        // Don't stop polling for transient errors
        return false;
      }
    }
  };

  // ─── Mobile QR auth flow ────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const startMobileQrAuthFlow = useCallback(async () => {
    const currentStep = useAuthStore.getState().telegramAuthState.step;
    if (currentStep !== "qr" && currentStep !== "phone") return;

    setTelegramAuthState({ step: "qr", error: undefined });
    setQrUrl(null);
    setQrExpires(null);
    setQrLoading(true);
    setIsChecking(false);
    stopMobilePolling();

    const { resetClient, connectClient } = await import("@/lib/telegram/client");
    await resetClient();

    console.log("[TG Auth] Starting MOBILE QR auth flow...");

    let client: import("telegram").TelegramClient;
    try {
      client = await withTimeout(
        connectClient(""),
        CONNECT_TIMEOUT_MS,
        "Не удалось подключиться к Telegram. Проверьте интернет-соединение."
      );
      console.log("[TG Auth] Connected for mobile QR auth, connected:", client.connected);
    } catch (err) {
      console.error("[TG Auth] Mobile QR connection failed:", err);
      setQrLoading(false);
      const rawMsg = err instanceof Error ? err.message : "";
      const userMsg = rawMsg.includes("nonce") || rawMsg.includes("Step")
        ? "Ошибка соединения. Попробуйте обновить страницу."
        : rawMsg || "Ошибка подключения";
      setTelegramAuthState({ step: "qr", error: userMsg });
      return;
    }

    mobileClientRef.current = client;

    try {
      const { startMobileQrAuth } = await import("@/lib/telegram/auth");
      const controller = await startMobileQrAuth(client);
      mobileQrControllerRef.current = controller;

      // Show initial QR data
      setQrUrl(controller.qrData.url);
      setQrExpires(controller.qrData.expires);
      setQrLoading(false);

      // Start background polling
      pollingIntervalRef.current = setInterval(async () => {
        const ctrl = mobileQrControllerRef.current;
        if (!ctrl) return;

        const step = useAuthStore.getState().telegramAuthState.step;
        if (step !== "qr") {
          stopMobilePolling();
          return;
        }

        try {
          const checkResult = await ctrl.checkStatus();
          await handleMobileQrResult(checkResult, client);
        } catch (err) {
          console.warn("[TG Auth] Mobile QR polling error:", err);
        }
      }, MOBILE_QR_POLL_MS);
    } catch (err) {
      console.error("[TG Auth] Mobile QR auth setup failed:", err);
      setQrLoading(false);
      setTelegramAuthState({
        step: "qr",
        error: err instanceof Error ? err.message : "Ошибка авторизации",
      });
    }
  }, [connect, supabaseUser]);

  // ─── QR code auth flow (desktop) ───────────────────────────────────
  const startQrAuthFlow = useCallback(async () => {
    // Don't restart QR flow if already in password/code/done step
    const currentStep = useAuthStore.getState().telegramAuthState.step;
    if (currentStep !== "qr" && currentStep !== "phone") return;

    setTelegramAuthState({ step: "qr", error: undefined });
    setQrUrl(null);
    setQrExpires(null);
    setQrLoading(true);

    // Reset stale client and connect fresh (use connectClient directly to avoid
    // premature setTelegramConnected side effects from useTelegramClient.connect)
    const { resetClient, connectClient } = await import("@/lib/telegram/client");
    await resetClient();

    console.log("[TG Auth] Starting QR auth flow...");

    let client: import("telegram").TelegramClient;
    try {
      client = await withTimeout(
        connectClient(""),
        CONNECT_TIMEOUT_MS,
        "Не удалось подключиться к Telegram. Проверьте интернет-соединение."
      );
      console.log("[TG Auth] Connected for QR auth, connected:", client.connected);
    } catch (err) {
      console.error("[TG Auth] QR connection failed:", err);
      setQrLoading(false);
      const rawMsg = err instanceof Error ? err.message : "";
      const userMsg = rawMsg.includes("nonce") || rawMsg.includes("Step")
        ? "Ошибка соединения. Попробуйте обновить страницу."
        : rawMsg || "Ошибка подключения";
      setTelegramAuthState({
        step: "qr",
        error: userMsg,
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

  // ─── Auto-start auth flow on mount (mobile vs desktop) ─────────────
  useEffect(() => {
    isMobileRef.current = checkIsMobile();

    if (isMobileRef.current) {
      startMobileQrAuthFlow();
    } else {
      startQrAuthFlow();
    }

    return () => {
      stopMobilePolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── visibilitychange: check auth when returning from Telegram ─────
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      if (!isMobileRef.current) return;

      const currentStep = useAuthStore.getState().telegramAuthState.step;
      if (currentStep !== "qr") return;

      const controller = mobileQrControllerRef.current;
      if (!controller) return;

      console.log("[TG Auth] Tab visible, checking mobile QR auth status...");
      setIsChecking(true);

      try {
        // Ensure connection is alive (may have dropped while backgrounded)
        const { getConnectedClient } = await import("@/lib/telegram/client");
        const client = await getConnectedClient();
        if (!client) {
          console.warn("[TG Auth] No client after visibility change, restarting...");
          setIsChecking(false);
          startMobileQrAuthFlow();
          return;
        }

        const result = await controller.checkStatus();
        const done = await handleMobileQrResult(result, client);
        if (!done) {
          setIsChecking(false);
        }
      } catch (err) {
        console.error("[TG Auth] Visibility check failed:", err);
        setIsChecking(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      // Desktop QR or phone auth flow — existing behavior
      setTelegramAuthState({ error: undefined });
      passwordResolverRef.current(password);
      passwordResolverRef.current = null;
    } else if (isMobileRef.current) {
      // Mobile QR flow — handle 2FA directly
      setTelegramAuthState({ error: undefined });
      try {
        const { checkPasswordForMobileQr } = await import("@/lib/telegram/auth");
        const client = mobileClientRef.current;
        if (!client) throw new Error("Нет подключения к Telegram");

        await checkPasswordForMobileQr(client, password);
        await completeAuth(client);
      } catch (err) {
        const rpcErr = err as { errorMessage?: string };
        if (rpcErr.errorMessage === "PASSWORD_HASH_INVALID") {
          setTelegramAuthState({ error: "Неверный пароль. Попробуйте ещё раз." });
        } else if (rpcErr.errorMessage === "SRP_ID_INVALID") {
          // SRP session expired — retry silently
          console.log("[TG Auth] SRP expired, retrying password check...");
          try {
            const { checkPasswordForMobileQr: retry } = await import("@/lib/telegram/auth");
            await retry(mobileClientRef.current!, password);
            await completeAuth(mobileClientRef.current!);
          } catch (retryErr) {
            setTelegramAuthState({
              error: retryErr instanceof Error ? retryErr.message : "Ошибка авторизации",
            });
          }
        } else {
          setTelegramAuthState({
            error: err instanceof Error ? err.message : "Ошибка авторизации",
          });
        }
      }
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
    if (isMobileRef.current) {
      startMobileQrAuthFlow();
    } else {
      startQrAuthFlow();
    }
  };

  const handleSwitchToPhone = () => {
    stopMobilePolling();
    setQrUrl(null);
    setQrExpires(null);
    setQrLoading(false);
    setIsChecking(false);
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
              isChecking={isChecking}
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
            <>
              <PasswordInput
                hint={telegramAuthState.passwordHint}
                onSubmit={handlePasswordSubmit}
                error={telegramAuthState.error}
              />
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setTelegramAuthState({ step: "qr", error: undefined });
                    if (isMobileRef.current) {
                      startMobileQrAuthFlow();
                    } else {
                      startQrAuthFlow();
                    }
                  }}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  ← Попробовать другой способ
                </button>
              </div>
            </>
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
