import { StyleSheet, Text, View } from "react-native";

import { BoardCanvas } from "@/components/BoardCanvas";
import { Point } from "@/domain/types";
import { colors } from "@/theme/colors";

type BoardInputProps = {
  points: Point[];
  activeIndex: number;
  onSelectPoint: (point: Point) => void;
  onDragPoint: (index: number, point: Point) => void;
  markerOffset?: number;
};

export function BoardInput({
  points,
  activeIndex,
  onSelectPoint,
  onDragPoint,
  markerOffset = 0,
}: BoardInputProps) {
  return (
    <View style={styles.wrapper}>
      <BoardCanvas
        points={points}
        activeIndex={activeIndex}
        onSelectPoint={onSelectPoint}
        onDragPoint={onDragPoint}
        markerOffset={markerOffset}
      />
      <Text style={styles.caption}>
        {"\u7740\u5f3e\u70b9\u5165\u529b / "}
        {markerOffset + activeIndex + 1}
        {"\u6295\u76ee\u3092\u7de8\u96c6\u4e2d"}
      </Text>
      <Text style={styles.subcaption}>
        {
          "\u30bf\u30c3\u30d7\u3067\u5927\u307e\u304b\u306b\u7f6e\u304d\u3001\u9078\u629e\u4e2d\u306e\u6295\u3060\u3051\u3092\u30c9\u30e9\u30c3\u30b0\u3067\u5fae\u8abf\u6574\u3067\u304d\u307e\u3059\u3002"
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
  },
  subcaption: {
    fontSize: 12,
    lineHeight: 18,
    color: "#8E9CB3",
    textAlign: "center",
  },
});
