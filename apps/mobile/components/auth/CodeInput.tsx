import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { CodeDeliveryType } from "@corp/shared";
import { deliveryTypeLabel } from "@corp/shared";

interface CodeInputProps {
  /** How the code was delivered (app, sms, etc.) */
  deliveryType: CodeDeliveryType;
  /** Expected code length (5 or 6) */
  codeLength?: number;
  /** Phone number (for display) */
  phone?: string;
  onSubmit: (code: string) => void;
  onResend?: () => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Code input component for Telegram verification.
 * Shows individual digit cells with auto-focus and auto-submit.
 */
export function CodeInput({
  deliveryType,
  codeLength = 5,
  phone,
  onSubmit,
  onResend,
  isLoading,
  error,
}: CodeInputProps) {
  const [code, setCode] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const inputRef = useRef<TextInput>(null);

  // Auto-submit when full code entered
  useEffect(() => {
    if (code.length === codeLength && !isLoading) {
      onSubmit(code);
    }
  }, [code, codeLength, isLoading, onSubmit]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleChangeText = (text: string) => {
    // Only digits, up to codeLength
    const digits = text.replace(/\D/g, "").slice(0, codeLength);
    setCode(digits);
  };

  const handleResend = () => {
    if (resendTimer > 0 || !onResend) return;
    setResendTimer(60);
    setCode("");
    onResend();
  };

  const deliveryLabel = deliveryTypeLabel(deliveryType);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Код подтверждения</Text>
      <Text style={styles.subtitle}>
        Код отправлен {deliveryLabel}
        {phone ? `\nна ${phone}` : ""}
      </Text>

      {/* Hidden TextInput for keyboard */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={code}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        autoFocus
        editable={!isLoading}
        maxLength={codeLength}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
      />

      {/* Visual digit cells */}
      <Pressable
        style={styles.cellsRow}
        onPress={() => inputRef.current?.focus()}
      >
        {Array.from({ length: codeLength }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              i < code.length && styles.cellFilled,
              i === code.length && styles.cellActive,
              error && styles.cellError,
            ]}
          >
            <Text style={styles.cellText}>
              {code[i] || ""}
            </Text>
          </View>
        ))}
      </Pressable>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {isLoading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color="#2196F3" />
          <Text style={styles.loadingText}>Проверка кода...</Text>
        </View>
      )}

      {/* Resend button */}
      {onResend && (
        <Pressable
          onPress={handleResend}
          disabled={resendTimer > 0}
          style={styles.resendButton}
        >
          <Text
            style={[
              styles.resendText,
              resendTimer > 0 && styles.resendTextDisabled,
            ]}
          >
            {resendTimer > 0
              ? `Отправить повторно (${resendTimer}с)`
              : "Отправить код повторно"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    alignItems: "center",
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
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    height: 0,
    width: 0,
  },
  cellsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginVertical: 8,
  },
  cell: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e0e0e0",
    backgroundColor: "#fafafa",
    justifyContent: "center",
    alignItems: "center",
  },
  cellFilled: {
    borderColor: "#2196F3",
    backgroundColor: "#E3F2FD",
  },
  cellActive: {
    borderColor: "#2196F3",
    backgroundColor: "#fff",
  },
  cellError: {
    borderColor: "#d32f2f",
  },
  cellText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  errorText: {
    fontSize: 14,
    color: "#d32f2f",
    textAlign: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: "#666",
  },
  resendButton: {
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 15,
    color: "#2196F3",
    fontWeight: "500",
  },
  resendTextDisabled: {
    color: "#999",
  },
});
