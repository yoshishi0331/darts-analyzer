import { useEffect, useMemo, useRef, useState } from "react";
import { Image, NativeScrollEvent, NativeSyntheticEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AVPlaybackStatus, AVPlaybackStatusSuccess, ResizeMode, Video } from "expo-av";
import * as VideoThumbnails from "expo-video-thumbnails";

import { analyzeVideoPose, getNearestPoseFrame, VideoPoseAnalysis } from "@/domain/videoPoseAnalyzer";
import { Handedness, ThrowIndex } from "@/domain/types";
import { colors } from "@/theme/colors";

const THROW_COLORS = [colors.throw1, colors.throw2, colors.throw3];
const MARKER_SIZE = 18;
const FRAME_STEP_MILLIS = 1000 / 30;
const THUMB_W = 50;
const THUMB_H = 68;
const THUMB_GAP = 2;
const THUMB_INTERVAL = 180;

type OverlayKey = "trajectory" | "skeleton" | "releasePoints";
type Mode = "segment" | "release";
type Thumb = { uri: string; timeMillis: number };
type Bounds = { x: number; y: number; width: number; height: number };
type ThrowDraft = {
  startMillis: number | null;
  endMillis: number | null;
  releaseMillis: number | null;
  releasePoint: { x: number; y: number };
};

type Props = {
  mode: Mode;
  videoUri?: string;
  throws: ThrowDraft[];
  activeIndex: ThrowIndex;
  handedness: Handedness;
  showTrajectory: boolean;
  showSkeleton: boolean;
  showReleasePoints: boolean;
  onChooseVideo: () => void;
  onUpdateThrow: (index: ThrowIndex, patch: Partial<ThrowDraft>) => void;
  onToggleOverlay: (key: OverlayKey) => void;
  onSelectThrow: (index: ThrowIndex) => void;
  onBack: () => void;
  onProceed: () => void;
  primaryActionLabel: string;
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const isLoaded = (s: AVPlaybackStatus): s is AVPlaybackStatusSuccess => s.isLoaded;
const hasRange = (t: ThrowDraft) => t.startMillis !== null && t.endMillis !== null && t.endMillis > t.startMillis;
const formatTime = (seconds: number) => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, "0")}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, "0")}`;
const formatFrame = (timeMillis: number | null) => timeMillis === null ? "未設定" : `${Math.floor(timeMillis / 60000).toString().padStart(2, "0")}:${Math.floor((timeMillis / 1000) % 60).toString().padStart(2, "0")}.${Math.floor((timeMillis % 1000) / 10).toString().padStart(2, "0")}`;
const toPoint = (localX: number, localY: number, bounds: Bounds) => ({ x: clamp01(localX / bounds.width), y: clamp01(localY / bounds.height) });

function TextToggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.smallButton, active && styles.smallButtonActive]}>
      <Text style={[styles.smallButtonText, active && styles.smallButtonTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function VideoPointInput({ mode, videoUri, throws, activeIndex, handedness, showTrajectory, showSkeleton, showReleasePoints, onChooseVideo, onUpdateThrow, onToggleOverlay, onSelectThrow, onBack, onProceed, primaryActionLabel }: Props) {
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [progressWidth, setProgressWidth] = useState(1);
  const [thumbnails, setThumbnails] = useState<Thumb[]>([]);
  const [stripWidth, setStripWidth] = useState(0);
  const [analysis, setAnalysis] = useState<VideoPoseAnalysis | null>(null);
  const [analysisState, setAnalysisState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [playbackRate, setPlaybackRate] = useState<1 | 0.5 | 0.25>(1);
  const videoRef = useRef<Video | null>(null);
  const stripRef = useRef<ScrollView | null>(null);
  const previewRef = useRef<View>(null);
  const dragActiveRef = useRef(false);
  const pendingSeekMillisRef = useRef<number | null>(null);
  const lastStripSeekRef = useRef(0);
  const activeThrow = throws[activeIndex];
  const totalMillis = durationSeconds * 1000;
  const rangeStart = mode === "release" && hasRange(activeThrow) ? activeThrow.startMillis ?? 0 : 0;
  const rangeEnd = mode === "release" && hasRange(activeThrow) ? activeThrow.endMillis ?? totalMillis : totalMillis;
  const rangeMillis = Math.max(1, rangeEnd - rangeStart);
  const currentMillis = currentTimeSeconds * 1000;

  const syncBounds = () => previewRef.current?.measureInWindow((x, y, width, height) => setBounds({ x, y, width, height }));
  const currentPose = useMemo(() => getNearestPoseFrame(analysis, currentTimeSeconds), [analysis, currentTimeSeconds]);
  const throwPaths = useMemo(
    () =>
      throws.map((item, index) => {
        const samples =
          hasRange(item) && analysis?.samples.length
            ? analysis.samples.filter(
                (sample) =>
                  sample.timeMillis >= (item.startMillis ?? 0) &&
                  sample.timeMillis <= (item.endMillis ?? totalMillis),
              )
            : index === activeIndex
              ? analysis?.samples ?? []
              : [];

        return {
          index: index as ThrowIndex,
          points: samples.map((sample) => sample.skeleton.throwWrist),
        };
      }),
    [activeIndex, analysis, throws, totalMillis],
  );
  const visibleThumbs = useMemo(() => mode !== "release" || !hasRange(activeThrow) ? thumbnails : thumbnails.filter((item) => item.timeMillis >= rangeStart - THUMB_INTERVAL && item.timeMillis <= rangeEnd + THUMB_INTERVAL), [activeThrow, mode, rangeEnd, rangeStart, thumbnails]);
  const stripContentWidth = Math.max(0, visibleThumbs.length * (THUMB_W + THUMB_GAP) - THUMB_GAP);
  const stripPadding = Math.max(0, stripWidth / 2 - THUMB_W / 2);
  const progressRatio = totalMillis > 0 ? clamp01((currentMillis - rangeStart) / rangeMillis) : 0;

  useEffect(() => { setAnalysis(null); setAnalysisState("idle"); }, [videoUri]);
  useEffect(() => {
    if (!videoUri || durationSeconds <= 0) { setThumbnails([]); return; }
    let cancelled = false;
    const run = async () => {
      const positions: number[] = [];
      for (let t = 0; t <= totalMillis; t += THUMB_INTERVAL) positions.push(Math.round(t));
      if (!positions.length || positions[positions.length - 1] !== Math.round(totalMillis)) positions.push(Math.round(totalMillis));
      const items = await Promise.all(positions.map(async (timeMillis) => {
        try { const result = await VideoThumbnails.getThumbnailAsync(videoUri, { time: timeMillis, quality: 0.35 }); return { uri: result.uri, timeMillis }; } catch { return null; }
      }));
      if (!cancelled) setThumbnails(items.filter((item): item is Thumb => item !== null));
    };
    void run();
    return () => { cancelled = true; };
  }, [durationSeconds, totalMillis, videoUri]);
  useEffect(() => {
    if (!videoUri || durationSeconds <= 0 || analysisState !== "idle") return;
    let cancelled = false;
    const run = async () => {
      setAnalysisState("loading");
      try {
        const result = await analyzeVideoPose({ videoUri, durationSeconds, handedness });
        if (!cancelled) { setAnalysis(result); setAnalysisState(result.samples.length ? "ready" : "error"); }
      } catch {
        if (!cancelled) setAnalysisState("error");
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [analysisState, durationSeconds, handedness, videoUri]);
  useEffect(() => {
    if (!stripRef.current || stripContentWidth <= 0) return;
    stripRef.current.scrollTo({ x: clamp01((currentMillis - rangeStart) / rangeMillis) * stripContentWidth, animated: false });
  }, [currentMillis, rangeMillis, rangeStart, stripContentWidth]);
  useEffect(() => {
    if (mode === "release" && videoRef.current && hasRange(activeThrow)) {
      void videoRef.current.setPositionAsync(activeThrow.startMillis ?? 0, { toleranceMillisBefore: 0, toleranceMillisAfter: 0 });
    }
  }, [activeIndex, activeThrow, mode]);

  const panHandlers = useMemo(() => throws.map((_, index) => PanResponder.create({
    onStartShouldSetPanResponder: () => mode === "release" && isPaused && activeIndex === index,
    onMoveShouldSetPanResponder: () => mode === "release" && isPaused && activeIndex === index,
    onPanResponderGrant: () => {
      dragActiveRef.current = true;
      syncBounds();
    },
    onPanResponderMove: (event) => {
      if (!bounds || mode !== "release" || !isPaused) return;
      onUpdateThrow(index as ThrowIndex, {
        releasePoint: { x: clamp01((event.nativeEvent.pageX - bounds.x) / bounds.width), y: clamp01((event.nativeEvent.pageY - bounds.y) / bounds.height) },
        releaseMillis: Math.round(currentMillis),
      });
    },
    onPanResponderRelease: () => {
      dragActiveRef.current = false;
    },
    onPanResponderTerminate: () => {
      dragActiveRef.current = false;
    },
  })), [activeIndex, bounds, currentMillis, isPaused, mode, onUpdateThrow, throws]);

  const seekTo = async (timeMillis: number) => {
    if (!videoRef.current) return;
    const status = await videoRef.current.getStatusAsync();
    if (!isLoaded(status)) return;
    await videoRef.current.pauseAsync();
    await videoRef.current.setPositionAsync(clamp(timeMillis, mode === "release" ? rangeStart : 0, mode === "release" ? rangeEnd : status.durationMillis ?? timeMillis), { toleranceMillisBefore: 0, toleranceMillisAfter: 0 });
  };

  return (
    <View style={styles.wrapper}>
      <Text style={styles.statusText}>{mode === "segment" ? `${activeIndex + 1}投目の投げ区間を設定中` : `${activeIndex + 1}投目のリリースを指定中`}</Text>
      <Text style={styles.helperText}>{analysisState === "loading" ? "骨格と手首軌道を解析中です" : mode === "segment" ? "停止中の現在フレームで開始点・終了点を設定し、3投ぶんの投げ区間を切り出します。" : isPaused ? "開始点〜終了点の範囲だけを見ながら、動画上タップでリリース点を置き、選択中の投だけ直接ドラッグで調整できます。" : "リリース点を置くときは一時停止してください。"}</Text>

      <View style={styles.controlRow}>
        <Text style={styles.actionLink} onPress={onChooseVideo}>動画を選ぶ</Text>
        <Text style={styles.actionLink} onPress={() => void (async () => {
          if (!videoRef.current) return;
          const status = await videoRef.current.getStatusAsync();
          if (!isLoaded(status)) return;
          if (status.isPlaying) { await videoRef.current.pauseAsync(); return; }
          await videoRef.current.playAsync();
        })()}>{isPaused ? "再生" : "一時停止"}</Text>
        <Text style={styles.timeText}>{formatTime(currentTimeSeconds)} / {formatTime(durationSeconds)}</Text>
      </View>

      <View ref={previewRef} onLayout={syncBounds} style={styles.previewFrame}>
        {videoUri ? (
          <Video ref={videoRef} source={{ uri: videoUri }} style={StyleSheet.absoluteFill} resizeMode={ResizeMode.CONTAIN} shouldPlay={false} isLooping={false} useNativeControls={false} onPlaybackStatusUpdate={(status) => {
            if (!isLoaded(status)) { setIsPaused(true); setCurrentTimeSeconds(0); setDurationSeconds(0); return; }
            setIsPaused(!status.isPlaying);
            setDurationSeconds((status.durationMillis ?? 0) / 1000);
            const nextMillis = status.positionMillis ?? 0;
            if (mode === "release" && hasRange(activeThrow) && nextMillis > rangeEnd) {
              void videoRef.current?.pauseAsync();
      void videoRef.current?.setPositionAsync(rangeEnd, { toleranceMillisBefore: 0, toleranceMillisAfter: 0 });
      setCurrentTimeSeconds(rangeEnd / 1000);
      return;
            }
            setCurrentTimeSeconds(nextMillis / 1000);
          }} />
        ) : (
          <View style={styles.emptyState}><Text style={styles.emptyTitle}>端末から動画を読み込みます</Text><Text style={styles.emptyBody}>3投を含む動画を選ぶと、ここで区間設定とリリース点入力を進められます。</Text></View>
        )}
        <View style={styles.previewOverlay} pointerEvents="box-none">
          {showTrajectory && bounds ? throwPaths.map((path) => path.points.slice(1).map((point, i) => {
            const prev = path.points[i]; if (!prev) return null;
            const dx = point.x - prev.x; const dy = point.y - prev.y; const length = Math.sqrt(dx * dx + dy * dy); const angle = `${Math.atan2(dy, dx)}rad`; const midX = (prev.x + point.x) / 2; const midY = (prev.y + point.y) / 2; const active = path.index === activeIndex; const lineWidth = length * bounds.width;
            return <View key={`traj-${path.index}-${i}`} style={[styles.lineWrap, { left: `${midX * 100}%`, top: `${midY * 100}%`, width: lineWidth, transform: [{ translateX: -(lineWidth / 2) }, { rotate: angle }] }]}><View style={[styles.lineGlow, { width: lineWidth, backgroundColor: THROW_COLORS[path.index], opacity: active ? 0.22 : 0.1 }]} /><View style={[styles.lineCore, { width: lineWidth, backgroundColor: THROW_COLORS[path.index], opacity: active ? 1 : 0.42 }]} /></View>;
          })) : null}
          {showSkeleton && currentPose ? [[currentPose.skeleton.leftShoulder, currentPose.skeleton.rightShoulder, false], [currentPose.skeleton.leftHip, currentPose.skeleton.rightHip, false], [currentPose.skeleton.leftShoulder, currentPose.skeleton.leftHip, false], [currentPose.skeleton.rightShoulder, currentPose.skeleton.rightHip, false], [currentPose.skeleton.throwShoulder, currentPose.skeleton.throwElbow, true], [currentPose.skeleton.throwElbow, currentPose.skeleton.throwWrist, true]].map(([from, to, active], i) => {
            const dx = (to as { x: number; y: number }).x - (from as { x: number; y: number }).x; const dy = (to as { x: number; y: number }).y - (from as { x: number; y: number }).y; const length = Math.sqrt(dx * dx + dy * dy); const angle = `${Math.atan2(dy, dx)}rad`; const midX = ((from as { x: number; y: number }).x + (to as { x: number; y: number }).x) / 2; const midY = ((from as { x: number; y: number }).y + (to as { x: number; y: number }).y) / 2; const lineWidth = length * bounds!.width;
            return <View key={`bone-${i}`} style={[styles.bone, active ? styles.boneActive : styles.bonePassive, { left: `${midX * 100}%`, top: `${midY * 100}%`, width: lineWidth, transform: [{ translateX: -(lineWidth / 2) }, { rotate: angle }] }]} />;
          }) : null}
          {mode === "release" && isPaused && videoUri ? <Pressable style={StyleSheet.absoluteFill} onPress={(event) => {
            if (!bounds || dragActiveRef.current) return;
            onUpdateThrow(activeIndex, { releasePoint: toPoint(event.nativeEvent.locationX, event.nativeEvent.locationY, bounds), releaseMillis: Math.round(currentMillis) });
          }} /> : null}
          {mode === "release" && showReleasePoints ? throws.map((item, index) => <View key={`marker-${index}`} style={[styles.markerWrap, { left: `${item.releasePoint.x * 100}%`, top: `${item.releasePoint.y * 100}%`, transform: [{ translateX: -(MARKER_SIZE / 2) }, { translateY: -(MARKER_SIZE / 2) }] }]}><View {...(index === activeIndex ? panHandlers[index].panHandlers : {})} style={[styles.marker, { backgroundColor: THROW_COLORS[index], opacity: index === activeIndex ? 0.94 : 0.42, borderColor: index === activeIndex ? "rgba(255,255,255,0.94)" : "rgba(255,255,255,0.56)" }]}><Text style={styles.markerText}>{index + 1}</Text></View></View>) : null}
        </View>
      </View>

      <Pressable style={styles.progressWrap} onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width)} onPress={(event) => void seekTo(rangeStart + rangeMillis * clamp01(event.nativeEvent.locationX / progressWidth))}>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} /></View>
      </Pressable>

      <View style={styles.filmstripWrap}><View style={styles.filmstripCenter} pointerEvents="none" /><ScrollView ref={stripRef} horizontal showsHorizontalScrollIndicator={false} onLayout={(event) => setStripWidth(event.nativeEvent.layout.width)} contentContainerStyle={styles.filmstripContent} onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => { if (stripContentWidth <= 0) return; const offsetX = clamp(event.nativeEvent.contentOffset.x, 0, stripContentWidth); const nextSeekMillis = rangeStart + rangeMillis * (stripContentWidth > 0 ? offsetX / stripContentWidth : 0); const now = Date.now(); pendingSeekMillisRef.current = nextSeekMillis; if (now - lastStripSeekRef.current < 60) return; lastStripSeekRef.current = now; void seekTo(nextSeekMillis); }} onScrollEndDrag={() => { const nextSeekMillis = pendingSeekMillisRef.current; pendingSeekMillisRef.current = null; if (nextSeekMillis !== null) { void seekTo(nextSeekMillis); } }} onMomentumScrollEnd={() => { const nextSeekMillis = pendingSeekMillisRef.current; pendingSeekMillisRef.current = null; if (nextSeekMillis !== null) { void seekTo(nextSeekMillis); } }} scrollEventThrottle={16}><View style={{ width: stripPadding }} />{visibleThumbs.map((item) => <Pressable key={`${item.uri}-${item.timeMillis}`} onPress={() => void seekTo(item.timeMillis)} style={[styles.thumbCard, Math.abs(item.timeMillis - currentMillis) < THUMB_INTERVAL && styles.thumbCardActive]}><Image source={{ uri: item.uri }} style={styles.thumbImage} /></Pressable>)}<View style={{ width: stripPadding }} /></ScrollView></View>
      <View style={styles.timeRow}><Text style={styles.timeHint}>{formatTime(rangeStart / 1000)}</Text><Text style={styles.timeHint}>{formatTime(rangeEnd / 1000)}</Text></View>

      <View style={styles.row}>{[0,1,2].map((index) => <Pressable key={index} onPress={() => onSelectThrow(index as ThrowIndex)} style={[styles.tab, index === activeIndex && { backgroundColor: THROW_COLORS[index], borderColor: THROW_COLORS[index] }]}><Text style={[styles.tabText, index === activeIndex && styles.tabTextActive]}>{index + 1}投目</Text></Pressable>)}</View>

      {mode === "segment" ? <View style={styles.row}><View style={styles.card}><Text style={styles.cardLabel}>開始点</Text><Text style={styles.cardValue}>{formatFrame(activeThrow.startMillis)}</Text></View><View style={styles.card}><Text style={styles.cardLabel}>終了点</Text><Text style={styles.cardValue}>{formatFrame(activeThrow.endMillis)}</Text></View></View> : null}
      {mode === "segment" ? <View style={styles.row}><TextToggle label="開始点設定" active={false} onPress={() => onUpdateThrow(activeIndex, { startMillis: Math.round(currentMillis), endMillis: activeThrow.endMillis !== null && activeThrow.endMillis < Math.round(currentMillis) ? Math.round(currentMillis) : activeThrow.endMillis })} /><TextToggle label="終了点設定" active={false} onPress={() => onUpdateThrow(activeIndex, { startMillis: activeThrow.startMillis !== null && activeThrow.startMillis > Math.round(currentMillis) ? Math.round(currentMillis) : activeThrow.startMillis, endMillis: Math.round(currentMillis) })} /></View> : null}
      <View style={styles.row}><TextToggle label="軌跡" active={showTrajectory} onPress={() => onToggleOverlay("trajectory")} /><TextToggle label="骨格" active={showSkeleton} onPress={() => onToggleOverlay("skeleton")} />{mode === "release" ? <TextToggle label="リリース点" active={showReleasePoints} onPress={() => onToggleOverlay("releasePoints")} /> : null}</View>
      <View style={styles.row}>{[1,0.5,0.25].map((rate) => <TextToggle key={rate} label={`${rate.toFixed(2).replace(".00", ".0")}x`} active={playbackRate === rate} onPress={() => void (async () => { setPlaybackRate(rate as 1 | 0.5 | 0.25); if (!videoRef.current) return; const status = await videoRef.current.getStatusAsync(); if (!isLoaded(status)) return; await videoRef.current.setRateAsync(rate as 1 | 0.5 | 0.25, true); })()} />)}</View>
      <View style={styles.row}><TextToggle label="前フレーム" active={false} onPress={() => void (async () => { if (!videoRef.current) return; const status = await videoRef.current.getStatusAsync(); if (!isLoaded(status)) return; await videoRef.current.pauseAsync(); const next = clamp(Math.round((status.positionMillis ?? 0) - FRAME_STEP_MILLIS), mode === "release" ? rangeStart : 0, mode === "release" ? rangeEnd : status.durationMillis ?? 0); await videoRef.current.setPositionAsync(next, { toleranceMillisBefore: 0, toleranceMillisAfter: 0 }); })()} /><TextToggle label="次フレーム" active={false} onPress={() => void (async () => { if (!videoRef.current) return; const status = await videoRef.current.getStatusAsync(); if (!isLoaded(status)) return; await videoRef.current.pauseAsync(); const next = clamp(Math.round((status.positionMillis ?? 0) + FRAME_STEP_MILLIS), mode === "release" ? rangeStart : 0, mode === "release" ? rangeEnd : status.durationMillis ?? 0); await videoRef.current.setPositionAsync(next, { toleranceMillisBefore: 0, toleranceMillisAfter: 0 }); })()} /></View>

      <View style={styles.actionRow}><Pressable onPress={onBack} style={[styles.actionButton, styles.backButton]}><Text style={styles.actionText}>戻る</Text></Pressable><Pressable onPress={onProceed} style={[styles.actionButton, styles.proceedButton]}><Text style={styles.actionText}>{primaryActionLabel}</Text></Pressable></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  statusText: { fontSize: 16, fontWeight: "700", color: colors.text },
  helperText: { marginTop: -4, fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  controlRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionLink: { fontSize: 13, fontWeight: "700", color: colors.text },
  timeText: { marginLeft: "auto", fontSize: 12, color: colors.textSecondary },
  previewFrame: { minHeight: 260, borderRadius: 24, borderWidth: 1, borderColor: "rgba(108, 128, 160, 0.26)", backgroundColor: "#050B12", overflow: "hidden" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  emptyBody: { fontSize: 13, lineHeight: 20, color: colors.textSecondary, textAlign: "center" },
  primaryGhost: { marginTop: 6, borderRadius: 999, backgroundColor: colors.accent, paddingHorizontal: 18, paddingVertical: 11 },
  primaryGhostText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  previewOverlay: { ...StyleSheet.absoluteFillObject },
  lineWrap: { position: "absolute", height: 6, justifyContent: "center" },
  lineGlow: { position: "absolute", height: 4, borderRadius: 999 },
  lineCore: { position: "absolute", height: 1.5, borderRadius: 999 },
  bone: { position: "absolute", height: 2, borderRadius: 1 },
  bonePassive: { backgroundColor: "rgba(220, 228, 238, 0.22)" },
  boneActive: { backgroundColor: "rgba(238, 243, 252, 0.52)" },
  markerWrap: { position: "absolute" },
  marker: { width: MARKER_SIZE, height: MARKER_SIZE, borderRadius: MARKER_SIZE / 2, borderWidth: 1.6, alignItems: "center", justifyContent: "center" },
  markerText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
  progressWrap: { paddingVertical: 8 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: "rgba(117, 135, 163, 0.24)", overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 999, backgroundColor: colors.accent },
  rangeLayer: { ...StyleSheet.absoluteFillObject },
  rangeMarker: { position: "absolute", top: 0, bottom: 0, width: 2, borderRadius: 1 },
  filmstripWrap: { position: "relative", minHeight: 84, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: "#09111B", overflow: "hidden", paddingVertical: 6 },
  filmstripCenter: { position: "absolute", top: 6, bottom: 6, left: "50%", width: 2, marginLeft: -1, borderRadius: 1, backgroundColor: "rgba(111, 224, 255, 0.72)", zIndex: 2 },
  filmstripContent: { alignItems: "center" },
  thumbCard: { width: THUMB_W, borderRadius: 4, overflow: "hidden", borderWidth: 1, borderColor: "rgba(80, 97, 121, 0.35)", backgroundColor: "#0C1624", marginRight: THUMB_GAP },
  thumbCardActive: { borderColor: "#7EE6FF", backgroundColor: "rgba(39, 199, 255, 0.08)" },
  thumbImage: { width: "100%", height: THUMB_H, backgroundColor: "#09111A" },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: -2 },
  timeHint: { fontSize: 11, color: colors.textSecondary },
  row: { flexDirection: "row", gap: 10 },
  tab: { flex: 1, minHeight: 46, borderRadius: 15, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 14, fontWeight: "800", color: colors.textSecondary },
  tabTextActive: { color: "#FFFFFF" },
  card: { flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  cardLabel: { fontSize: 11, color: colors.textSecondary },
  cardValue: { fontSize: 15, fontWeight: "700", color: colors.text },
  smallButton: { flex: 1, minHeight: 40, borderRadius: 14, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  smallButtonActive: { backgroundColor: "rgba(55, 97, 214, 0.22)", borderColor: "rgba(122, 154, 255, 0.34)" },
  smallButtonText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  smallButtonTextActive: { color: colors.text },
  actionRow: { flexDirection: "row", gap: 12 },
  actionButton: { flex: 1, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  backButton: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  proceedButton: { backgroundColor: colors.accent, borderColor: "#6690FF" },
  actionText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
});
