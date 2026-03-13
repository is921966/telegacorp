import { View, Text, StyleSheet } from "react-native";

interface DaySeparatorProps {
  date: string;
}

/**
 * Day separator shown between messages from different days.
 * Rendered inside an inverted list, so it appears correctly.
 */
export function DaySeparator({ date }: DaySeparatorProps) {
  return (
    <View style={styles.container}>
      <View style={styles.pill}>
        <Text style={styles.text}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 8,
  },
  pill: {
    backgroundColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
});
