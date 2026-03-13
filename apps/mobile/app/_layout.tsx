import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";
import { initMobilePlatform } from "../lib/platform-init";

// Initialize @corp/shared platform layer
initMobilePlatform();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
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
      </Stack>
    </>
  );
}
