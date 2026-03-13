import { Stack } from "expo-router";

/**
 * Admin panel layout — navigation stack for admin screens.
 */
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1a1a2e" },
        headerTintColor: "#fff",
        contentStyle: { backgroundColor: "#f5f5f5" },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Админ-панель" }} />
      <Stack.Screen name="chats" options={{ title: "Чаты" }} />
      <Stack.Screen name="members" options={{ title: "Участники" }} />
      <Stack.Screen name="audit" options={{ title: "Аудит" }} />
      <Stack.Screen name="policies" options={{ title: "Политики" }} />
      <Stack.Screen name="agents" options={{ title: "AI-Агенты" }} />
      <Stack.Screen name="monitoring" options={{ title: "Мониторинг" }} />
      <Stack.Screen name="templates" options={{ title: "Шаблоны" }} />
      <Stack.Screen name="analytics" options={{ title: "Аналитика" }} />
    </Stack>
  );
}
