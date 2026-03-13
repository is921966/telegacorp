import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { getPlatformConfig } from "@corp/shared";

interface MonitoringRule {
  id: string;
  keyword: string;
  action: "alert" | "block" | "log";
  scope: "all" | "work" | "specific";
  triggersToday: number;
}

/**
 * Monitoring screen — keyword monitoring, alerts, DLP rules.
 */
export default function MonitoringScreen() {
  const [rules, setRules] = useState<MonitoringRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    try {
      const { apiBaseUrl } = getPlatformConfig();
      const res = await fetch(`${apiBaseUrl}/api/admin/monitoring/rules`);
      if (res.ok) {
        const data = await res.json() as { rules: MonitoringRule[] };
        setRules(data.rules || []);
      }
    } catch (err) {
      console.error("[Admin] Load rules error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const actionLabel = (action: string) => {
    if (action === "alert") return "🔔 Оповещение";
    if (action === "block") return "🚫 Блокировка";
    return "📝 Логирование";
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Stats header */}
      <View style={styles.statsHeader}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{rules.length}</Text>
          <Text style={styles.statLabel}>Правил</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {rules.reduce((sum, r) => sum + r.triggersToday, 0)}
          </Text>
          <Text style={styles.statLabel}>Сегодня</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>
            {rules.filter((r) => r.action === "block").length}
          </Text>
          <Text style={styles.statLabel}>Блокировок</Text>
        </View>
      </View>

      {/* Rules list */}
      <Text style={styles.sectionTitle}>Правила мониторинга</Text>
      {rules.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Нет настроенных правил</Text>
        </View>
      ) : (
        rules.map((rule) => (
          <View key={rule.id} style={styles.ruleCard}>
            <View style={styles.ruleHeader}>
              <Text style={styles.keyword}>"{rule.keyword}"</Text>
              <Text style={styles.triggers}>
                {rule.triggersToday > 0 ? `${rule.triggersToday} ▲` : "—"}
              </Text>
            </View>
            <Text style={styles.ruleAction}>{actionLabel(rule.action)}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  statsHeader: {
    flexDirection: "row",
    backgroundColor: "#1a1a2e",
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 24, fontWeight: "bold", color: "#fff" },
  statLabel: { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  ruleCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    padding: 14,
    gap: 6,
  },
  ruleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  keyword: { fontSize: 16, fontWeight: "600", color: "#1a1a2e" },
  triggers: { fontSize: 14, color: "#d32f2f", fontWeight: "500" },
  ruleAction: { fontSize: 13, color: "#666" },
  empty: { paddingTop: 40, alignItems: "center" },
  emptyText: { fontSize: 16, color: "#999" },
});
