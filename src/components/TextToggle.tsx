import { memo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";

type Props = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export const TextToggle = memo(function TextToggle({ label, active, onPress }: Props) {
  return (
    <Pressable
      onPressIn={onPress}
      style={[styles.btn, active && styles.btnActive]}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  btn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  btnActive: {
    backgroundColor: "rgba(55, 97, 214, 0.22)",
    borderColor: "rgba(122, 154, 255, 0.34)",
  },
  text: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  textActive: { color: colors.text },
});
