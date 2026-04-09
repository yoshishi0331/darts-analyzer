import { memo, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, StyleProp, Text, View, ViewStyle } from "react-native";
import { VideoView } from "expo-video";
import type { VideoPlayer } from "expo-video";

import { getNearestPoseFrame, VideoPoseAnalysis } from "@/domain/videoPoseAnalyzer";
import { ThrowIndex } from "@/domain/types";
import { colors } from "@/theme/colors";

const THROW_COLORS = [colors.throw1, colors.throw2, colors.throw3];
const MARKER_SIZE = 20;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type ThrowDraft = {
  startMillis: number | null;
  endMillis: number | null;
  releaseMillis: number | null;
  releasePoint: { x: number; y: number };
};

type Bounds = { x: number; y: number; width: number; height: number };

type Props = {
  player: VideoPlayer;
  mode: "segment" | "release";
  throws: ThrowDraft[];
  activeIndex: ThrowIndex;
  currentTimeMillis: number;
  isPaused: boolean;
  analysis: VideoPoseAnalysis | null;
  totalMillis: number;
  showTrajectory: boolean;
  showSkeleton: boolean;
  showReleasePoints: boolean;
  hasVideo: boolean;
  style?: StyleProp<ViewStyle>;
  onTapRelease?: (point: { x: number; y: number }, timeMillis: number) => void;
  // 腕角度オーバーレイ（v1.1 3点計測）
  armCapture?: "shoulder" | "elbow" | "wrist" | null;
  activeShoulder?: { x: number; y: number } | null;
  activeElbow?: { x: number; y: number } | null;
  activeWrist?: { x: number; y: number } | null;
  activeArmAngle?: number | null;
  onTapArm?: (point: { x: number; y: number }) => void;
};

function hasRange(t: ThrowDraft) {
  return t.startMillis !== null && t.endMillis !== null && t.endMillis > t.startMillis;
}

export const VideoPlayerView = memo(function VideoPlayerView({
  player,
  mode,
  throws,
  activeIndex,
  currentTimeMillis,
  isPaused,
  analysis,
  totalMillis,
  showTrajectory,
  showSkeleton,
  showReleasePoints,
  hasVideo,
  style,
  onTapRelease,
  armCapture = null,
  activeShoulder = null,
  activeElbow = null,
  activeWrist = null,
  activeArmAngle = null,
  onTapArm,
}: Props) {
  const containerRef = useRef<View>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);

  const syncBounds = () => {
    containerRef.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) setBounds({ x, y, width: w, height: h });
    });
  };

  const currentPose = useMemo(
    () => getNearestPoseFrame(analysis, currentTimeMillis / 1000),
    [analysis, currentTimeMillis],
  );

  const throwPaths = useMemo(
    () =>
      throws.map((item, index) => ({
        index: index as ThrowIndex,
        points:
          hasRange(item) && analysis?.samples.length
            ? analysis.samples
                .filter(
                  (s) =>
                    s.timeMillis >= (item.startMillis ?? 0) &&
                    s.timeMillis <= (item.endMillis ?? totalMillis),
                )
                .map((s) => s.skeleton.throwWrist)
            : index === activeIndex
              ? (analysis?.samples ?? []).map((s) => s.skeleton.throwWrist)
              : [],
      })),
    [activeIndex, analysis, throws, totalMillis],
  );

  return (
    <View ref={containerRef} onLayout={syncBounds} style={[styles.container, style]}>
      {/* Video layer - always rendered so player stays mounted */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        surfaceType="textureView"
      />

      {/* Empty state overlay */}
      {!hasVideo ? (
        <View style={styles.empty} pointerEvents="none">
          <Text style={styles.emptyTitle}>3投分の動画を選んでください</Text>
        </View>
      ) : null}

      {/* Overlay layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Trajectory lines */}
        {showTrajectory && bounds
          ? throwPaths.map((path) =>
              path.points.slice(1).map((pt, i) => {
                const prev = path.points[i];
                if (!prev) return null;
                const dx = pt.x - prev.x;
                const dy = pt.y - prev.y;
                const len = Math.sqrt(dx * dx + dy * dy) * bounds.width;
                const angle = `${Math.atan2(dy, dx)}rad`;
                const mx = (prev.x + pt.x) / 2;
                const my = (prev.y + pt.y) / 2;
                const active = path.index === activeIndex;
                return (
                  <View
                    key={`traj-${path.index}-${i}`}
                    style={[
                      styles.lineWrap,
                      {
                        left: `${mx * 100}%`,
                        top: `${my * 100}%`,
                        width: len,
                        transform: [{ translateX: -(len / 2) }, { rotate: angle }],
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.lineGlow,
                        {
                          width: len,
                          backgroundColor: THROW_COLORS[path.index],
                          opacity: active ? 0.2 : 0.08,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.lineCore,
                        {
                          width: len,
                          backgroundColor: THROW_COLORS[path.index],
                          opacity: active ? 1 : 0.4,
                        },
                      ]}
                    />
                  </View>
                );
              }),
            )
          : null}

        {/* Skeleton bones */}
        {showSkeleton && currentPose && bounds
          ? (
              [
                [currentPose.skeleton.leftShoulder, currentPose.skeleton.rightShoulder, false],
                [currentPose.skeleton.leftHip, currentPose.skeleton.rightHip, false],
                [currentPose.skeleton.leftShoulder, currentPose.skeleton.leftHip, false],
                [currentPose.skeleton.rightShoulder, currentPose.skeleton.rightHip, false],
                [currentPose.skeleton.throwShoulder, currentPose.skeleton.throwElbow, true],
                [currentPose.skeleton.throwElbow, currentPose.skeleton.throwWrist, true],
              ] as [{ x: number; y: number }, { x: number; y: number }, boolean][]
            ).map(([from, to, active], i) => {
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const len = Math.sqrt(dx * dx + dy * dy) * bounds.width;
              const angle = `${Math.atan2(dy, dx)}rad`;
              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              return (
                <View
                  key={`bone-${i}`}
                  style={[
                    styles.bone,
                    active ? styles.boneActive : styles.bonePassive,
                    {
                      left: `${mx * 100}%`,
                      top: `${my * 100}%`,
                      width: len,
                      transform: [{ translateX: -(len / 2) }, { rotate: angle }],
                    },
                  ]}
                />
              );
            })
          : null}

        {/* Tap to place release point or arm point（再生中も受け付ける） */}
        {mode === "release" && hasVideo ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) => {
              if (!bounds) return;
              const point = {
                x: clamp01(e.nativeEvent.locationX / bounds.width),
                y: clamp01(e.nativeEvent.locationY / bounds.height),
              };
              if (armCapture != null) {
                onTapArm?.(point);
              } else {
                onTapRelease?.(point, currentTimeMillis);
              }
            }}
          />
        ) : null}

        {/* Arm angle overlay: 2 lines + 3 dots */}
        {bounds && (() => {
          const lineColor = (activeArmAngle ?? 0) >= 95 ? "#D86A6C" : "#49A37E";
          const renderSegment = (
            from: { x: number; y: number },
            to: { x: number; y: number },
            key: string,
          ) => {
            const dx = (to.x - from.x) * bounds.width;
            const dy = (to.y - from.y) * bounds.height;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 1) return null;
            const angle = Math.atan2(dy, dx);
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            return (
              <View
                key={key}
                style={[styles.armLineWrap, {
                  left: `${mx * 100}%`,
                  top: `${my * 100}%`,
                  width: len,
                  transform: [{ translateX: -(len / 2) }, { rotate: `${angle}rad` }],
                }]}
                pointerEvents="none"
              >
                <View style={[styles.armLine, { backgroundColor: lineColor }]} />
              </View>
            );
          };
          return (
            <>
              {activeShoulder && activeElbow ? renderSegment(activeShoulder, activeElbow, "arm-upper") : null}
              {activeElbow && activeWrist ? renderSegment(activeElbow, activeWrist, "arm-lower") : null}
            </>
          );
        })()}
        {activeShoulder ? (
          <View
            key="arm-shoulder"
            style={[styles.armDot, {
              left: `${activeShoulder.x * 100}%`,
              top: `${activeShoulder.y * 100}%`,
            }]}
            pointerEvents="none"
          />
        ) : null}
        {activeElbow ? (
          <View
            key="arm-elbow"
            style={[styles.armDot, {
              left: `${activeElbow.x * 100}%`,
              top: `${activeElbow.y * 100}%`,
            }]}
            pointerEvents="none"
          />
        ) : null}
        {activeWrist ? (
          <View
            key="arm-wrist"
            style={[styles.armDot, {
              left: `${activeWrist.x * 100}%`,
              top: `${activeWrist.y * 100}%`,
            }]}
            pointerEvents="none"
          />
        ) : null}

        {/* Release point markers */}
        {mode === "release" && showReleasePoints
          ? throws.map((item, index) => (
              <View
                key={`marker-${index}`}
                style={[
                  styles.markerShell,
                  {
                    left: `${item.releasePoint.x * 100}%`,
                    top: `${item.releasePoint.y * 100}%`,
                    transform: [
                      { translateX: -(MARKER_SIZE / 2) },
                      { translateY: -(MARKER_SIZE / 2) },
                    ],
                  },
                ]}
              >
                <View
                  style={[
                    styles.marker,
                    {
                      width: MARKER_SIZE,
                      height: MARKER_SIZE,
                      borderRadius: MARKER_SIZE / 2,
                      backgroundColor: THROW_COLORS[index],
                      opacity: index === activeIndex ? 0.95 : 0.42,
                      borderColor:
                        index === activeIndex
                          ? "rgba(255,255,255,0.94)"
                          : "rgba(255,255,255,0.56)",
                    },
                  ]}
                >
                  <Text style={styles.markerText}>{index + 1}</Text>
                </View>
              </View>
            ))
          : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minHeight: 260,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(108, 128, 160, 0.26)",
    backgroundColor: "#050B12",
    overflow: "hidden",
  },
  empty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 10,
    backgroundColor: "#050B12",
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  emptyBody: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: "center" },
  lineWrap: { position: "absolute", height: 6, justifyContent: "center" },
  lineGlow: { position: "absolute", height: 4, borderRadius: 999 },
  lineCore: { position: "absolute", height: 1.5, borderRadius: 999 },
  bone: { position: "absolute", height: 2, borderRadius: 1 },
  bonePassive: { backgroundColor: "rgba(220, 228, 238, 0.22)" },
  boneActive: { backgroundColor: "rgba(238, 243, 252, 0.52)" },
  markerShell: { position: "absolute" },
  marker: {
    borderWidth: 1.6,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  markerText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  // 腕角度オーバーレイ
  armLineWrap: { position: "absolute", height: 4, justifyContent: "center" },
  armLine: { position: "absolute", height: 2.5, width: "100%", borderRadius: 999, opacity: 0.9 },
  armDot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F4C542",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    transform: [{ translateX: -7 }, { translateY: -7 }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
});
