import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { useDialogs, useFoldersStore, type TelegramDialog } from "@corp/shared";
import { ChatListItem } from "../../components/chat/ChatListItem";
import { FolderTabs } from "../../components/chat/FolderTabs";

/**
 * Chat list screen — main tab showing all Telegram dialogs.
 * Features:
 * - FlashList for performant rendering of 2000+ dialogs
 * - Pull-to-refresh
 * - Infinite scroll (load more)
 * - Folder tabs (All, Personal, Work, etc.)
 */
export default function ChatListScreen() {
  const router = useRouter();
  const {
    dialogs,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadDialogs,
    loadMore,
  } = useDialogs();

  const { folders } = useFoldersStore();
  const [selectedFolderId, setSelectedFolderId] = useState(0); // 0 = All
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter dialogs by folder
  const filteredDialogs = useMemo(() => {
    if (selectedFolderId === 0) return dialogs;

    const folder = folders.find((f) => f.id === selectedFolderId);
    if (!folder) return dialogs;

    return dialogs.filter((d) => {
      // Check explicit includes
      if (folder.includePeerIds.includes(d.id)) return true;

      // Check explicit excludes
      if (folder.excludePeerIds.includes(d.id)) return false;

      // Check category flags
      if (folder.flags.contacts && d.type === "user") return true;
      if (folder.flags.groups && d.type === "group") return true;
      if (folder.flags.broadcasts && d.type === "channel") return true;
      if (folder.flags.bots && d.isBot) return true;

      // Check exclude filters
      if (folder.flags.excludeMuted && d.isMuted) return false;
      if (folder.flags.excludeRead && d.unreadCount === 0) return false;

      return false;
    });
  }, [dialogs, folders, selectedFolderId]);

  // Sorted: pinned first, then by last message date
  const sortedDialogs = useMemo(() => {
    return [...filteredDialogs].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      const aTime = a.lastMessage?.date
        ? new Date(a.lastMessage.date).getTime()
        : 0;
      const bTime = b.lastMessage?.date
        ? new Date(b.lastMessage.date).getTime()
        : 0;
      return bTime - aTime;
    });
  }, [filteredDialogs]);

  const handleChatPress = useCallback(
    (chatId: string) => {
      router.push(`/chat/${chatId}`);
    },
    [router]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadDialogs();
    setIsRefreshing(false);
  }, [loadDialogs]);

  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // ── Loading state ──
  if (isLoading && dialogs.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Загрузка чатов...</Text>
      </View>
    );
  }

  // ── Error state ──
  if (error && dialogs.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Folder tabs */}
      {folders.length > 0 && (
        <FolderTabs
          folders={folders}
          selectedId={selectedFolderId}
          onSelect={setSelectedFolderId}
        />
      )}

      {/* Dialog list */}
      <FlashList
        data={sortedDialogs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatListItem dialog={item} onPress={handleChatPress} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#2196F3"
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color="#2196F3" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>Нет чатов</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  errorIcon: {
    fontSize: 48,
  },
  errorText: {
    fontSize: 16,
    color: "#d32f2f",
    textAlign: "center",
    paddingHorizontal: 32,
  },
  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 100,
    alignItems: "center",
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
  },
});
