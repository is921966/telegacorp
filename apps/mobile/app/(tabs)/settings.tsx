import { View, Text, Pressable, StyleSheet, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore, useAdminRole } from "@corp/shared";
import { useSession } from "../../components/providers/SessionProvider";

/**
 * Settings tab — user profile, theme, workspace, sign out.
 */
export default function SettingsScreen() {
  const { telegramUser } = useAuthStore();
  const { signOut } = useSession();
  const router = useRouter();
  const { role: adminRole } = useAdminRole(telegramUser?.id);

  const handleSignOut = () => {
    Alert.alert(
      "Выйти из аккаунта",
      "Вы уверены? Telegram сессия будет удалена.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Выйти",
          style: "destructive",
          onPress: signOut,
        },
      ]
    );
  };

  const userName = telegramUser
    ? [telegramUser.firstName, telegramUser.lastName].filter(Boolean).join(" ")
    : "Не авторизован";

  const initials = telegramUser
    ? getInitials(userName)
    : "?";

  return (
    <ScrollView style={styles.container}>
      {/* Profile */}
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.userName}>{userName}</Text>
        {telegramUser?.username && (
          <Text style={styles.username}>@{telegramUser.username}</Text>
        )}
        {telegramUser?.phone && (
          <Text style={styles.phone}>{telegramUser.phone}</Text>
        )}
      </View>

      {/* Settings sections */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Общие</Text>
        <SettingsItem label="Тема" value="Системная" />
        <SettingsItem label="Язык" value="Русский" />
        <SettingsItem label="Уведомления" value="Включены" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Рабочее пространство</Text>
        <SettingsItem label="Рабочее время" value="09:00 – 18:00" />
        <SettingsItem label="Переключатель" value="Personal / Work" />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>О приложении</Text>
        <SettingsItem label="Версия" value="0.1.0" />
        <SettingsItem label="Expo SDK" value="55" />
      </View>

      {/* Admin panel (role-gated) */}
      {adminRole && (
        <Pressable
          style={styles.adminButton}
          onPress={() => router.push("/admin")}
        >
          <Text style={styles.adminIcon}>🛡️</Text>
          <Text style={styles.adminText}>Админ-панель</Text>
          <Text style={styles.adminBadge}>
            {adminRole === "super_admin" ? "Супер-админ" : "Админ"}
          </Text>
        </Pressable>
      )}

      {/* Sign out */}
      <Pressable
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutText}>Выйти из аккаунта</Text>
      </Pressable>
    </ScrollView>
  );
}

function SettingsItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemLabel}>{label}</Text>
      <Text style={styles.itemValue}>{value}</Text>
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || "?").toUpperCase();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 32,
    backgroundColor: "#fff",
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#2196F3",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  username: {
    fontSize: 16,
    color: "#2196F3",
    marginTop: 2,
  },
  phone: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  section: {
    backgroundColor: "#fff",
    marginBottom: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e5e5",
  },
  itemLabel: {
    fontSize: 16,
    color: "#1a1a2e",
  },
  itemValue: {
    fontSize: 16,
    color: "#999",
  },
  adminButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  adminIcon: { fontSize: 20 },
  adminText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  adminBadge: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
  signOutButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 40,
  },
  signOutText: {
    fontSize: 16,
    color: "#d32f2f",
    fontWeight: "500",
  },
});
