import { StyleSheet, Switch, Text, View } from "react-native";

import { colors } from "@/theme/colors";

type LabeledSwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function LabeledSwitchRow({
  label,
  description,
  value,
  onValueChange,
}: LabeledSwitchRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.textBlock}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accentSoft }}
        thumbColor={value ? "#9AB6FF" : colors.surfaceElevated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
