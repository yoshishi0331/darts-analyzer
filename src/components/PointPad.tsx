import { Pressable, StyleSheet, Text, View } from "react-native";

import { Point } from "@/domain/types";
import { colors } from "@/theme/colors";

type PointPadProps = {
  label: string;
  points: Point[];
  activeIndex: number;
  onSelectPoint: (point: Point) => void;
};

export function PointPad({ label, points, activeIndex, onSelectPoint }: PointPadProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pad}>
        {Array.from({ length: 6 }, (_, row) =>
          Array.from({ length: 6 }, (_, col) => {
            const x = 10 + col * 16;
            const y = 10 + row * 16;
            return (
              <Pressable
                key={`${label}-${row}-${col}`}
                onPress={() => onSelectPoint({ x, y })}
                style={styles.hitArea}
              />
            );
          }),
        )}
        {points.map((point, index) => (
          <View
            key={`${label}-${index}`}
            style={[
              styles.marker,
              {
                left: `${point.x}%`,
                top: `${point.y}%`,
                backgroundColor:
                  index === 0 ? colors.throw1 : index === 1 ? colors.throw2 : colors.throw3,
                transform: [{ translateX: -9 }, { translateY: -9 }],
              },
              activeIndex === index && styles.activeMarker,
            ]}
          />
        ))}
      </View>
      <Text style={styles.caption}>{activeIndex + 1}投目を調整中</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  pad: {
    position: "relative",
    width: "100%",
    aspectRatio: 1.25,
    borderRadius: 18,
    backgroundColor: "#F9FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "hidden",
  },
  hitArea: {
    width: "16.66%",
    height: "16.66%",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E7EBF1",
  },
  marker: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  activeMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  caption: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
