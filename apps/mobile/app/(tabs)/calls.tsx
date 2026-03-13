import { useMemo } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useCalls, type TelegramCallRecord } from "@corp/shared";

/**
 * Calls tab — shows recent call history.
 */
export default function CallsScreen() {
  const { calls, isLoading } = useCalls();

  const sortedCalls = useMemo(() => {
    return [...calls].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [calls]);

  if (isLoading && calls.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Загрузка звонков...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={sortedCalls}
        keyExtractor={(item, index) => `${item.userId}-${index}`}
        renderItem={({ item }) => <CallItem call={item} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📞</Text>
            <Text style={styles.emptyText}>Нет звонков</Text>
          </View>
        }
      />
    </View>
  );
}

function CallItem({ call }: { call: TelegramCallRecord }) {
  const isOutgoing = call.isOutgoing;
  const isMissed = !call.duration || call.duration === 0;

  const icon = isOutgoing
    ? "📱↗"
    : isMissed
    ? "📱❌"
    : "📱↙";

  const timeStr = new Date(call.date).toLocaleTimeString("ru", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const dateStr = formatCallDate(new Date(call.date));

  const durationStr = call.duration
    ? formatDuration(call.duration)
    : "Не отвечен";

  return (
    <View style={styles.item}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.itemContent}>
        <Text
          style={[styles.name, isMissed && !isOutgoing && styles.nameMissed]}
          numberOfLines={1}
        >
          {call.userName || "Неизвестный"}
        </Text>
        <Text style={styles.meta}>
          {dateStr}, {timeStr} • {durationStr}
          {call.isVideo ? " • Видео" : ""}
        </Text>
      </View>
    </View>
  );
}

function formatCallDate(date: Date): string {
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return date.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}с`;
  return `${m}м ${s}с`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
  },
  loadingText: { fontSize: 16, color: "#666" },
  emptyContainer: { flex: 1, paddingTop: 100, alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: "#999" },
  item: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  icon: { fontSize: 20 },
  itemContent: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: "500", color: "#1a1a2e" },
  nameMissed: { color: "#d32f2f" },
  meta: { fontSize: 13, color: "#999" },
});
