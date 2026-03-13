import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { getPlatformConfig } from "@corp/shared";

interface AnalyticsData {
  totalMessages: number;
  totalChats: number;
  activeUsers: number;
  avgResponseTime: number;
  topChats: { title: string; messageCount: number }[];
  dailyMessages: { date: string; count: number }[];
}

/**
 * Analytics dashboard — workspace statistics and activity metrics.
 */
export default function AnalyticsScreen() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      const { apiBaseUrl } = getPlatformConfig();
      const res = await fetch(`${apiBaseUrl}/api/admin/analytics`);
      if (res.ok) {
        const json = await res.json() as AnalyticsData;
        setData(json);
      }
    } catch (err) {
      console.error("[Admin] Load analytics error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Key metrics */}
      <View style={styles.metricsGrid}>
        <MetricCard label="Сообщений" value={formatNumber(data.totalMessages)} icon="📨" />
        <MetricCard label="Чатов" value={String(data.totalChats)} icon="💬" />
        <MetricCard label="Активных" value={String(data.activeUsers)} icon="👥" />
        <MetricCard
          label="Отклик"
          value={`${data.avgResponseTime}м`}
          icon="⏱"
        />
      </View>

      {/* Top chats */}
      <Text style={styles.sectionTitle}>Самые активные чаты</Text>
      {data.topChats.map((chat, i) => (
        <View key={i} style={styles.topChat}>
          <Text style={styles.topChatRank}>#{i + 1}</Text>
          <Text style={styles.topChatTitle} numberOfLines={1}>
            {chat.title}
          </Text>
          <Text style={styles.topChatCount}>
            {formatNumber(chat.messageCount)}
          </Text>
        </View>
      ))}

      {/* Daily chart placeholder */}
      <Text style={styles.sectionTitle}>Активность за неделю</Text>
      <View style={styles.chartContainer}>
        <View style={styles.chartBars}>
          {data.dailyMessages.slice(-7).map((day, i) => {
            const maxCount = Math.max(
              ...data.dailyMessages.map((d) => d.count),
              1
            );
            const height = (day.count / maxCount) * 100;
            return (
              <View key={i} style={styles.barColumn}>
                <View
                  style={[styles.bar, { height: Math.max(height, 4) }]}
                />
                <Text style={styles.barLabel}>
                  {new Date(day.date).toLocaleDateString("ru", {
                    weekday: "short",
                  })}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}М`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}К`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 12,
  },
  metricCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricIcon: { fontSize: 24 },
  metricValue: { fontSize: 28, fontWeight: "bold", color: "#1a1a2e" },
  metricLabel: { fontSize: 13, color: "#999" },
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
  topChat: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  topChatRank: { fontSize: 14, fontWeight: "bold", color: "#2196F3", width: 24 },
  topChatTitle: { flex: 1, fontSize: 15, color: "#1a1a2e" },
  topChatCount: { fontSize: 14, color: "#999", fontWeight: "500" },
  chartContainer: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 14,
    padding: 16,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 120,
  },
  barColumn: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  bar: {
    width: 24,
    borderRadius: 4,
    backgroundColor: "#2196F3",
  },
  barLabel: {
    fontSize: 11,
    color: "#999",
  },
});
