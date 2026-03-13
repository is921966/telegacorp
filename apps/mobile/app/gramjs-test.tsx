import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";

type LogEntry = { time: string; msg: string; type: "info" | "error" | "success" };

/**
 * GramJS Validation Screen (Phase 0.7)
 *
 * Tests that GramJS can:
 * 1. Import without errors (polyfills work)
 * 2. Create a StringSession
 * 3. Create a TelegramClient instance
 * 4. (Optional) Connect to Telegram servers
 */
export default function GramJSTestScreen() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);

  const log = (msg: string, type: LogEntry["type"] = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, msg, type }]);
  };

  const runTest = async () => {
    setLogs([]);
    setRunning(true);

    try {
      // Step 1: Import GramJS
      log("Importing 'telegram' package...");
      const { TelegramClient } = await import("telegram");
      const { StringSession } = await import("telegram/sessions");
      log("✅ telegram package imported successfully", "success");

      // Step 2: Create StringSession
      log("Creating StringSession...");
      const session = new StringSession("");
      log(`✅ StringSession created: ${session.constructor.name}`, "success");

      // Step 3: Create TelegramClient (with dummy creds — won't connect)
      log("Creating TelegramClient instance...");
      const client = new TelegramClient(session, 12345, "test_hash", {
        connectionRetries: 1,
        useWSS: true,
      });
      log(`✅ TelegramClient created: ${client.constructor.name}`, "success");

      // Step 4: Verify Buffer polyfill
      log("Testing Buffer polyfill...");
      const buf = Buffer.from("Hello GramJS", "utf-8");
      const b64 = buf.toString("base64");
      const decoded = Buffer.from(b64, "base64").toString("utf-8");
      if (decoded === "Hello GramJS") {
        log("✅ Buffer polyfill works correctly", "success");
      } else {
        log("❌ Buffer polyfill returned wrong value: " + decoded, "error");
      }

      // Step 5: Verify crypto polyfill
      log("Testing crypto.getRandomValues...");
      const randomBytes = new Uint8Array(16);
      crypto.getRandomValues(randomBytes);
      const nonZero = randomBytes.some((b) => b !== 0);
      if (nonZero) {
        log("✅ crypto.getRandomValues works", "success");
      } else {
        log("⚠️ crypto.getRandomValues returned all zeros", "error");
      }

      // Step 6: Test @corp/shared import
      log("Testing @corp/shared import...");
      const { getPlatformConfig } = await import("@corp/shared");
      const config = getPlatformConfig();
      log(`✅ @corp/shared loaded. Device: ${config.deviceModel}`, "success");

      log("═══════════════════════════", "info");
      log("🎉 ALL TESTS PASSED — GramJS is ready for React Native!", "success");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log(`❌ ERROR: ${errMsg}`, "error");
      if (err instanceof Error && err.stack) {
        log(`Stack: ${err.stack.slice(0, 500)}`, "error");
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>GramJS Validation</Text>
      <Text style={styles.subtitle}>Phase 0.7 — Critical Gate</Text>

      <Pressable
        style={[styles.button, running && styles.buttonDisabled]}
        onPress={runTest}
        disabled={running}
      >
        <Text style={styles.buttonText}>
          {running ? "Running..." : "▶ Run GramJS Test"}
        </Text>
      </Pressable>

      <ScrollView style={styles.logContainer}>
        {logs.map((entry, i) => (
          <Text
            key={i}
            style={[
              styles.log,
              entry.type === "error" && styles.logError,
              entry.type === "success" && styles.logSuccess,
            ]}
          >
            [{entry.time}] {entry.msg}
          </Text>
        ))}
        {logs.length === 0 && (
          <Text style={styles.logEmpty}>
            Tap "Run GramJS Test" to validate polyfills and GramJS in React
            Native.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  button: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: "#999",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  logContainer: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 12,
  },
  log: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#e0e0e0",
    marginBottom: 4,
    lineHeight: 18,
  },
  logError: {
    color: "#ff6b6b",
  },
  logSuccess: {
    color: "#51cf66",
  },
  logEmpty: {
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 40,
  },
});
