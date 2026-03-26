import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import type { VideoPlayer } from "expo-video";

import { TextToggle } from "@/components/TextToggle";
import { ThrowTabs } from "@/components/ThrowTabs";
import { VideoPlayerView } from "@/components/VideoPlayerView";
import { VideoPoseAnalysis } from "@/domain/videoPoseAnalyzer";
import { ThrowIndex } from "@/domain/types";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

export type ThrowWindow = {
  startMillis: number | null;
  endMillis: number | null;
  releaseMillis: number | null;
  releasePoint: { x: number; y: number };
  impactPoint: { x: number; y: number } | null;
};

type Props = {
  player: VideoPlayer;
  videoUri?: string;
  throws: ThrowWindow[];
  activeIndex: ThrowIndex;
  analysis: VideoPoseAnalysis | null;
  onUpdateThrow: (index: ThrowIndex, patch: Partial<ThrowWindow>) => void;
  onSelectThrow: (index: ThrowIndex) => void;
  onChooseVideo?: () => void;
  onBack: () => void;
  onProceed: () => void;
};

const formatTime = (s: number) =>
  `${Math.floor(Math.max(0, s) / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(Math.max(0, s) % 60)
    .toString()
    .padStart(2, "0")}`;

const formatFrame = (ms: number | null) =>
  ms === null
    ? "未設定"
    : `${Math.floor(ms / 60000)
        .toString()
        .padStart(2, "0")}:${Math.floor((ms / 1000) % 60)
        .toString()
        .padStart(2, "0")}.${Math.floor((ms % 1000) / 10)
        .toString()
        .padStart(2, "0")}`;

const FRAME_MS = 1000 / 30;
const FLASH_DURATION = 380;
const AUTO_ADVANCE_DELAY = 260;

export function SegmentScreen({
  player,
  videoUri,
  throws,
  activeIndex,
  analysis,
  onUpdateThrow,
  onSelectThrow,
  onChooseVideo,
  onBack,
  onProceed,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [currentTimeMillis, setCurrentTimeMillis] = useState(
    () => player.currentTime * 1000,
  );
  const [durationMillis, setDurationMillis] = useState(
    () => player.duration * 1000,
  );
  const [isPaused, setIsPaused] = useState(() => !player.playing);
  const [playbackRate, setPlaybackRate] = useState<1 | 0.5 | 0.25 | 0.1>(1);
  const [progressWidth, setProgressWidth] = useState(1);

  // Flash states for button press feedback
  const [startFlash, setStartFlash] = useState(false);
  const [endFlash, setEndFlash] = useState(false);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeThrow = throws[activeIndex];

  // Derived set state
  const isStartSet = activeThrow.startMillis !== null;
  const isEndSet = activeThrow.endMillis !== null;
  const allEndsSet = throws.every((w) => w.endMillis !== null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, []);

  // Track player state via events
  useEffect(() => {
    player.timeUpdateEventInterval = 0.08;
    const t = player.addListener("timeUpdate", ({ currentTime }) => {
      setCurrentTimeMillis(currentTime * 1000);
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
      t.remove();
      p.remove();
      s.remove();
    };
  }, [player]);

  const seekTo = (ms: number) => {
    player.pause();
    player.currentTime = Math.max(0, Math.min(ms, durationMillis)) / 1000;
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
    const next = Math.max(0, Math.min(current + dir * FRAME_MS, durationMillis));
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

  const setStart = () => {
    const ms = Math.round(currentTimeMillis);
    onUpdateThrow(activeIndex, {
      startMillis: ms,
      endMillis:
        activeThrow.endMillis !== null && activeThrow.endMillis < ms
          ? ms
          : activeThrow.endMillis,
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStartFlash(true);
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = setTimeout(() => setStartFlash(false), FLASH_DURATION);
  };

  const setEnd = () => {
    const ms = Math.round(currentTimeMillis);
    onUpdateThrow(activeIndex, {
      endMillis: ms,
      startMillis:
        activeThrow.startMillis !== null && activeThrow.startMillis > ms
          ? ms
          : activeThrow.startMillis,
    });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEndFlash(true);
    if (endTimerRef.current) clearTimeout(endTimerRef.current);
    endTimerRef.current = setTimeout(() => setEndFlash(false), FLASH_DURATION);

    // 【4】Auto-advance to next throw
    if (activeIndex < 2) {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        onSelectThrow((activeIndex + 1) as ThrowIndex);
      }, AUTO_ADVANCE_DELAY);
    }
    // If activeIndex === 2, allEndsSet will become true → proceed button lights up
  };

  const progressRatio =
    durationMillis > 0
      ? Math.max(0, Math.min(1, currentTimeMillis / durationMillis))
      : 0;

  const fullBleedMargin = -(spacing.lg);
  const videoHeight = Math.round(screenWidth * 0.62);

  return (
    <View style={styles.wrapper}>
      {/* ── Step header ── */}
      <View style={styles.stepRow}>
        <Text style={styles.stepText}>ステップ 1/5　リリース区間を設定</Text>
        {onChooseVideo ? (
          <Pressable onPressIn={onChooseVideo} style={styles.chooseVideoBtn}>
            <Text style={styles.chooseVideoBtnText}>動画を選択</Text>
          </Pressable>
        ) : null}
      </View>

      {/* ── Video description ── */}
      <View style={styles.videoDescBox}>
        <Text style={styles.videoDescMain}>ダーツを投げる「開始〜リリース後」までを指定します</Text>
        <Text style={styles.videoDescSub}>※ズレると分析精度が下がります</Text>
      </View>

      {/* ── Full-bleed: Video + Progress + FilmStrip ── */}
      <View style={[styles.fullBleedSection, { marginHorizontal: fullBleedMargin }]}>
        <View style={{ position: "relative" }}>
        <VideoPlayerView
          player={player}
          mode="segment"
          throws={throws}
          activeIndex={activeIndex}
          currentTimeMillis={currentTimeMillis}
          isPaused={isPaused}
          analysis={analysis}
          totalMillis={durationMillis}
          showTrajectory={false}
          showSkeleton={false}
          showReleasePoints={false}
          hasVideo={Boolean(videoUri)}
          style={[styles.videoPlayer, { height: videoHeight }]}
        />
        {!videoUri && onChooseVideo && (
          <View style={[styles.noVideoOverlay, { height: videoHeight }]}>
            <Pressable onPress={onChooseVideo} style={styles.noVideoBtn}>
              <Text style={styles.noVideoBtnText}>＋  動画を選ぶ</Text>
            </Pressable>
          </View>
        )}
        </View>

        {/* Scrub bar */}
        <Pressable
          style={styles.progressWrap}
          onLayout={(e) => setProgressWidth(e.nativeEvent.layout.width)}
          onPress={(e) =>
            seekTo(
              durationMillis *
                Math.max(0, Math.min(1, e.nativeEvent.locationX / progressWidth)),
            )
          }
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </View>
        </Pressable>

      </View>

      {/* ── Frame step buttons ── */}
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

      {/* ── Throw selector ── */}
      <ThrowTabs activeIndex={activeIndex} onSelect={onSelectThrow} />

      {/* ── Inline range display ── */}
      <View style={styles.rangeInlineRow}>
        <Text style={styles.rangeInlineLabel}>セットアップ</Text>
        <Text style={[styles.rangeInlineValue, !isStartSet && styles.rangeValueUnset]}>
          {formatFrame(activeThrow.startMillis)}
        </Text>
        <Text style={styles.rangeInlineArrow}>→</Text>
        <Text style={styles.rangeInlineLabel}>リリース後</Text>
        <Text style={[styles.rangeInlineValue, !isEndSet && styles.rangeValueUnset]}>
          {formatFrame(activeThrow.endMillis)}
        </Text>
      </View>

      {/* ── PRIMARY ACTIONS: Set start / end ── */}
      <View style={styles.setRow}>
        {/* Start button */}
        <Pressable
          onPressIn={setStart}
          style={({ pressed }) => [
            styles.setBtn,
            // default → set → flash (flash wins)
            isStartSet ? styles.setBtnStartSet : styles.setBtnStartUnset,
            startFlash && styles.setBtnStartFlash,
            pressed && !startFlash && styles.setBtnPressedBase,
          ]}
        >
          {startFlash && <View style={styles.setBtnFlashOverlay} />}
          <Text style={styles.setBtnIcon}>◀</Text>
          <Text
            style={[
              styles.setBtnText,
              (isStartSet || startFlash) && styles.setBtnTextActive,
            ]}
          >
            ここから
          </Text>
          {isStartSet && !startFlash && <Text style={styles.setBtnCheckBlue}>✓</Text>}
        </Pressable>

        {/* End button */}
        <Pressable
          onPressIn={setEnd}
          style={({ pressed }) => [
            styles.setBtn,
            isEndSet ? styles.setBtnEndSet : styles.setBtnEndUnset,
            endFlash && styles.setBtnEndFlash,
            pressed && !endFlash && styles.setBtnPressedBase,
          ]}
        >
          {endFlash && <View style={styles.setBtnFlashOverlay} />}
          <Text
            style={[
              styles.setBtnText,
              (isEndSet || endFlash) && styles.setBtnTextActive,
            ]}
          >
            ここまで
          </Text>
          <Text style={styles.setBtnIcon}>▶</Text>
          {isEndSet && !endFlash && <Text style={styles.setBtnCheckGreen}>✓</Text>}
        </Pressable>
      </View>

      {/* Auto-advance hint */}
      {activeIndex < 2 && (
        <Text style={styles.autoHint}>
          リリース後を設定すると自動的に{activeIndex + 2}投目へ切り替わります
        </Text>
      )}
      {activeIndex === 2 && allEndsSet && (
        <Text style={styles.autoHintReady}>
          ✓ 3投ぶんの区間設定が完了しました
        </Text>
      )}

      {/* ── Playback controls ── */}
      <View style={styles.divider} />
      <View style={styles.controlsRow}>
        <Pressable
          onPressIn={togglePlay}
          style={({ pressed }) => [styles.playBtn, pressed && styles.playBtnPressed]}
        >
          <Text style={styles.playBtnText}>{isPaused ? "▶  再生" : "⏸  停止"}</Text>
        </Pressable>
      </View>

      {/* ── Speed + Overlay toggles ── */}
      <View style={styles.subRow}>
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
      </View>

      {/* ── Navigation ── */}
      <View style={styles.navRow}>
        <Pressable
          onPressIn={onBack}
          style={({ pressed }) => [
            styles.navBtn,
            styles.navBtnBack,
            pressed && styles.navBtnPressed,
          ]}
        >
          <Text style={styles.navBtnTextBack}>戻る</Text>
        </Pressable>
        <Pressable
          onPressIn={onProceed}
          style={({ pressed }) => [
            styles.navBtn,
            allEndsSet ? styles.navBtnProceedReady : styles.navBtnProceed,
            pressed && styles.navBtnPressed,
          ]}
        >
          <Text style={styles.navBtnText}>
            {allEndsSet ? "✓  リリース点入力へ" : "リリース点入力へ"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },

  // Step header
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  stepText: { fontSize: 15, fontWeight: "700", color: colors.text },
  chooseVideoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chooseVideoBtnText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },

  // Video description
  videoDescBox: { gap: 3, paddingHorizontal: 2 },
  videoDescMain: { fontSize: 13, fontWeight: "600", color: colors.text },
  videoDescSub: { fontSize: 12, color: colors.textSecondary, opacity: 0.6 },

  // No-video overlay
  noVideoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5, 11, 20, 0.72)",
  },
  noVideoBtn: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    minHeight: 56,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.accent,
    backgroundColor: "rgba(42, 95, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  noVideoBtnText: { fontSize: 18, fontWeight: "800", color: colors.text },

  // Full-bleed video section
  fullBleedSection: { gap: 0 },
  videoPlayer: { borderRadius: 0, borderWidth: 0 },
  progressWrap: { paddingVertical: 10, paddingHorizontal: spacing.lg },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(117, 135, 163, 0.22)",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.accent },
  // Inline range display
  rangeInlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  rangeInlineLabel: { fontSize: 11, fontWeight: "600", color: colors.textSecondary },
  rangeInlineValue: { fontSize: 13, fontWeight: "700", color: colors.text },
  rangeInlineArrow: { fontSize: 13, color: colors.border, marginHorizontal: 2 },
  rangeValueUnset: { color: colors.textSecondary, fontWeight: "400" },

  // Set-start / set-end action buttons
  setRow: { flexDirection: "row", gap: 10 },
  setBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  // Start button states
  setBtnStartUnset: {
    backgroundColor: "rgba(79, 123, 247, 0.08)",
    borderColor: "rgba(79, 123, 247, 0.35)",
  },
  setBtnStartSet: {
    backgroundColor: "rgba(79, 123, 247, 0.14)",
    borderColor: "rgba(79, 123, 247, 0.60)",
  },
  setBtnStartFlash: {
    backgroundColor: "rgba(79, 123, 247, 0.34)",
    borderColor: "rgba(140, 185, 255, 0.95)",
    shadowColor: "#4F7BF7",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 8,
  },
  // End button states
  setBtnEndUnset: {
    backgroundColor: "rgba(47, 166, 122, 0.08)",
    borderColor: "rgba(47, 166, 122, 0.35)",
  },
  setBtnEndSet: {
    backgroundColor: "rgba(47, 166, 122, 0.14)",
    borderColor: "rgba(47, 166, 122, 0.60)",
  },
  setBtnEndFlash: {
    backgroundColor: "rgba(47, 166, 122, 0.34)",
    borderColor: "rgba(100, 230, 180, 0.95)",
    shadowColor: "#2FA67A",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 14,
    elevation: 8,
  },
  // Shared
  setBtnPressedBase: { opacity: 0.72 },
  setBtnFlashOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  setBtnText: { fontSize: 13, fontWeight: "800", color: colors.textSecondary },
  setBtnTextActive: { color: colors.text },
  setBtnIcon: { fontSize: 10, color: colors.textSecondary },
  setBtnCheckBlue: { fontSize: 12, color: colors.throw1, fontWeight: "700" },
  setBtnCheckGreen: { fontSize: 12, color: colors.throw2, fontWeight: "700" },

  // Auto-advance hint
  autoHint: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: -4,
    opacity: 0.7,
  },
  autoHintReady: {
    fontSize: 12,
    color: colors.throw2,
    textAlign: "center",
    fontWeight: "600",
    marginTop: -4,
  },

  // Frame step buttons
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

  // Playback controls
  divider: {
    height: 1,
    backgroundColor: "rgba(34, 50, 72, 0.8)",
    marginVertical: 2,
  },
  controlsRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  playBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtnPressed: { opacity: 0.7 },
  playBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },

  // Sub-controls
  subRow: { flexDirection: "row", gap: 6, alignItems: "stretch" },

  // Navigation
  navRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  navBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  navBtnBack: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  navBtnProceed: {
    backgroundColor: colors.accent,
    borderColor: "#6690FF",
  },
  navBtnProceedReady: {
    backgroundColor: "#2F65FF",
    borderColor: "rgba(140, 185, 255, 0.80)",
    shadowColor: "#4F7BF7",
    shadowOpacity: 0.48,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 12,
  },
  navBtnPressed: { opacity: 0.75 },
  navBtnText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  navBtnTextBack: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
});
