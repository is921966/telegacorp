import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  SafeAreaView,
  Text,
  Pressable,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  useAuthStore,
  connectClient,
  getMe,
  checkPasswordForMobileQr,
  getPasswordHint,
} from "@corp/shared";
import { useSession } from "../../components/providers/SessionProvider";
import { PasswordInput } from "../../components/auth/PasswordInput";

/**
 * 2FA password screen — shown when Telegram account has two-step verification.
 * Can be reached from either QR auth or phone auth flow.
 */
export default function PasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ hint?: string }>();
  const { persistSession } = useSession();
  const { setTelegramUser, setTelegramConnected, setTelegramAuthState } =
    useAuthStore();

  const [hint, setHint] = useState<string | undefined>(params.hint || undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch password hint if not passed via params
  useEffect(() => {
    if (hint) return;

    async function fetchHint() {
      try {
        const client = await connectClient("");
        const h = await getPasswordHint(client);
        setHint(h);
      } catch {
        // Ignore — hint is optional
      }
    }
    fetchHint();
  }, [hint]);

  const handleSubmit = async (password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const client = await connectClient("");

      // Check password via SRP (GramJS handles the crypto)
      await checkPasswordForMobileQr(client, password);

      // Get user info
      const me = await getMe(client);

      setTelegramUser(me);
      setTelegramConnected(true);
      setTelegramAuthState({ step: "done" });

      // Persist session
      await persistSession();

      // Navigate to main app (replace entire auth stack)
      router.replace("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неверный пароль";
      const rpcErr = err as { errorMessage?: string };

      if (rpcErr.errorMessage === "PASSWORD_HASH_INVALID") {
        setError("Неверный пароль. Попробуйте ещё раз.");
      } else if (rpcErr.errorMessage === "SRP_ID_INVALID") {
        // SRP session expired — retry
        setError("Сессия истекла. Попробуйте ещё раз.");
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>

        <View style={styles.passwordContainer}>
          <PasswordInput
            hint={hint}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            error={error}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  backButton: {
    paddingVertical: 8,
    marginBottom: 32,
    alignSelf: "flex-start",
  },
  backText: {
    fontSize: 16,
    color: "#2196F3",
    fontWeight: "500",
  },
  passwordContainer: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 80,
  },
});
