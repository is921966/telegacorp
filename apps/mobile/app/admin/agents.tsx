import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Switch,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { getPlatformConfig } from "@corp/shared";

interface Agent {
  id: string;
  name: string;
  model: string;
  status: "active" | "paused" | "error";
  messagesProcessed: number;
  lastActive?: string;
}

/**
 * AI Agents management screen — view and control AI agents.
 */
export default function AgentsScreen() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAgents();
  }, []);

  async function loadAgents() {
    try {
      const { apiBaseUrl } = getPlatformConfig();
      const res = await fetch(`${apiBaseUrl}/api/admin/agents`);
      if (res.ok) {
        const data = await res.json() as { agents: Agent[] };
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error("[Admin] Load agents error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const statusColor = (status: string) => {
    if (status === "active") return "#4CAF50";
    if (status === "paused") return "#FF9800";
    return "#d32f2f";
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
        data={agents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: statusColor(item.status) },
                  ]}
                />
                <Text style={styles.agentName}>{item.name}</Text>
              </View>
              <Switch value={item.status === "active"} disabled />
            </View>
            <Text style={styles.model}>{item.model}</Text>
            <View style={styles.statsRow}>
              <Text style={styles.stat}>
                📨 {item.messagesProcessed} обработано
              </Text>
              {item.lastActive && (
                <Text style={styles.stat}>
                  🕐 {new Date(item.lastActive).toLocaleDateString("ru")}
                </Text>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤖</Text>
            <Text style={styles.emptyText}>Нет настроенных агентов</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  agentName: { fontSize: 17, fontWeight: "600", color: "#1a1a2e" },
  model: { fontSize: 14, color: "#666" },
  statsRow: { flexDirection: "row", gap: 16 },
  stat: { fontSize: 13, color: "#999" },
  empty: { paddingTop: 80, alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: "#999" },
});
