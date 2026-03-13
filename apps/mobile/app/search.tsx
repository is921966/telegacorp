import { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter, Stack } from "expo-router";
import {
  useChatsStore,
  type TelegramDialog,
} from "@corp/shared";

/**
 * Global search screen — searches across chats by title and message content.
 * Accessible from the chat list header.
 */
export default function SearchScreen() {
  const router = useRouter();
  const { dialogs } = useChatsStore();

  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Local search: filter dialogs by title match
  const results = query.trim().length >= 2
    ? dialogs.filter((d) =>
        d.title.toLowerCase().includes(query.toLowerCase().trim())
      )
    : [];

  const handleSelect = useCallback(
    (chatId: string) => {
      router.push(`/chat/${chatId}`);
    },
    [router]
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Поиск",
          headerBackTitle: "Назад",
        }}
      />
      <SafeAreaView style={styles.container}>
        {/* Search input */}
        <View style={styles.searchBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Поиск чатов и сообщений..."
            placeholderTextColor="#999"
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>

        {/* Results */}
        {query.trim().length < 2 ? (
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              Введите минимум 2 символа для поиска
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.hint}>
            <Text style={styles.hintIcon}>🔍</Text>
            <Text style={styles.hintText}>Ничего не найдено</Text>
          </View>
        ) : (
          <FlashList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SearchResultItem dialog={item} onPress={handleSelect} />
            )}
          />
        )}
      </SafeAreaView>
    </>
  );
}

function SearchResultItem({
  dialog,
  onPress,
}: {
  dialog: TelegramDialog;
  onPress: (id: string) => void;
}) {
  const initials = getInitials(dialog.title);

  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
      onPress={() => onPress(dialog.id)}
    >
      <View style={[styles.avatar, { backgroundColor: getColor(dialog.id) }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {dialog.title}
        </Text>
        <Text style={styles.itemSubtitle} numberOfLines={1}>
          {dialog.type === "channel"
            ? "Канал"
            : dialog.type === "group"
            ? `Группа${dialog.participantsCount ? ` • ${dialog.participantsCount} участников` : ""}`
            : dialog.lastMessage?.text || ""}
        </Text>
      </View>
    </Pressable>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || "?").toUpperCase();
}

const COLORS = [
  "#F44336", "#E91E63", "#9C27B0", "#3F51B5",
  "#2196F3", "#009688", "#4CAF50", "#FF9800",
];

function getColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
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
  hint: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingBottom: 100,
  },
  hintIcon: { fontSize: 40 },
  hintText: { fontSize: 16, color: "#999" },
  item: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: "#fff",
  },
  itemPressed: { backgroundColor: "#f5f5f5" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  itemContent: { flex: 1, justifyContent: "center", gap: 2 },
  itemTitle: { fontSize: 16, fontWeight: "500", color: "#1a1a2e" },
  itemSubtitle: { fontSize: 14, color: "#999" },
});
