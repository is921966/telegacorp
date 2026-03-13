import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import * as Network from "expo-network";

/**
 * Offline banner — shows a persistent banner when device is offline.
 * Auto-hides when connectivity is restored.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const opacity = useState(new Animated.Value(0))[0];

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    async function check() {
      try {
        const state = await Network.getNetworkStateAsync();
        const offline = !(state.isConnected && state.isInternetReachable);
        setIsOffline(offline);
      } catch {
        // Ignore — can't check means likely offline
      }
    }

    check();
    interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOffline ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.banner, { opacity }]}>
      <Text style={styles.text}>Нет подключения к интернету</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#d32f2f",
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "500",
  },
});
