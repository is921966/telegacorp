import { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useChatsStore, type TelegramDialog } from "@corp/shared";

/**
 * Admin chats management — list of workspace chats with admin actions.
 * Shows chat title, member count, unread, and quick actions.
 */
export default function AdminChatsScreen() {
  const { dialogs, isLoading } = useChatsStore();
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter by group/channel only + search
  const filteredChats = useMemo(() => {
    const groupsAndChannels = dialogs.filter(
      (d) => d.type === "group" || d.type === "channel"
    );
    if (!search.trim()) return groupsAndChannels;
    const q = search.toLowerCase().trim();
    return groupsAndChannels.filter((d) =>
      d.title.toLowerCase().includes(q)
    );
  }, [dialogs, search]);

  if (isLoading && dialogs.length === 0) {
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
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Поиск чатов..."
          placeholderTextColor="#999"
          clearButtonMode="while-editing"
        />
      </View>

      <FlashList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatAdminRow chat={item} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Нет рабочих чатов</Text>
          </View>
        }
      />
    </View>
  );
}

function ChatAdminRow({ chat }: { chat: TelegramDialog }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowContent}>
        <Text style={styles.chatTitle} numberOfLines={1}>
          {chat.type === "channel" ? "📢" : "👥"} {chat.title}
        </Text>
        <Text style={styles.chatMeta}>
          {chat.participantsCount
            ? `${chat.participantsCount} участников`
            : chat.type === "channel"
            ? "Канал"
            : "Группа"}
          {chat.unreadCount > 0 ? ` • ${chat.unreadCount} непрочит.` : ""}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
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
  searchInput: {
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
  rowPressed: { backgroundColor: "#f8f8f8" },
  rowContent: { flex: 1, gap: 4 },
  chatTitle: { fontSize: 16, fontWeight: "500", color: "#1a1a2e" },
  chatMeta: { fontSize: 13, color: "#999" },
  chevron: { fontSize: 22, color: "#ccc" },
  empty: { paddingTop: 60, alignItems: "center" },
  emptyText: { fontSize: 16, color: "#999" },
});
