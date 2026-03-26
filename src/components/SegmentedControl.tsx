import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type Option<T extends string> = {
  label: string;
  value: T;
  color?: string;
};

type SegmentedControlProps<T extends string> = {
  options: Option<T>[];
  selected: T;
  onChange: (value: T) => void;
};

export function SegmentedControl<T extends string>({
  options,
  selected,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.option,
              active && { backgroundColor: option.color ?? colors.accent },
            ]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  option: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  label: {
    fontWeight: "600",
    color: colors.textSecondary,
    fontSize: 13,
  },
  activeLabel: {
    color: colors.surface,
  },
});
