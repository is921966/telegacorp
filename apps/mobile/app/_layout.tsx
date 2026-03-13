import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme, View, ActivityIndicator, StyleSheet } from "react-native";
import { initMobilePlatform } from "../lib/platform-init";
import { SessionProvider, useSession } from "../components/providers/SessionProvider";

// Initialize @corp/shared platform layer (must happen before any shared imports)
initMobilePlatform();

/**
 * Auth guard — redirects based on authentication state.
 * - Not authenticated → /(auth)/login
 * - Authenticated → / (main app)
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isRestoring, isTelegramReady } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isRestoring) return; // Still loading

    const inAuthGroup = segments[0] === "(auth)";

    if (!isTelegramReady && !inAuthGroup) {
      // Not authenticated — redirect to login
      router.replace("/(auth)/login");
    } else if (isTelegramReady && inAuthGroup) {
      // Already authenticated — redirect to main
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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SessionProvider>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
      <AuthGuard>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colorScheme === "dark" ? "#1a1a2e" : "#ffffff",
            },
            headerTintColor: colorScheme === "dark" ? "#ffffff" : "#000000",
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
        </Stack>
      </AuthGuard>
    </SessionProvider>
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
