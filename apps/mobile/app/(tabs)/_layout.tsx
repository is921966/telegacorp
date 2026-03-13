import { Tabs } from "expo-router";
import { useColorScheme, Platform } from "react-native";

/**
 * Main tab navigation — shown after authentication.
 * Tabs: Chats, Contacts, Calls, Settings
 */
export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2196F3",
        tabBarInactiveTintColor: isDark ? "#888" : "#999",
        tabBarStyle: {
          backgroundColor: isDark ? "#1a1a2e" : "#fff",
          borderTopColor: isDark ? "#2a2a4a" : "#e5e5e5",
          paddingBottom: Platform.OS === "ios" ? 0 : 4,
        },
        headerStyle: {
          backgroundColor: isDark ? "#1a1a2e" : "#fff",
        },
        headerTintColor: isDark ? "#fff" : "#000",
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Чаты",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="chat" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Контакты",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="contacts" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: "Звонки",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calls" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Настройки",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

/**
 * Simple text-based tab icons (emoji).
 * Replace with react-native-vector-icons or SF Symbols later.
 */
import { Text } from "react-native";

function TabIcon({
  name,
  color,
  size,
}: {
  name: "chat" | "contacts" | "calls" | "settings";
  color: string;
  size: number;
}) {
  const icons: Record<string, string> = {
    chat: "💬",
    contacts: "👤",
    calls: "📞",
    settings: "⚙️",
  };

  return (
    <Text style={{ fontSize: size - 4, color }}>{icons[name] || "?"}</Text>
  );
}
