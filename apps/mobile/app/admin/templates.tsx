import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { getPlatformConfig } from "@corp/shared";

interface Template {
  id: string;
  name: string;
  description: string;
  appliedCount: number;
  createdAt: string;
}

/**
 * Policy templates screen — predefined policy configurations.
 */
export default function TemplatesScreen() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const { apiBaseUrl } = getPlatformConfig();
      const res = await fetch(`${apiBaseUrl}/api/admin/templates`);
      if (res.ok) {
        const data = await res.json() as { templates: Template[] };
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("[Admin] Load templates error:", err);
    } finally {
      setIsLoading(false);
    }
  }

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
        data={templates}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>
                Применен: {item.appliedCount} раз
              </Text>
              <Text style={styles.meta}>
                {new Date(item.createdAt).toLocaleDateString("ru")}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>Нет шаблонов</Text>
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
  },
  cardPressed: { backgroundColor: "#f8f8f8" },
  name: { fontSize: 17, fontWeight: "600", color: "#1a1a2e" },
  description: { fontSize: 14, color: "#666", lineHeight: 20 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  meta: { fontSize: 12, color: "#999" },
  empty: { paddingTop: 80, alignItems: "center", gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 16, color: "#999" },
});
