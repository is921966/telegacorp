import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { getPlatformConfig } from "@corp/shared";

interface AdminMember {
  telegram_id: string;
  display_name: string;
  role: string;
  status: "active" | "suspended";
  last_active?: string;
}

/**
 * Admin members management — view and manage admin users and roles.
 */
export default function AdminMembersScreen() {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      const { apiBaseUrl } = getPlatformConfig();
      const res = await fetch(`${apiBaseUrl}/api/admin/members`);
      if (res.ok) {
        const data = await res.json() as { members: AdminMember[] };
        setMembers(data.members || []);
      }
    } catch (err) {
      console.error("[Admin] Load members error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredMembers = search.trim()
    ? members.filter((m) =>
        m.display_name.toLowerCase().includes(search.toLowerCase())
      )
    : members;

  const roleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: "Супер-админ",
      chat_manager: "Менеджер чатов",
      viewer: "Наблюдатель",
      agent_manager: "Менеджер агентов",
      compliance_officer: "Комплаенс",
    };
    return labels[role] || role;
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
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск по имени..."
          placeholderTextColor="#999"
          clearButtonMode="while-editing"
        />
      </View>

      <FlashList
        data={filteredMembers}
        keyExtractor={(item) => item.telegram_id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.name}>{item.display_name}</Text>
              <Text style={styles.role}>
                {roleLabel(item.role)}
                {item.status === "suspended" ? " • ⛔ Приостановлен" : ""}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Нет администраторов</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5e5",
  },
  input: {
    fontSize: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    color: "#1a1a2e",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  rowContent: { flex: 1, gap: 4 },
  name: { fontSize: 16, fontWeight: "500", color: "#1a1a2e" },
  role: { fontSize: 13, color: "#999" },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { fontSize: 16, color: "#999" },
});
