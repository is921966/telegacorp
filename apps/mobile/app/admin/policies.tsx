import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Switch,
  ScrollView,
} from "react-native";
import { getPlatformConfig, type PolicyConfig } from "@corp/shared";

/**
 * Policy management screen — view and edit chat security policies.
 */
export default function PoliciesScreen() {
  const [policy, setPolicy] = useState<PolicyConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPolicy();
  }, []);

  async function loadPolicy() {
    try {
      const { apiBaseUrl } = getPlatformConfig();
      const res = await fetch(`${apiBaseUrl}/api/admin/policies/default`);
      if (res.ok) {
        const data = await res.json() as PolicyConfig;
        setPolicy(data);
      }
    } catch (err) {
      console.error("[Admin] Load policy error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading || !policy) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>Права участников</Text>
      <PolicyToggle
        label="Отправка сообщений"
        value={policy.chat_permissions.can_send_messages}
      />
      <PolicyToggle
        label="Отправка медиа"
        value={policy.chat_permissions.can_send_media}
      />
      <PolicyToggle
        label="Отправка опросов"
        value={policy.chat_permissions.can_send_polls}
      />
      <PolicyToggle
        label="Превью ссылок"
        value={policy.chat_permissions.can_add_web_page_previews}
      />
      <PolicyToggle
        label="Изменение инфо"
        value={policy.chat_permissions.can_change_info}
      />
      <PolicyToggle
        label="Приглашение пользователей"
        value={policy.chat_permissions.can_invite_users}
      />
      <PolicyToggle
        label="Закрепление сообщений"
        value={policy.chat_permissions.can_pin_messages}
      />

      <Text style={styles.sectionTitle}>Безопасность</Text>
      <PolicyToggle
        label="Защита контента"
        value={policy.has_protected_content}
      />
      <PolicyToggle
        label="Анти-спам"
        value={policy.has_aggressive_anti_spam_enabled}
      />
      <PolicyToggle
        label="Скрытые участники"
        value={policy.has_hidden_members}
      />
      <PolicyToggle
        label="Вход по заявке"
        value={policy.join_by_request}
      />

      <Text style={styles.sectionTitle}>Таймеры</Text>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Медленный режим</Text>
        <Text style={styles.infoValue}>
          {policy.slow_mode_delay > 0
            ? `${policy.slow_mode_delay} сек`
            : "Выключен"}
        </Text>
      </View>
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Авто-удаление</Text>
        <Text style={styles.infoValue}>
          {policy.message_auto_delete_time > 0
            ? `${Math.floor(policy.message_auto_delete_time / 86400)} дн.`
            : "Выключено"}
        </Text>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function PolicyToggle({
  label,
  value,
}: {
  label: string;
  value: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} disabled trackColor={{ true: "#90CAF9" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  toggleLabel: { fontSize: 16, color: "#1a1a2e" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f0f0f0",
  },
  infoLabel: { fontSize: 16, color: "#1a1a2e" },
  infoValue: { fontSize: 16, color: "#999" },
});
