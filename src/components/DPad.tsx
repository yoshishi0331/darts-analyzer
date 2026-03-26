import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

const STEP = 0.005;
const BTN = 50;

type Props = {
  onMove: (dx: number, dy: number) => void;
};

export function DPad({ onMove }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.cell} />
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => onMove(0, -STEP)}
        >
          <Text style={styles.arrow}>▲</Text>
        </Pressable>
        <View style={styles.cell} />
      </View>
      <View style={styles.row}>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => onMove(-STEP, 0)}
        >
          <Text style={styles.arrow}>◀</Text>
        </Pressable>
        <View style={styles.cell} />
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => onMove(STEP, 0)}
        >
          <Text style={styles.arrow}>▶</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <View style={styles.cell} />
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={() => onMove(0, STEP)}
        >
          <Text style={styles.arrow}>▼</Text>
        </Pressable>
        <View style={styles.cell} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "center",
    gap: 5,
  },
  row: {
    flexDirection: "row",
    gap: 5,
  },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPressed: {
    backgroundColor: "rgba(42, 95, 255, 0.22)",
    borderColor: "rgba(120, 162, 255, 0.55)",
  },
  cell: {
    width: BTN,
    height: BTN,
  },
  arrow: {
    fontSize: 17,
    color: colors.text,
  },
});
