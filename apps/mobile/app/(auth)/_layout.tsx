import { Stack } from "expo-router";

/**
 * Auth layout — wraps all authentication screens.
 * Shown when the user is not yet authenticated (no Telegram session).
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#fff" },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="telegram" />
      <Stack.Screen name="password" />
    </Stack>
  );
}
