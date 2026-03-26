import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  size?: "default" | "large";
};

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  size = "default",
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === "large" && styles.large,
        variant === "primary" ? styles.primary : styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={variant === "primary" ? styles.primaryText : styles.secondaryText}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  large: {
    minHeight: 64,
    borderRadius: 22,
  },
  primary: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: "#6690FF",
  },
  secondary: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primaryText: {
    color: colors.surface,
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
  },
  pressed: {
    opacity: 0.85,
  },
});
