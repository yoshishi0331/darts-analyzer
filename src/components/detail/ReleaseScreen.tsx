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

// 肘関節角：（肘→肩）ベクトルと（肘→手首）ベクトルのなす角
// L字（肘90°） → 90°
// 引いた状態（テイクバック） → <90°
// 腕を伸ばした状態（フォロースルー） → ~170°
// aspectRatio は水平方向の補正に使用
function calcArmAngle(
  shoulder: { x: number; y: number },
  elbow: { x: number; y: number },
  wrist: { x: number; y: number },
  aspectRatio: number,
): number {
  const v1x = (shoulder.x - elbow.x) * aspectRatio;
  const v1y = shoulder.y - elbow.y;
  const v2x = (wrist.x - elbow.x) * aspectRatio;
  const v2y = wrist.y - elbow.y;
  const mag1 = Math.sqrt(v1x * v1x + v1y * v1y);
  const mag2 = Math.sqrt(v2x * v2x + v2y * v2y);
  if (mag1 === 0 || mag2 === 0) return 0;
  const dot = v1x * v2x + v1y * v2y;
  return Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2)))) * 180 / Math.PI;
}

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
  // 腕角度計測（v1.1 3点計測）
  shoulderPoints: Array<{ x: number; y: number } | null>;
  elbowPoints: Array<{ x: number; y: number } | null>;
  wristPoints: Array<{ x: number; y: number } | null>;
  armAngles: Array<number | null>;
  onUpdateArmData: (
    index: ThrowIndex,
    shoulder: { x: number; y: number },
    elbow: { x: number; y: number },
    wrist: { x: number; y: number },
    angle: number,
  ) => void;
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
  shoulderPoints,
  elbowPoints,
  wristPoints,
  armAngles,
  onUpdateArmData,
}: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const [currentTimeMillis, setCurrentTimeMillis] = useState(() => player.currentTime * 1000);
  // 腕角度入力サブモード（v1.1 3点計測）
  // armCapture: 現在の入力フェーズ（肩→肘→手首）
  // pendingShoulder/Elbow: 確定済みの各点
  // previewPoint: タップ後・確定前のプレビュー点（DPadで微調整）
  const [armCapture, setArmCapture] = useState<"shoulder" | "elbow" | "wrist" | null>(null);
  const [pendingShoulder, setPendingShoulder] = useState<{ x: number; y: number } | null>(null);
  const [pendingElbow, setPendingElbow] = useState<{ x: number; y: number } | null>(null);
  const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number } | null>(null);
  const [durationMillis, setDurationMillis] = useState(() => player.duration * 1000);
  const [isPaused, setIsPaused] = useState(() => !player.playing);
  const [videoAspectRatio, setVideoAspectRatio] = useState(() => {
    const s = player.videoSize;
    return s && s.height > 0 ? s.width / s.height : 16 / 9;
  });
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
      const vs = player.videoSize;
      if (vs && vs.height > 0) setVideoAspectRatio(vs.width / vs.height);
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

  // 投番号切り替え：腕入力サブモードをリセット
  const handleSelectThrow = (index: ThrowIndex) => {
    setArmCapture(null);
    setPendingShoulder(null);
    setPendingElbow(null);
    setPreviewPoint(null);
    onSelectThrow(index);
  };

  const handleTapRelease = (point: { x: number; y: number }, timeMillis: number) => {
    player.pause(); // 再生中にタップした場合もその場で止める
    onUpdateThrow(activeIndex, {
      releasePoint: point,
      releaseMillis: Math.round(timeMillis),
    });
  };

  // 腕角度タップ → プレビュー状態に移行（即確定しない）
  const handleTapArm = (point: { x: number; y: number }) => {
    setPreviewPoint(point);
  };

  // 「決定 →」：プレビューを確定して次フェーズへ
  const handleArmConfirm = () => {
    if (armCapture === "shoulder" && previewPoint != null) {
      setPendingShoulder(previewPoint);
      setPreviewPoint(null);
      setArmCapture("elbow");
    } else if (armCapture === "elbow" && previewPoint != null) {
      setPendingElbow(previewPoint);
      setPreviewPoint(null);
      setArmCapture("wrist");
    } else if (
      armCapture === "wrist" &&
      previewPoint != null &&
      pendingShoulder != null &&
      pendingElbow != null
    ) {
const angle = calcArmAngle(pendingShoulder, pendingElbow, previewPoint, videoAspectRatio);
onUpdateArmData(activeIndex, pendingShoulder, pendingElbow, previewPoint, angle);
      setPendingShoulder(null);
      setPendingElbow(null);
      setPreviewPoint(null);
      setArmCapture(null);
    }
  };

  // 左ボタン：同フェーズやり直し or 前フェーズに戻る
  const handleArmBackBtn = () => {
    if (armCapture === "shoulder") {
      setPreviewPoint(null);
    } else if (armCapture === "elbow") {
      setPreviewPoint(null);
      setPendingShoulder(null);
      setArmCapture("shoulder");
    } else if (armCapture === "wrist") {
      setPreviewPoint(null);
      setPendingElbow(null);
      setArmCapture("elbow");
    }
  };

  // VideoPlayerViewに渡す腕オーバーレイ用の値
  const activeShoulder =
    armCapture === "shoulder" && previewPoint != null ? previewPoint :
    (armCapture === "elbow" || armCapture === "wrist") ? pendingShoulder :
    armCapture === null ? (shoulderPoints[activeIndex] ?? null) :
    null;
  const activeElbow =
    armCapture === "elbow" && previewPoint != null ? previewPoint :
    armCapture === "wrist" ? pendingElbow :
    armCapture === null ? (elbowPoints[activeIndex] ?? null) :
    null;
  const activeWrist =
    armCapture === "wrist" && previewPoint != null ? previewPoint :
    armCapture === null ? (wristPoints[activeIndex] ?? null) :
    null;
  const activeArmAngle =
    armCapture === "wrist" &&
    previewPoint != null &&
    pendingShoulder != null &&
    pendingElbow != null
      ? calcArmAngle(pendingShoulder, pendingElbow, previewPoint, videoAspectRatio)
      : armCapture === null ? (armAngles[activeIndex] ?? null) : null;

  const isArmPreview = armCapture !== null && previewPoint != null;
  const isArmRecorded = armAngles[activeIndex] != null;
  const isReleaseRecorded = throws[activeIndex]?.releaseMillis != null;

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
          armCapture={armCapture}
          activeShoulder={activeShoulder}
          activeElbow={activeElbow}
          activeWrist={activeWrist}
          activeArmAngle={activeArmAngle}
          onTapArm={handleTapArm}
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

      {armCapture === "shoulder" ? (
        <Text style={styles.hintText}>📐 肩をタップしてください</Text>
      ) : armCapture === "elbow" ? (
        <Text style={styles.hintText}>📐 肘の中央をタップしてください</Text>
      ) : armCapture === "wrist" ? (
        <Text style={styles.hintText}>
          📐 手首をタップしてください
          {activeArmAngle !== null ? `　${Math.round(activeArmAngle)}°` : ""}
        </Text>
      ) : (
        <>
          <Text style={styles.hintText}>ダーツが指から離れた瞬間をタップしてください</Text>
          <Text style={styles.hintSubText}>※迷った場合は最も早く指を離れた位置を選択</Text>
        </>
      )}

      {/* 腕角度プレビュー中：確定ボタン + DPad を動画直下に固定表示 */}
      {isArmPreview && (
        <>
          <View style={styles.armConfirmRow}>
            <Pressable
              onPressIn={handleArmBackBtn}
              style={({ pressed }) => [styles.armConfirmBtn, styles.armConfirmBack, pressed && styles.armBtnPressed]}
            >
              <Text style={styles.armConfirmBackText}>
                {armCapture === "shoulder" ? "やり直す" : armCapture === "elbow" ? "← 肩に戻る" : "← 肘に戻る"}
              </Text>
            </Pressable>
            <Pressable
              onPressIn={handleArmConfirm}
              style={({ pressed }) => [styles.armConfirmBtn, styles.armConfirmNext, pressed && styles.armBtnPressed]}
            >
              <Text style={styles.armConfirmNextText}>決定 →</Text>
            </Pressable>
          </View>
          <Text style={styles.dpadHint}>タップした点を微調整できます</Text>
          <DPad
            onMove={(dx, dy) => {
              setPreviewPoint({
                x: Math.max(0, Math.min(1, previewPoint!.x + dx)),
                y: Math.max(0, Math.min(1, previewPoint!.y + dy)),
              });
            }}
          />
        </>
      )}

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
      <ThrowTabs activeIndex={activeIndex} onSelect={handleSelectThrow} />

      {/* 腕を記録するボタン（任意・リリース記録済みの場合のみ表示・再タップで編集） */}
      {isReleaseRecorded && armCapture === null && (
        <Pressable
          onPressIn={() => {
            setPendingShoulder(null);
            setPendingElbow(null);
            setPreviewPoint(null);
            setArmCapture("shoulder");
          }}
          style={({ pressed }) => [styles.armBtn, pressed && styles.armBtnPressed]}
        >
          <Text style={styles.armBtnText}>
            {isArmRecorded ? "📐 腕 記録済み ✓" : "📐 腕を記録する（任意）"}
          </Text>
        </Pressable>
      )}

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

      {/* D-pad：通常モードのリリースポイント微調整（腕入力中は動画直下のDPadを使うため非表示） */}
      {armCapture === null && (
        <>
          <Text style={styles.dpadHint}>タップした点を微調整できます</Text>
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
        </>
      )}

      <View style={styles.divider} />

      {/* Navigation */}
      <View style={styles.actionRow}>
        <Pressable
          onPressIn={() => {
            if (armCapture !== null) {
              // 腕入力中は腕モードをキャンセルするだけ
              setArmCapture(null);
              setPendingShoulder(null);
              setPendingElbow(null);
              setPreviewPoint(null);
            } else {
              onBack();
            }
          }}
          style={[styles.actionBtn, styles.backBtn]}
        >
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
  armBtn: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  armBtnPressed: { opacity: 0.65 },
  armBtnText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  armConfirmRow: { flexDirection: "row", gap: 10 },
  armConfirmBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  armConfirmBack: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  armConfirmNext: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  armConfirmBackText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  armConfirmNextText: { fontSize: 14, fontWeight: "800", color: "#A8C4FF" },
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
