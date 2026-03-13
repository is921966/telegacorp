import { View, Text, Pressable, StyleSheet } from "react-native";
import { Link } from "expo-router";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Telegram Corp</Text>
      <Text style={styles.subtitle}>iOS Mobile App</Text>
      <Text style={styles.version}>v0.1.0 • Expo SDK 55</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Phase 0 — Validation</Text>

        <Link href="/gramjs-test" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>🔌 Test GramJS Connection</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status</Text>
        <Text style={styles.status}>✅ Polyfills loaded</Text>
        <Text style={styles.status}>✅ @corp/shared imported</Text>
        <Text style={styles.status}>✅ Expo Router working</Text>
        <Text style={styles.status}>⏳ GramJS connection — tap test above</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 40,
  },
  subtitle: {
    fontSize: 18,
    color: "#666",
    marginTop: 4,
  },
  version: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    color: "#333",
  },
  button: {
    backgroundColor: "#2196F3",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  status: {
    fontSize: 14,
    marginBottom: 6,
    color: "#444",
  },
});
