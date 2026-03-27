import { useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Point } from "@/domain/types";
import { colors } from "@/theme/colors";

const boardImage = require("../../assets/images/bored.png");
const markerColors = [colors.throw1, colors.throw2, colors.throw3];

type Bounds = {
  width: number;
  height: number;
};

type BoardCanvasProps = {
  points: Point[];
  activeIndex?: number;
  onSelectPoint?: (point: Point) => void;
  onDragPoint?: (index: number, point: Point) => void;
  markerSize?: number;
  markerOffset?: number;
  throwIndices?: number[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function projectIntoBoard(localX: number, localY: number, size: number): Point {
  const center = size / 2;
  const radius = size / 2 - 12;
  const dx = localX - center;
  const dy = localY - center;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= radius) {
    return {
      x: clamp01(localX / size),
      y: clamp01(localY / size),
    };
  }

  const ratio = radius / Math.max(distance, 1);
  return {
    x: clamp01((center + dx * ratio) / size),
    y: clamp01((center + dy * ratio) / size),
  };
}

export function BoardCanvas({
  points,
  activeIndex,
  onSelectPoint,
  onDragPoint,
  markerSize = 20,
  markerOffset = 0,
  throwIndices,
}: BoardCanvasProps) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const boardRef = useRef<View>(null);

  const updateBounds = () => {
    boardRef.current?.measure((_x, _y, width, height) => {
      setBounds({ width, height });
    });
  };

  const handleLayout = (_event: LayoutChangeEvent) => {
    updateBounds();
  };

  const activeMarkerSize = clamp(markerSize, 16, 22);
  const inactiveMarkerSize = clamp(markerSize - 2, 14, 20);

  const markerResponders = useMemo(
    () =>
      points.map((_, index) =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => Boolean(onDragPoint) && activeIndex === index,
          onMoveShouldSetPanResponder: () => Boolean(onDragPoint) && activeIndex === index,
          onPanResponderMove: (_event, gestureState) => {
            if (!bounds || !onDragPoint) {
              return;
            }

            const centerX = points[index].x * bounds.width;
            const centerY = points[index].y * bounds.height;
            const nextX = centerX + gestureState.dx;
            const nextY = centerY + gestureState.dy;
            onDragPoint(index, projectIntoBoard(nextX, nextY, bounds.width));
          },
        }),
      ),
    [activeIndex, bounds, onDragPoint, points],
  );

  return (
    <View ref={boardRef} onLayout={handleLayout} style={styles.boardWrap}>
      <ImageBackground source={boardImage} resizeMode="contain" style={styles.boardImage}>
        {onSelectPoint ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(event) => {
              const size = bounds?.width ?? 1;
              onSelectPoint(projectIntoBoard(event.nativeEvent.locationX, event.nativeEvent.locationY, size));
            }}
          />
        ) : null}

        {points.map((point, index) => {
          const throwIndex = throwIndices ? throwIndices[index]! : markerOffset + index;
          const resolvedMarkerSize = activeIndex === index ? activeMarkerSize : inactiveMarkerSize;

          return (
            <View
              key={`${point.x}-${point.y}-${throwIndex}`}
              style={[
                styles.markerShell,
                {
                  left: `${point.x * 100}%`,
                  top: `${point.y * 100}%`,
                  transform: [
                    { translateX: -(resolvedMarkerSize / 2) },
                    { translateY: -(resolvedMarkerSize / 2) },
                  ],
                },
              ]}
            >
              <View
                {...(activeIndex === index ? markerResponders[index].panHandlers : {})}
                style={[
                  styles.marker,
                  {
                    width: resolvedMarkerSize,
                    height: resolvedMarkerSize,
                    borderRadius: resolvedMarkerSize / 2,
                    backgroundColor: markerColors[throwIndex],
                  },
                  activeIndex === index ? styles.activeMarker : styles.inactiveMarker,
                ]}
              >
                <Text style={[styles.markerText, resolvedMarkerSize <= 16 && styles.markerTextCompact]}>
                  {throwIndex + 1}
                </Text>
              </View>
            </View>
          );
        })}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  boardWrap: {
    width: "100%",
    aspectRatio: 1,
    alignSelf: "center",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#02060C",
    borderWidth: 1,
    borderColor: "rgba(95, 118, 148, 0.28)",
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 24,
    elevation: 10,
  },
  boardImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#02060C",
  },
  markerShell: {
    position: "absolute",
  },
  marker: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  activeMarker: {
    borderColor: "rgba(255,255,255,0.98)",
    shadowOpacity: 0.42,
    opacity: 1,
  },
  inactiveMarker: {
    borderColor: "rgba(255,255,255,0.72)",
    shadowOpacity: 0.2,
    opacity: 0.7,
  },
  markerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  markerTextCompact: {
    fontSize: 9,
  },
});
