import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import QRCode from "react-native-qrcode-svg";

interface QrCodeDisplayProps {
  /** tg:// login URL to encode as QR */
  url: string | null;
  /** Whether the QR is loading */
  isLoading?: boolean;
  /** Error message to show instead of QR */
  error?: string | null;
  /** Size of the QR code */
  size?: number;
}

/**
 * QR code display component for Telegram QR login.
 * Renders the tg://login?token=... URL as a scannable QR.
 */
export function QrCodeDisplay({
  url,
  isLoading,
  error,
  size = 220,
}: QrCodeDisplayProps) {
  if (error) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (isLoading || !url) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Загрузка QR-кода...</Text>
      </View>
    );
  }

  return (
    <View style={styles.qrWrapper}>
      <View style={styles.qrBorder}>
        <QRCode
          value={url}
          size={size}
          backgroundColor="white"
          color="#1a1a2e"
          ecl="M"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    gap: 12,
    padding: 16,
  },
  qrWrapper: {
    alignItems: "center",
  },
  qrBorder: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
  errorIcon: {
    fontSize: 32,
  },
  errorText: {
    fontSize: 14,
    color: "#d32f2f",
    textAlign: "center",
  },
});
