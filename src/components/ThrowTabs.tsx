import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ThrowIndex } from "@/domain/types";
import { colors } from "@/theme/colors";

const THROW_COLORS = [colors.throw1, colors.throw2, colors.throw3];
const LABELS = ["1投目", "2投目", "3投目"];

type Props = {
  activeIndex: ThrowIndex;
  onSelect: (index: ThrowIndex) => void;
};

export const ThrowTabs = memo(function ThrowTabs({ activeIndex, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {([0, 1, 2] as ThrowIndex[]).map((index) => {
        const active = index === activeIndex;
        return (
          <Pressable
            key={index}
            onPressIn={() => onSelect(index)}
            style={[styles.tab, active && { backgroundColor: THROW_COLORS[index], borderColor: THROW_COLORS[index] }]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{LABELS[index]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  tab: {
    flex: 1,
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 14, fontWeight: "800", color: colors.textSecondary },
  labelActive: { color: "#FFFFFF" },
});
