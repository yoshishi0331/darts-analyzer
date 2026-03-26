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

        {/* Tap to place release point */}
        {mode === "release" && isPaused && hasVideo ? (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) => {
              if (!bounds || !onTapRelease) return;
              onTapRelease(
                {
                  x: clamp01(e.nativeEvent.locationX / bounds.width),
                  y: clamp01(e.nativeEvent.locationY / bounds.height),
                },
                currentTimeMillis,
              );
            }}
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
});
