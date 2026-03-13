import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

interface PhoneInputProps {
  onSubmit: (phone: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Phone number input for Telegram auth fallback (when QR isn't available).
 * Normalizes input: strips spaces/dashes, prepends + if missing.
 */
export function PhoneInput({ onSubmit, isLoading, error }: PhoneInputProps) {
  const [phone, setPhone] = useState("+");
  const inputRef = useRef<TextInput>(null);

  const normalizePhone = (raw: string): string => {
    // Remove everything except digits and leading +
    let cleaned = raw.replace(/[^\d+]/g, "");
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }
    return cleaned;
  };

  const handleChangeText = (text: string) => {
    setPhone(normalizePhone(text));
  };

  const handleSubmit = () => {
    const normalized = normalizePhone(phone);
    // Minimum: +X (X = country code) + some digits → at least 8 chars
    if (normalized.length < 8) return;
    onSubmit(normalized);
  };

  const isValid = normalizePhone(phone).length >= 8;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Text style={styles.title}>Вход по номеру</Text>
      <Text style={styles.subtitle}>
        Введите номер телефона, привязанный к Telegram
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[styles.input, error && styles.inputError]}
          value={phone}
          onChangeText={handleChangeText}
          placeholder="+7 999 123 45 67"
          placeholderTextColor="#999"
          keyboardType="phone-pad"
          autoFocus
          editable={!isLoading}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <Pressable
        style={[
          styles.button,
          (!isValid || isLoading) && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!isValid || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Получить код</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
  },
  inputContainer: {
    gap: 6,
  },
  input: {
    fontSize: 22,
    fontWeight: "500",
    letterSpacing: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    color: "#1a1a2e",
  },
  inputError: {
    borderColor: "#d32f2f",
  },
  errorText: {
    fontSize: 13,
    color: "#d32f2f",
  },
  button: {
    backgroundColor: "#2196F3",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#90CAF9",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
