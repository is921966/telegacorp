import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";

interface AdminMenuItem {
  route: string;
  icon: string;
  title: string;
  subtitle: string;
}

const ADMIN_MENU: AdminMenuItem[] = [
  {
    route: "/admin/chats",
    icon: "💬",
    title: "Управление чатами",
    subtitle: "Рабочие чаты, политики, права",
  },
  {
    route: "/admin/members",
    icon: "👥",
    title: "Участники",
    subtitle: "Управление доступом и ролями",
  },
  {
    route: "/admin/audit",
    icon: "📋",
    title: "Аудит",
    subtitle: "Журнал действий, события чатов",
  },
  {
    route: "/admin/policies",
    icon: "🛡️",
    title: "Политики безопасности",
    subtitle: "Шаблоны прав и ограничений",
  },
  {
    route: "/admin/agents",
    icon: "🤖",
    title: "AI-Агенты",
    subtitle: "Конфигурация и мониторинг агентов",
  },
  {
    route: "/admin/monitoring",
    icon: "📊",
    title: "Мониторинг",
    subtitle: "Ключевые слова, оповещения",
  },
  {
    route: "/admin/templates",
    icon: "📝",
    title: "Шаблоны",
    subtitle: "Шаблоны политик и настроек чатов",
  },
  {
    route: "/admin/analytics",
    icon: "📈",
    title: "Аналитика",
    subtitle: "Статистика активности, графики",
  },
];

/**
 * Admin panel dashboard — grid of admin sections.
 */
export default function AdminDashboard() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Панель управления</Text>
        <Text style={styles.headerSubtitle}>
          Telegram Corp Admin
        </Text>
      </View>

      <View style={styles.grid}>
        {ADMIN_MENU.map((item) => (
          <Pressable
            key={item.route}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.cardIcon}>{item.icon}</Text>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    backgroundColor: "#f0f0f0",
  },
  cardIcon: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a2e",
  },
  cardSubtitle: {
    fontSize: 12,
    color: "#999",
    lineHeight: 16,
  },
});
