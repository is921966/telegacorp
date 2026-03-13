import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { getPlatformConfig, type AuditLogEntry } from "@corp/shared";

/**
 * Audit log screen — shows admin action history.
 */
export default function AuditScreen() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAudit();
  }, []);

  async function loadAudit() {
    try {
      const { apiBaseUrl } = getPlatformConfig();
      const res = await fetch(`${apiBaseUrl}/api/admin/audit?limit=50`);
      if (res.ok) {
        const data = await res.json() as { entries: AuditLogEntry[] };
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error("[Admin] Load audit error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const statusIcon = (status: string) => {
    if (status === "success") return "✅";
    if (status === "error") return "❌";
    return "⚠️";
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={entries}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.statusIcon}>{statusIcon(item.result_status)}</Text>
            <View style={styles.rowContent}>
              <Text style={styles.action} numberOfLines={1}>
                {item.action_type}
              </Text>
              <Text style={styles.meta}>
                {new Date(item.created_at).toLocaleString("ru")}
                {item.target_chat_id ? ` • Чат: ${item.target_chat_id}` : ""}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Журнал пуст</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  statusIcon: { fontSize: 18 },
  rowContent: { flex: 1, gap: 4 },
  action: { fontSize: 15, fontWeight: "500", color: "#1a1a2e" },
  meta: { fontSize: 12, color: "#999" },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { fontSize: 16, color: "#999" },
});
