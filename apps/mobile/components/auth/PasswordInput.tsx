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

interface PasswordInputProps {
  /** Password hint from Telegram */
  hint?: string;
  onSubmit: (password: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * 2FA password input for Telegram two-step verification.
 */
export function PasswordInput({
  hint,
  onSubmit,
  isLoading,
  error,
}: PasswordInputProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = () => {
    if (!password.trim()) return;
    onSubmit(password);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Text style={styles.title}>Двухфакторная авторизация</Text>
      <Text style={styles.subtitle}>
        Ваш аккаунт защищён паролем.{"\n"}Введите его для входа.
      </Text>

      {hint && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintLabel}>Подсказка:</Text>
          <Text style={styles.hintText}>{hint}</Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[styles.input, error && styles.inputError]}
          value={password}
          onChangeText={setPassword}
          placeholder="Пароль"
          placeholderTextColor="#999"
          secureTextEntry={!showPassword}
          autoFocus
          editable={!isLoading}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={styles.toggleButton}
          onPress={() => setShowPassword(!showPassword)}
        >
          <Text style={styles.toggleText}>
            {showPassword ? "Скрыть" : "Показать"}
          </Text>
        </Pressable>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        style={[
          styles.button,
          (!password.trim() || isLoading) && styles.buttonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!password.trim() || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Войти</Text>
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
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  hintContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFF8E1",
    padding: 12,
    borderRadius: 10,
  },
  hintLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#F57F17",
  },
  hintText: {
    fontSize: 14,
    color: "#333",
    flex: 1,
  },
  inputContainer: {
    position: "relative",
  },
  input: {
    fontSize: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    paddingRight: 80,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    color: "#1a1a2e",
  },
  inputError: {
    borderColor: "#d32f2f",
  },
  toggleButton: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  toggleText: {
    fontSize: 14,
    color: "#2196F3",
    fontWeight: "500",
  },
  errorText: {
    fontSize: 14,
    color: "#d32f2f",
    textAlign: "center",
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
