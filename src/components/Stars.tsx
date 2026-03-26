import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

export function Stars({ value }: { value: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: 5 }, (_, index) => (
        <Text key={index} style={[styles.star, index < value && styles.activeStar]}>
          ★
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 2,
  },
  star: {
    fontSize: 16,
    color: "#324056",
  },
  activeStar: {
    color: colors.gold,
  },
});
