import { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

export function Card({ children }: { children: ReactNode }) {
  return (
    <View style={styles.card}>
      {/* Top metallic shine line */}
      <View style={styles.topShine} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: spacing.md,
    gap: spacing.sm,
    // Top/bottom border only — metallic feel, no left/right lines
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.09)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(80, 100, 140, 0.22)",
    shadowColor: "#000000",
    shadowOpacity: 0.40,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 28,
    elevation: 12,
    overflow: "hidden",
  },
  // Subtle gloss strip just inside the top edge
  topShine: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 0,
    height: 48,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.038)",
  },
});
