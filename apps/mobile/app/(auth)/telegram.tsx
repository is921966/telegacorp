import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import {
  useAuthStore,
  getTelegramClient,
  connectClient,
  getMe,
  startMobileQrAuth,
  startTelegramAuth,
  resendCode,
  type QrTokenData,
  type MobileQrAuthController,
  type CodeDeliveryType,
} from "@corp/shared";
import { useSession } from "../../components/providers/SessionProvider";
import { QrCodeDisplay } from "../../components/auth/QrCodeDisplay";
import { PhoneInput } from "../../components/auth/PhoneInput";
import { CodeInput } from "../../components/auth/CodeInput";

type AuthStep = "qr" | "phone" | "code" | "connecting";

/**
 * Telegram auth screen — handles QR code login (primary) and phone fallback.
 *
 * Primary flow: QR code (polling-based via startMobileQrAuth)
 * Fallback: Phone → Code → (optional) Password
 *
 * 2FA password is handled on a separate screen: /(auth)/password
 */
export default function TelegramAuthScreen() {
  const router = useRouter();
  const { persistSession } = useSession();
  const { setTelegramUser, setTelegramConnected, setTelegramAuthState } =
    useAuthStore();

  const [step, setStep] = useState<AuthStep>("connecting");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deliveryType, setDeliveryType] = useState<CodeDeliveryType>("app");
  const [codeLength, setCodeLength] = useState(5);
  const [phoneNumber, setPhoneNumber] = useState("");

  const qrControllerRef = useRef<MobileQrAuthController | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // ── Cleanup on unmount ──
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (qrControllerRef.current) qrControllerRef.current.cancel();
    };
  }, []);

  // ── Initialize: connect GramJS + start QR auth ──
  useEffect(() => {
    startQrFlow();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── QR auth flow ──
  const startQrFlow = useCallback(async () => {
    try {
      setStep("connecting");
      setQrError(null);

      // Connect GramJS with empty session
      const client = await connectClient("");

      if (!mountedRef.current) return;
      setStep("qr");

      // Start mobile QR auth (polling-based)
      const controller = await startMobileQrAuth(client);
      qrControllerRef.current = controller;

      if (!mountedRef.current) return;
      setQrUrl(controller.qrData.url);

      // Start polling every 2s
      pollingRef.current = setInterval(async () => {
        if (!mountedRef.current) return;

        try {
          const result = await controller.checkStatus();

          if (!mountedRef.current) return;

          switch (result.status) {
            case "pending":
              // Update QR if token refreshed
              if (result.qrData.url !== qrUrl) {
                setQrUrl(result.qrData.url);
              }
              break;

            case "success":
              // Auth complete!
              if (pollingRef.current) clearInterval(pollingRef.current);
              await handleAuthSuccess(client);
              break;

            case "password_needed":
              // 2FA required — navigate to password screen
              if (pollingRef.current) clearInterval(pollingRef.current);
              router.push("/(auth)/password");
              break;

            case "error":
              console.error("[TelegramAuth] QR poll error:", result.error);
              setQrError(result.error.message);
              break;
          }
        } catch (err) {
          console.error("[TelegramAuth] Polling error:", err);
        }
      }, 2000);
    } catch (err) {
      console.error("[TelegramAuth] QR init error:", err);
      if (mountedRef.current) {
        setQrError(err instanceof Error ? err.message : "Ошибка подключения");
        setStep("qr");
      }
    }
  }, []);

  // ── Handle successful auth ──
  const handleAuthSuccess = async (client: ReturnType<typeof getTelegramClient>) => {
    try {
      setStep("connecting");
      const me = await getMe(client);

      if (!mountedRef.current) return;

      setTelegramUser(me);
      setTelegramConnected(true);
      setTelegramAuthState({ step: "done" });

      // Persist session
      await persistSession();

      // Navigate to main app
      router.replace("/");
    } catch (err) {
      console.error("[TelegramAuth] Post-auth error:", err);
      Alert.alert("Ошибка", "Не удалось завершить авторизацию");
    }
  };

  // ── Phone auth flow ──
  const handleSwitchToPhone = () => {
    // Stop QR polling
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (qrControllerRef.current) qrControllerRef.current.cancel();
    setStep("phone");
  };

  const handlePhoneSubmit = async (phone: string) => {
    setIsLoading(true);
    setPhoneError(null);
    setPhoneNumber(phone);

    try {
      const client = await connectClient("");

      // Use resolver pattern — startTelegramAuth calls callbacks
      await startTelegramAuth(client, {
        onPhoneNumber: async () => phone,
        onCode: async (delivery) => {
          // Switch to code step and wait for user input
          if (!mountedRef.current) return "";
          setDeliveryType(delivery);
          setStep("code");
          setIsLoading(false);

          // Return a promise that resolves when user enters code
          return new Promise<string>((resolve) => {
            codeResolverRef.current = resolve;
          });
        },
        onPassword: async (hint) => {
          // Navigate to password screen
          if (mountedRef.current) {
            router.push({
              pathname: "/(auth)/password",
              params: { hint: hint || "" },
            });
          }
          // Return a promise that never resolves (password screen handles it)
          return new Promise<string>(() => {});
        },
        onError: (err) => {
          if (mountedRef.current) {
            setPhoneError(err.message);
            setIsLoading(false);
          }
        },
      });

      // If we get here, auth succeeded after code
      if (mountedRef.current) {
        await handleAuthSuccess(client);
      }
    } catch (err) {
      if (mountedRef.current) {
        const msg = err instanceof Error ? err.message : "Ошибка отправки кода";
        setPhoneError(msg);
        setIsLoading(false);
      }
    }
  };

  // ── Code resolver (promise pattern) ──
  const codeResolverRef = useRef<((code: string) => void) | null>(null);

  const handleCodeSubmit = (code: string) => {
    setIsLoading(true);
    setCodeError(null);
    if (codeResolverRef.current) {
      codeResolverRef.current(code);
      codeResolverRef.current = null;
    }
  };

  const handleResendCode = async () => {
    try {
      const client = await connectClient("");
      const newDelivery = await resendCode(client);
      setDeliveryType(newDelivery);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка повторной отправки";
      setCodeError(msg);
    }
  };

  // ── Render ──
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back button */}
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>

        {/* Connecting spinner */}
        {step === "connecting" && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.connectingText}>Подключение к Telegram...</Text>
          </View>
        )}

        {/* QR Code step */}
        {step === "qr" && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Вход через QR-код</Text>
            <Text style={styles.stepSubtitle}>
              Откройте Telegram на телефоне{"\n"}
              Настройки → Устройства → Подключить устройство{"\n"}
              Отсканируйте QR-код
            </Text>

            <View style={styles.qrContainer}>
              <QrCodeDisplay
                url={qrUrl}
                error={qrError}
                isLoading={!qrUrl && !qrError}
              />
            </View>

            {qrError && (
              <Pressable style={styles.retryButton} onPress={startQrFlow}>
                <Text style={styles.retryText}>Попробовать снова</Text>
              </Pressable>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>или</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              style={styles.secondaryButton}
              onPress={handleSwitchToPhone}
            >
              <Text style={styles.secondaryButtonText}>
                Войти по номеру телефона
              </Text>
            </Pressable>
          </View>
        )}

        {/* Phone input step */}
        {step === "phone" && (
          <View style={styles.stepContent}>
            <PhoneInput
              onSubmit={handlePhoneSubmit}
              isLoading={isLoading}
              error={phoneError}
            />

            <Pressable
              style={styles.linkButton}
              onPress={startQrFlow}
            >
              <Text style={styles.linkText}>← Вернуться к QR-коду</Text>
            </Pressable>
          </View>
        )}

        {/* Code input step */}
        {step === "code" && (
          <View style={styles.stepContent}>
            <CodeInput
              deliveryType={deliveryType}
              codeLength={codeLength}
              phone={phoneNumber}
              onSubmit={handleCodeSubmit}
              onResend={handleResendCode}
              isLoading={isLoading}
              error={codeError}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 16,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 16,
    color: "#2196F3",
    fontWeight: "500",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  connectingText: {
    fontSize: 16,
    color: "#666",
  },
  stepContent: {
    flex: 1,
    gap: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a2e",
    textAlign: "center",
  },
  stepSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  qrContainer: {
    alignItems: "center",
    marginVertical: 8,
  },
  retryButton: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 15,
    color: "#2196F3",
    fontWeight: "500",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  dividerText: {
    fontSize: 14,
    color: "#999",
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#2196F3",
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    color: "#2196F3",
    fontWeight: "600",
  },
  linkButton: {
    paddingVertical: 8,
    alignSelf: "center",
  },
  linkText: {
    fontSize: 15,
    color: "#2196F3",
  },
});
