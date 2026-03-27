import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { VideoPlayer } from "expo-video";

import { DPad } from "@/components/DPad";
import { TextToggle } from "@/components/TextToggle";
import { ThrowTabs } from "@/components/ThrowTabs";
import { VideoPlayerView } from "@/components/VideoPlayerView";
import { VideoPoseAnalysis } from "@/domain/videoPoseAnalyzer";
import { ThrowIndex, ThrowWindow } from "@/domain/types";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

type Props = {
  player: VideoPlayer;
  videoUri?: string;
  throws: ThrowWindow[];
  activeIndex: ThrowIndex;
  analysis: VideoPoseAnalysis | null;
  stepNumber: number;
  totalSteps: number;
  onUpdateThrow: (index: ThrowIndex, patch: Partial<ThrowWindow>) => void;
  onSelectThrow: (index: ThrowIndex) => void;
  onBack: () => void;
  onProceed: () => void;
};

const formatTime = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, s) % 60).toString().padStart(2, "0")}`;

const FRAME_MS = 1000 / 30;

function hasRange(t: ThrowWindow): boolean {
  return t.startMillis !== null && t.endMillis !== null && t.endMillis > t.startMillis;
}

export function ReleaseScreen({
  player,
  videoUri,
  throws,
  activeIndex,
  analysis,
  stepNumber,
  totalSteps,
  onUpdateThrow,
  onSelectThrow,
  onBack,
  onProceed,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [currentTimeMillis, setCurrentTimeMillis] = useState(() => player.currentTime * 1000);
  const [durationMillis, setDurationMillis] = useState(() => player.duration * 1000);
  const [isPaused, setIsPaused] = useState(() => !player.playing);
  const [playbackRate, setPlaybackRate] = useState<1 | 0.5 | 0.25 | 0.1>(1);
  const [progressWidth, setProgressWidth] = useState(1);

  const throwsRef = useRef(throws);
  throwsRef.current = throws;
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeThrow = throws[activeIndex];
  const rangeStart = hasRange(activeThrow) ? activeThrow.startMillis ?? 0 : 0;
  const rangeEnd = hasRange(activeThrow) ? activeThrow.endMillis ?? durationMillis : durationMillis;
  const rangeMillis = Math.max(1, rangeEnd - rangeStart);

  useEffect(() => {
    player.timeUpdateEventInterval = 0.08;
    const t = player.addListener("timeUpdate", ({ currentTime }) => {
      const ms = currentTime * 1000;
      setCurrentTimeMillis(ms);
      const at = throwsRef.current[activeIndexRef.current];
      if (at.endMillis !== null && ms > at.endMillis + 50 && player.playing) {
        player.pause();
        player.currentTime = (at.startMillis ?? 0) / 1000;
      }
    });
    const p = player.addListener("playingChange", ({ isPlaying }) => {
      setIsPaused(!isPlaying);
    });
    const s = player.addListener("sourceLoad", ({ duration }) => {
      setDurationMillis(duration * 1000);
      setCurrentTimeMillis(0);
      setIsPaused(true);
    });
    setCurrentTimeMillis(player.currentTime * 1000);
    setDurationMillis(player.duration * 1000);
    setIsPaused(!player.playing);
    return () => {
      t.remove(); p.remove(); s.remove();
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, [player]);

  useEffect(() => {
    const at = throwsRef.current[activeIndex];
    if (at.startMillis !== null) {
      player.pause();
      player.currentTime = at.startMillis / 1000;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, player]);

  const seekTo = (ms: number) => {
    const clamped = Math.max(rangeStart, Math.min(ms, rangeEnd));
    player.pause();
    player.currentTime = clamped / 1000;
  };

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  const stepFrame = (dir: 1 | -1) => {
    player.pause();
    const current = player.currentTime * 1000;
    const next = Math.max(rangeStart, Math.min(current + dir * FRAME_MS, rangeEnd));
    player.currentTime = next / 1000;
  };

  const startFrameHold = (dir: 1 | -1) => {
    stepFrame(dir);
    holdTimerRef.current = setTimeout(() => {
      holdIntervalRef.current = setInterval(() => stepFrame(dir), 100);
    }, 400);
  };

  const stopFrameHold = () => {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (holdIntervalRef.current) { clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; }
  };

  const progressRatio =
    rangeMillis > 0 ? Math.max(0, Math.min(1, (currentTimeMillis - rangeStart) / rangeMillis)) : 0;

  const handleTapRelease = (point: { x: number; y: number }, timeMillis: number) => {
    onUpdateThrow(activeIndex, {
      releasePoint: point,
      releaseMillis: Math.round(timeMillis),
    });
  };

  return (
    <View style={styles.wrapper}>
      {/* Step header */}
      <Text style={styles.stepText}>ステップ {stepNumber}/{totalSteps}　リリース点を記録する</Text>

      {/* Video — full bleed */}
      <View style={[styles.fullBleedSection, { marginHorizontal: -spacing.md }]}>
        <VideoPlayerView
          player={player}
          mode="release"
          throws={throws}
          activeIndex={activeIndex}
          currentTimeMillis={currentTimeMillis}
          isPaused={isPaused}
          analysis={analysis}
          totalMillis={durationMillis}
          showTrajectory={false}
          showSkeleton={false}
          showReleasePoints={true}
          hasVideo={Boolean(videoUri)}
          onTapRelease={handleTapRelease}
          style={[styles.videoPlayer, { height: Math.round(screenWidth * 0.62) }]}
        />

        {/* Progress bar */}
        <Pressable
          style={styles.progressWrap}
          onLayout={(e) => setProgressWidth(e.nativeEvent.layout.width)}
          onPress={(e) =>
            seekTo(rangeStart + rangeMillis * Math.max(0, Math.min(1, e.nativeEvent.locationX / progressWidth)))
          }
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </View>
        </Pressable>
      </View>

      <Text style={styles.hintText}>ダーツが指から離れた瞬間をタップしてください</Text>
      <Text style={styles.hintSubText}>※迷った場合は最も早く指を離れた位置を選択</Text>

      {/* Frame step buttons */}
      <View style={styles.frameStepRow}>
        <Pressable
          onPressIn={() => startFrameHold(-1)}
          onPressOut={stopFrameHold}
          style={({ pressed }) => [styles.frameStepBtn, pressed && styles.frameStepBtnPressed]}
        >
          <Text style={styles.frameStepText}>◀◀  1コマ戻る</Text>
        </Pressable>
        <Pressable
          onPressIn={() => startFrameHold(1)}
          onPressOut={stopFrameHold}
          style={({ pressed }) => [styles.frameStepBtn, pressed && styles.frameStepBtnPressed]}
        >
          <Text style={styles.frameStepText}>1コマ進む  ▶▶</Text>
        </Pressable>
      </View>

      {/* Throw tabs */}
      <ThrowTabs activeIndex={activeIndex} onSelect={onSelectThrow} />

      {/* Speed + play — single row */}
      <View style={styles.speedRow}>
        {([1, 0.5, 0.25, 0.1] as const).map((rate) => (
          <TextToggle
            key={rate}
            label={`${rate}x`}
            active={playbackRate === rate}
            onPress={() => {
              setPlaybackRate(rate);
              player.playbackRate = rate;
            }}
          />
        ))}
        <Pressable
          onPressIn={togglePlay}
          style={({ pressed }) => [styles.playBtn, pressed && styles.playBtnPressed]}
        >
          <Text style={styles.playBtnText}>{isPaused ? "▶ 再生" : "⏸ 停止"}</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      {/* D-pad hint */}
      <Text style={styles.dpadHint}>タップした点を微調整できます</Text>

      {/* D-pad */}
      <DPad
        onMove={(dx, dy) => {
          const p = activeThrow.releasePoint;
          onUpdateThrow(activeIndex, {
            releasePoint: {
              x: Math.max(0, Math.min(1, p.x + dx)),
              y: Math.max(0, Math.min(1, p.y + dy)),
            },
          });
        }}
      />

      <View style={styles.divider} />

      {/* Navigation */}
      <View style={styles.actionRow}>
        <Pressable onPressIn={onBack} style={[styles.actionBtn, styles.backBtn]}>
          <Text style={styles.actionText}>戻る</Text>
        </Pressable>
        <Pressable onPressIn={onProceed} style={[styles.actionBtn, styles.proceedBtn]}>
          <Text style={styles.actionText}>次へ</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  stepText: { fontSize: 15, fontWeight: "700", color: colors.text, paddingHorizontal: 2 },
  fullBleedSection: { gap: 0 },
  videoPlayer: { borderRadius: 0, borderWidth: 0 },
  hintText: { fontSize: 12, color: colors.textSecondary, textAlign: "center", marginTop: -4 },
  hintSubText: { fontSize: 12, color: colors.textSecondary, textAlign: "center", opacity: 0.6, marginTop: -6 },
  dpadHint: { fontSize: 12, color: colors.textSecondary, textAlign: "center", opacity: 0.6 },
  progressWrap: { paddingVertical: 8, paddingHorizontal: spacing.md },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(117, 135, 163, 0.24)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.accent },
  frameStepRow: { flexDirection: "row", gap: 10 },
  frameStepBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  frameStepBtnPressed: { opacity: 0.65, backgroundColor: colors.surface },
  frameStepText: { fontSize: 14, fontWeight: "800", color: colors.text },
  playBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnPressed: { opacity: 0.7 },
  playBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },
  divider: {
    height: 1,
    backgroundColor: "rgba(34, 50, 72, 0.8)",
    marginVertical: 2,
  },
  speedRow: { flexDirection: "row", gap: 8 },
  actionRow: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  backBtn: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  proceedBtn: { backgroundColor: colors.accent, borderColor: "#6690FF" },
  actionText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
});
