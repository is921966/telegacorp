import { useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
  ActivityIndicator,
  StatusBar,
  SafeAreaView,
  Share,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface MediaViewerProps {
  visible: boolean;
  imageUri: string | null;
  caption?: string;
  onClose: () => void;
}

/**
 * Full-screen media viewer modal for photos.
 * Displays image with caption, share button, and close button.
 */
export function MediaViewer({
  visible,
  imageUri,
  caption,
  onClose,
}: MediaViewerProps) {
  const [isLoading, setIsLoading] = useState(true);

  const handleShare = useCallback(async () => {
    if (!imageUri) return;
    try {
      await Share.share({
        url: imageUri,
        message: caption || undefined,
      });
    } catch (err) {
      console.warn("[MediaViewer] Share error:", err);
    }
  }, [imageUri, caption]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Header */}
        <SafeAreaView style={styles.header}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
          <Pressable style={styles.shareButton} onPress={handleShare}>
            <Text style={styles.shareText}>↗</Text>
          </Pressable>
        </SafeAreaView>

        {/* Image */}
        <View style={styles.imageContainer}>
          {imageUri ? (
            <>
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="contain"
                onLoadStart={() => setIsLoading(true)}
                onLoadEnd={() => setIsLoading(false)}
              />
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
            </>
          ) : (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
          )}
        </View>

        {/* Caption */}
        {caption && (
          <SafeAreaView style={styles.captionContainer}>
            <Text style={styles.caption} numberOfLines={3}>
              {caption}
            </Text>
          </SafeAreaView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  shareText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#fff",
    fontSize: 14,
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  caption: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 20,
  },
});
