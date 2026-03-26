import { useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";

import { BoardCanvas } from "@/components/BoardCanvas";
import { Point } from "@/domain/types";
import { colors } from "@/theme/colors";

const markerColors = [colors.throw1, colors.throw2, colors.throw3];

type CanvasBounds = {
  width: number;
};

type ResearchCanvasProps = {
  boardHits: Point[];
  releasePoints: Point[];
  activeThrow?: number | null;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasPoint = {
  left: number;
  top: number;
};

function average(points: Point[]): Point {
  if (!points.length) {
    return { x: 0.5, y: 0.5 };
  }

  const total = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function markerPosition(point: Point, rect: Rect): CanvasPoint {
  return {
    left: rect.x + point.x * rect.width,
    top: rect.y + point.y * rect.height,
  };
}

function getCanvasRects(width: number) {
  const height = width * 1.3;
  const releaseRect: Rect = {
    x: width * 0.08,
    y: width * 0.08,
    width: width * 0.84,
    height: height * 0.24,
  };
  const boardSize = width * 0.68;
  const boardRect: Rect = {
    x: (width - boardSize) / 2,
    y: height - boardSize - width * 0.08,
    width: boardSize,
    height: boardSize,
  };

  return { height, releaseRect, boardRect };
}

function ConnectionLine({ from, to, color }: { from: CanvasPoint; to: CanvasPoint; color: string }) {
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = `${Math.atan2(dy, dx)}rad`;
  const midX = (from.left + to.left) / 2;
  const midY = (from.top + to.top) / 2;

  return (
    <View
      style={[
        styles.connection,
        {
          left: midX - length / 2,
          top: midY - 1,
          width: length,
          backgroundColor: color,
          transform: [{ rotate: angle }],
        },
      ]}
    />
  );
}

export function ResearchCanvas({ boardHits, releasePoints, activeThrow = null }: ResearchCanvasProps) {
  const [bounds, setBounds] = useState<CanvasBounds | null>(null);
  const canvasRef = useRef<View>(null);

  const handleLayout = (_event: LayoutChangeEvent) => {
    canvasRef.current?.measure((_x, _y, width) => {
      setBounds({ width });
    });
  };

  const width = bounds?.width ?? 320;
  const { height, releaseRect, boardRect } = getCanvasRects(width);
  const safeBoardHits =
    boardHits.length > 0 ? boardHits : [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }];
  const safeReleasePoints =
    releasePoints.length > 0
      ? releasePoints
      : [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }];
  const pairCount = Math.min(safeBoardHits.length, safeReleasePoints.length, markerColors.length);
  const averageRelease = average(safeReleasePoints.slice(0, pairCount));

  return (
    <View style={styles.wrapper}>
      <View ref={canvasRef} onLayout={handleLayout} style={[styles.canvas, { height }]}>
        <View
          style={[
            styles.releaseZone,
            {
              left: releaseRect.x,
              top: releaseRect.y,
              width: releaseRect.width,
              height: releaseRect.height,
            },
          ]}
        >
          <Text style={styles.zoneTitle}>{"\u30ea\u30ea\u30fc\u30b9\u70b9"}</Text>
          <Text style={styles.zoneCaption}>
            {"\u505c\u6b62\u30d5\u30ec\u30fc\u30e0\u4e0a\u306e\u7814\u7a76\u30dd\u30a4\u30f3\u30c8"}
          </Text>
        </View>

        <View
          style={[
            styles.boardShell,
            {
              left: boardRect.x,
              top: boardRect.y,
              width: boardRect.width,
              height: boardRect.height,
            },
          ]}
        >
          <BoardCanvas points={safeBoardHits.slice(0, pairCount)} markerSize={28} />
        </View>

        {safeReleasePoints.slice(0, pairCount).map((point, index) => {
          const releasePosition = markerPosition(point, releaseRect);
          const hitPosition = markerPosition(safeBoardHits[index] ?? { x: 0.5, y: 0.5 }, boardRect);

          return (
            <View key={`connection-${index}`}>
              <ConnectionLine
                from={releasePosition}
                to={hitPosition}
                color={`${markerColors[index]}88`}
              />
              <View
                style={[
                  styles.markerWrap,
                  {
                    left: releasePosition.left,
                    top: releasePosition.top,
                    transform: [{ translateX: -16 }, { translateY: -16 }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.releaseMarker,
                    { backgroundColor: `${markerColors[index]}D0` },
                    activeThrow === index && styles.activeReleaseMarker,
                    activeThrow === null && styles.equalReleaseMarker,
                  ]}
                >
                  <Text style={styles.markerText}>{index + 1}</Text>
                </View>
              </View>
              <View
                style={[
                  styles.hitMarkerWrap,
                  {
                    left: hitPosition.left,
                    top: hitPosition.top,
                    transform: [{ translateX: -14 }, { translateY: -14 }],
                  },
                ]}
              >
                <View style={[styles.hitMarker, { backgroundColor: markerColors[index] }]}>
                  <Text style={styles.markerText}>{index + 1}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <View
          style={[
            styles.averageMarker,
            {
              left: markerPosition(averageRelease, releaseRect).left,
              top: markerPosition(averageRelease, releaseRect).top,
              transform: [{ translateX: -13 }, { translateY: -13 }],
            },
          ]}
        >
          <Text style={styles.averageLabel}>AVG</Text>
        </View>
      </View>

      <Text style={styles.caption}>
        {
          "\u0033\u6295\u306e\u30ea\u30ea\u30fc\u30b9\u70b9\u3068\u7740\u5f3e\u70b9\u3092\u91cd\u306d\u3066\u3001\u518d\u73fe\u6027\u3068\u30ba\u30ec\u306e\u95a2\u4fc2\u3092\u898b\u8fd4\u3057\u307e\u3059\u3002"
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 12,
  },
  canvas: {
    width: "100%",
    borderRadius: 24,
    backgroundColor: "#07111D",
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  releaseZone: {
    position: "absolute",
    borderRadius: 22,
    backgroundColor: "rgba(19, 32, 51, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(120, 143, 171, 0.24)",
  },
  zoneTitle: {
    position: "absolute",
    top: 12,
    left: 14,
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  zoneCaption: {
    position: "absolute",
    top: 30,
    left: 14,
    color: colors.textSecondary,
    fontSize: 11,
  },
  boardShell: {
    position: "absolute",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#03060B",
  },
  connection: {
    position: "absolute",
    height: 2,
    opacity: 0.85,
  },
  markerWrap: {
    position: "absolute",
  },
  releaseMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.76)",
    alignItems: "center",
    justifyContent: "center",
  },
  activeReleaseMarker: {
    transform: [{ scale: 1.08 }],
  },
  equalReleaseMarker: {
    opacity: 0.94,
  },
  hitMarkerWrap: {
    position: "absolute",
  },
  hitMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  markerText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  averageMarker: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(231, 182, 107, 0.7)",
    backgroundColor: "rgba(231, 182, 107, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  averageLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: colors.gold,
  },
  caption: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
});
