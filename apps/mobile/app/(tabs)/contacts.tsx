import { useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useContacts, type TelegramContact } from "@corp/shared";

/**
 * Contacts tab — shows Telegram contacts sorted alphabetically.
 */
export default function ContactsScreen() {
  const { contacts, isLoading } = useContacts();

  // Sort alphabetically
  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) =>
      (a.firstName + " " + (a.lastName || "")).localeCompare(
        b.firstName + " " + (b.lastName || ""),
        "ru"
      )
    );
  }, [contacts]);

  if (isLoading && contacts.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Загрузка контактов...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={sortedContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ContactItem contact={item} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👤</Text>
            <Text style={styles.emptyText}>Нет контактов</Text>
          </View>
        }
      />
    </View>
  );
}

function ContactItem({ contact }: { contact: TelegramContact }) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  const initials = getInitials(name);

  return (
    <Pressable
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View style={[styles.avatar, { backgroundColor: getColor(contact.id) }]}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {contact.username && (
          <Text style={styles.username} numberOfLines={1}>
            @{contact.username}
          </Text>
        )}
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
  name: { fontSize: 16, fontWeight: "500", color: "#1a1a2e" },
  username: { fontSize: 14, color: "#999" },
});
