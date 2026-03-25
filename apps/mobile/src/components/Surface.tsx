import { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function Surface({
  eyebrow,
  title,
  children
}: PropsWithChildren<{ eyebrow: string; title: string }>) {
  return (
    <View style={styles.surface}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.stack}>{children}</View>
    </View>
  );
}

export function StatChip({ label, value, tone = "warm" }: { label: string; value: string; tone?: "warm" | "cool" | "gold" }) {
  return (
    <View style={[styles.chip, tone === "cool" ? styles.coolChip : tone === "gold" ? styles.goldChip : styles.warmChip]}>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

export function NavButton({
  active,
  label,
  onPress
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.navButton, active && styles.navButtonActive]}>
      <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  surface: {
    padding: 20,
    borderRadius: 28,
    backgroundColor: "rgba(255, 250, 243, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(17, 17, 17, 0.1)",
    gap: 14
  },
  stack: {
    gap: 12
  },
  eyebrow: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.6,
    color: "rgba(17, 17, 17, 0.6)",
    fontWeight: "700"
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111111"
  },
  chip: {
    flex: 1,
    minHeight: 92,
    padding: 16,
    borderRadius: 22,
    gap: 6
  },
  warmChip: {
    backgroundColor: "rgba(240, 90, 40, 0.16)"
  },
  coolChip: {
    backgroundColor: "rgba(10, 108, 116, 0.16)"
  },
  goldChip: {
    backgroundColor: "rgba(212, 160, 23, 0.2)"
  },
  chipLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    color: "rgba(17, 17, 17, 0.6)",
    fontWeight: "700"
  },
  chipValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111111"
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(17, 17, 17, 0.06)"
  },
  navButtonActive: {
    backgroundColor: "#111111"
  },
  navLabel: {
    color: "#111111",
    fontWeight: "700"
  },
  navLabelActive: {
    color: "#fffaf3"
  }
});
