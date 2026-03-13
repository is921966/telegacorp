import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { initMobilePlatform } from "../lib/platform-init";
import { SessionProvider, useSession } from "../components/providers/SessionProvider";
import { ThemeProvider, useTheme } from "../components/providers/ThemeProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { OfflineBanner } from "../components/OfflineBanner";
import { useReconnect } from "../hooks/useReconnect";

// Initialize @corp/shared platform layer (must happen before any shared imports)
initMobilePlatform();

/**
 * Auth guard — redirects based on authentication state.
 * Also reconnects GramJS when app returns from background.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isRestoring, isTelegramReady } = useSession();
  const segments = useSegments();
  const router = useRouter();

  // Auto-reconnect GramJS on foreground
  useReconnect();

  useEffect(() => {
    if (isRestoring) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!isTelegramReady && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isTelegramReady && inAuthGroup) {
      router.replace("/");
    }
  }, [isRestoring, isTelegramReady, segments]);

  if (isRestoring) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Inner layout — uses theme context for header styling.
 */
function InnerLayout() {
  const { isDark, colors } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <OfflineBanner />
      <AuthGuard>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.text,
          }}
        >
          <Stack.Screen name="index" options={{ title: "Telegram Corp" }} />
          <Stack.Screen name="gramjs-test" options={{ title: "GramJS Test" }} />
          <Stack.Screen
            name="(auth)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="chat/[chatId]"
            options={{
              headerBackTitle: "Назад",
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="search"
            options={{
              title: "Поиск",
              headerBackTitle: "Назад",
              animation: "slide_from_right",
            }}
          />
          <Stack.Screen
            name="admin"
            options={{ headerShown: false }}
          />
        </Stack>
      </AuthGuard>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary fallbackTitle="Ошибка приложения">
      <ThemeProvider>
        <SessionProvider>
          <InnerLayout />
        </SessionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
});
