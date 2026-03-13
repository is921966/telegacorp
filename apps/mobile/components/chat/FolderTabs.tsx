import { useRef, useEffect } from "react";
import { ScrollView, Pressable, Text, StyleSheet, View } from "react-native";
import type { TelegramFolder } from "@corp/shared";

interface FolderTabsProps {
  folders: TelegramFolder[];
  selectedId: number;
  onSelect: (id: number) => void;
}

/**
 * Horizontal folder tabs for filtering dialogs.
 * Includes "All" tab (id=0) plus user-defined folders.
 */
export function FolderTabs({ folders, selectedId, onSelect }: FolderTabsProps) {
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* "All" tab */}
        <FolderTab
          label="Все"
          isSelected={selectedId === 0}
          onPress={() => onSelect(0)}
        />

        {/* User folders */}
        {folders.map((folder) => (
          <FolderTab
            key={folder.id}
            label={folder.emoticon ? `${folder.emoticon} ${folder.title}` : folder.title}
            isSelected={selectedId === folder.id}
            unreadCount={folder.unreadCount}
            onPress={() => onSelect(folder.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function FolderTab({
  label,
  isSelected,
  unreadCount,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  unreadCount?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.tab, isSelected && styles.tabSelected]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, isSelected && styles.tabTextSelected]}>
        {label}
      </Text>
      {unreadCount != null && unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    backgroundColor: "#fff",
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
    gap: 6,
  },
  tabSelected: {
    backgroundColor: "#2196F3",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  tabTextSelected: {
    color: "#fff",
  },
  badge: {
    backgroundColor: "#fff",
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#2196F3",
  },
});
