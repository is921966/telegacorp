import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useSession } from "../../components/providers/SessionProvider";

/**
 * Login screen — entry point for unauthenticated users.
 *
 * Flow:
 * 1. Auto-sign into Supabase anonymously (done in SessionProvider)
 * 2. User taps "Connect Telegram" → navigates to telegram auth screen
 */
export default function LoginScreen() {
  const router = useRouter();
  const { isSupabaseReady } = useSession();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleConnectTelegram = () => {
    setIsNavigating(true);
    router.push("/(auth)/telegram");
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>TC</Text>
        </View>
        <Text style={styles.title}>Telegram Corp</Text>
        <Text style={styles.subtitle}>
          Корпоративный Telegram-клиент
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.featureList}>
          <FeatureItem icon="🔒" text="Безопасный корпоративный доступ" />
          <FeatureItem icon="👥" text="Разделение личного и рабочего" />
          <FeatureItem icon="📊" text="Админ-панель и аудит" />
          <FeatureItem icon="🤖" text="AI-агенты для автоматизации" />
        </View>
      </View>

      <View style={styles.footer}>
        {!isSupabaseReady ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#2196F3" />
            <Text style={styles.loadingText}>Подключение...</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.button, isNavigating && styles.buttonDisabled]}
            onPress={handleConnectTelegram}
            disabled={isNavigating}
          >
            {isNavigating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Подключить Telegram</Text>
            )}
          </Pressable>
        )}

        <Text style={styles.disclaimer}>
          Войдите через Telegram, чтобы начать работу
        </Text>
      </View>
    </View>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  featureList: {
    gap: 20,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureIcon: {
    fontSize: 24,
  },
  featureText: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  footer: {
    gap: 16,
    alignItems: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 56,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  button: {
    backgroundColor: "#2196F3",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#90CAF9",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  disclaimer: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
  },
});
