import { useState } from "react";
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { ResearchCanvas } from "@/components/ResearchCanvas";
import { Stars } from "@/components/Stars";
import { mockAnalysisEngine } from "@/domain/analysisAdapter";
import { TARGET_POINTS } from "@/domain/targetPoints";
import { getFeedback, toStars, RecentSession } from "@/domain/scoring";
import { SessionConfig, ThrowWindow } from "@/domain/types";
import { colors } from "@/theme/colors";

// scale値は analysisAdapter.ts で一元管理。ここでは直接指定しない。
// 旧: GROUPING_SCALE=2.8(1.6), RELEASE_SCALE=1.9, AIM_SCALE=3.2(2.0)

const THROW_COLORS = [colors.throw1, colors.throw2, colors.throw3];
// 角度スケール: 0°=真下, 90°=L字（真上）, 180°=水平（理想リリース）
// TODO: 新スケールに合わせて閾値を実機確認後に調整
const LATE_THRESHOLD = 95;

type Props = {
  throwWindows: ThrowWindow[];
  sessionConfig: SessionConfig;
  stepNumber: number;
  totalSteps: number;
  armAngles?: Array<number | null>;
  shoulderPoints?: Array<{ x: number; y: number } | null>;
  elbowPoints?: Array<{ x: number; y: number } | null>;
  wristPoints?: Array<{ x: number; y: number } | null>;
  recentSessions?: RecentSession[];
  onBack: () => void;
  onProceed: () => void;
};

type Pt = { x: number; y: number };

function scaleArmToSvg(s: Pt, e: Pt, w: Pt, svgW: number, svgH: number, pad: number) {
  const xs = [s.x, e.x, w.x];
  const ys = [s.y, e.y, w.y];
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = Math.max(maxX - minX, 0.02);
  const rangeY = Math.max(maxY - minY, 0.02);
  const avW = svgW - 2 * pad;
  const avH = svgH - 2 * pad;
  const scale = Math.min(avW / rangeX, avH / rangeY);
  const scaledW = rangeX * scale, scaledH = rangeY * scale;
  const ox = pad + (avW - scaledW) / 2;
  const oy = pad + (avH - scaledH) / 2;
  const px = (x: number) => ox + (x - minX) * scale;
  const py = (y: number) => oy + (y - minY) * scale;
  return { s: { x: px(s.x), y: py(s.y) }, e: { x: px(e.x), y: py(e.y) }, w: { x: px(w.x), y: py(w.y) } };
}

function buildArcPath(sPos: Pt, ePos: Pt, wPos: Pt, r: number): string {
  const d1x = sPos.x - ePos.x, d1y = sPos.y - ePos.y;
  const d1len = Math.sqrt(d1x * d1x + d1y * d1y);
  const d2x = wPos.x - ePos.x, d2y = wPos.y - ePos.y;
  const d2len = Math.sqrt(d2x * d2x + d2y * d2y);
  if (d1len < 0.001 || d2len < 0.001) return "";
  const a1x = d1x / d1len, a1y = d1y / d1len;
  const a2x = d2x / d2len, a2y = d2y / d2len;
  const ax1 = ePos.x + a1x * r, ay1 = ePos.y + a1y * r;
  const ax2 = ePos.x + a2x * r, ay2 = ePos.y + a2y * r;
  const cross = a1x * a2y - a1y * a2x;
  const sweep = cross > 0 ? 1 : 0;
  return `M ${ax1} ${ay1} A ${r} ${r} 0 0 ${sweep} ${ax2} ${ay2}`;
}

function ArmAngleSection({
  armAngles,
  shoulderPoints,
  elbowPoints,
  wristPoints,
}: {
  armAngles: Array<number | null>;
  shoulderPoints?: Array<Pt | null>;
  elbowPoints?: Array<Pt | null>;
  wristPoints?: Array<Pt | null>;
}) {
  const [width, setWidth] = useState(0);

  const hasAny = armAngles.some((a) => a !== null);
  if (!hasAny) return null;

  const handleLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const colWidth = width / 3;
  const SVG_H = 90;
  const PAD = 10;

  return (
    <View style={styles.armCard}>
      <Text style={styles.armCardTitle}>リリースタイミング（腕の角度）</Text>
      <View style={styles.armColumns} onLayout={handleLayout}>
        {armAngles.map((angle, i) => {
          const color = THROW_COLORS[i];
          const isLate = angle !== null && angle >= LATE_THRESHOLD;
          const lineColor = isLate ? "#D86A6C" : "#49A37E";
          const s = shoulderPoints?.[i] ?? null;
          const e = elbowPoints?.[i] ?? null;
          const w = wristPoints?.[i] ?? null;

          return (
            <View key={i} style={[styles.armColumn, { width: colWidth }]}>
              {width > 0 && (
                <Svg width={colWidth} height={SVG_H}>
                  {s && e && w ? (() => {
                    const pts = scaleArmToSvg(s, e, w, colWidth, SVG_H, PAD);
                    const arcPath = buildArcPath(pts.s, pts.e, pts.w, 11);
                    return (
                      <>
                        <Line x1={pts.s.x} y1={pts.s.y} x2={pts.e.x} y2={pts.e.y}
                          stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" />
                        <Line x1={pts.e.x} y1={pts.e.y} x2={pts.w.x} y2={pts.w.y}
                          stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" />
                        {arcPath ? (
                          <Path d={arcPath} stroke={lineColor} strokeWidth={1.5}
                            fill="none" opacity={0.85} />
                        ) : null}
                        <Circle cx={pts.s.x} cy={pts.s.y} r={4} fill={color} opacity={0.5} />
                        <Circle cx={pts.e.x} cy={pts.e.y} r={6} fill={color} />
                        <Circle cx={pts.w.x} cy={pts.w.y} r={4} fill={color} opacity={0.5} />
                      </>
                    );
                  })() : (
                    <Circle
                      cx={colWidth / 2} cy={SVG_H / 2} r={6}
                      fill={angle !== null ? color : "transparent"}
                      stroke={color} strokeWidth={2}
                    />
                  )}
                </Svg>
              )}
              <Text style={[styles.armThrowLabel, { color }]}>{i + 1}投目</Text>
              {angle !== null ? (
                <Text style={[styles.armAngleValue, isLate && styles.armAngleLate]}>
                  {Math.round(angle)}°
                </Text>
              ) : (
                <Text style={styles.armAngleEmpty}>--</Text>
              )}
            </View>
          );
        })}
      </View>
      {armAngles.some((a) => a !== null && a >= LATE_THRESHOLD) && (
        <Text style={styles.armNote}>※ {LATE_THRESHOLD}°以上はリリースが遅い可能性があります</Text>
      )}
      <Text style={styles.armCaveat}>※ 撮影角度により誤差があります</Text>
    </View>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Stars value={toStars(score)} />
      <Text style={styles.scoreValue}>{score}点</Text>
    </View>
  );
}

export function CompareScreen({ throwWindows, sessionConfig, stepNumber, totalSteps, armAngles, shoulderPoints, elbowPoints, wristPoints, recentSessions = [], onBack, onProceed }: Props) {
  const boardHits = throwWindows.map((w) => w.impactPoint ?? { x: 0.5, y: 0.5 });
  const releasePoints = throwWindows.map((w) => w.releasePoint);

  const targetPoint = sessionConfig.targetLabel != null ? TARGET_POINTS[sessionConfig.targetLabel] : null;
  const hasLanding = sessionConfig.measureGrouping || sessionConfig.measureAim;

  const gScore = sessionConfig.measureGrouping
    ? mockAnalysisEngine.computeGroupingScore(boardHits)
    : null;
  const releaseScore = sessionConfig.measureRelease
    ? mockAnalysisEngine.computeReleaseStabilityScore(releasePoints)
    : null;
  const aimScore = sessionConfig.measureAim && targetPoint != null
    ? mockAnalysisEngine.computeAimAccuracyScore(boardHits, targetPoint)
    : null;

  const feedback = getFeedback({
    landingPoints: hasLanding ? boardHits : null,
    targetPoint: targetPoint ?? null,
    armAngles: armAngles ?? null,
    groupingScore: gScore,
    recentSessions,
  });

  return (
    <View style={styles.wrapper}>
      {/* Step header */}
      <Text style={styles.stepText}>ステップ {stepNumber}/{totalSteps}　比較・分析</Text>

      {/* Research canvas */}
      <ResearchCanvas
        boardHits={boardHits}
        releasePoints={releasePoints}
        showRelease={sessionConfig.measureRelease}
        showBoard={sessionConfig.measureGrouping || sessionConfig.measureAim}
      />

      {/* Arm angle section */}
      {armAngles && (
        <ArmAngleSection
          armAngles={armAngles}
          shoulderPoints={shoulderPoints}
          elbowPoints={elbowPoints}
          wristPoints={wristPoints}
        />
      )}

      {/* Score section */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreCardTitle}>スコア</Text>

        {gScore !== null && <ScoreRow label="グルーピング" score={gScore} />}
        {releaseScore !== null && <ScoreRow label="リリース安定" score={releaseScore} />}
        {aimScore !== null && <ScoreRow label="狙い精度" score={aimScore} />}
      </View>

      <Text style={styles.note}>※ スコアは目安です</Text>

      {/* Feedback card */}
      {feedback.length > 0 && (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackLabel}>フォームフィードバック</Text>
          {feedback.map((msg, i) => (
            <Text key={i} style={[styles.feedbackMain, i > 0 && styles.feedbackMainSep]}>
              {msg}
            </Text>
          ))}
        </View>
      )}

      {/* Navigation */}
      <View style={styles.actionRow}>
        <Pressable onPressIn={onBack} style={[styles.actionBtn, styles.backBtn]}>
          <Text style={styles.backText}>戻る</Text>
        </Pressable>
        <Pressable onPressIn={onProceed} style={[styles.actionBtn, styles.proceedBtn]}>
          <Text style={styles.proceedText}>保存して終了</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 16 },

  stepText: { fontSize: 15, fontWeight: "700", color: colors.text, paddingHorizontal: 2 },

  scoreCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  scoreCardTitle: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },

  scoreRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  scoreLabel: { width: 80, fontSize: 13, fontWeight: "600", color: colors.text },
  scoreValue: { marginLeft: "auto", fontSize: 13, fontWeight: "800", color: colors.text },

  note: { fontSize: 11, color: colors.textSecondary, textAlign: "center", marginTop: -4 },

  feedbackCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  feedbackLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    opacity: 0.6,
  },
  feedbackMain: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginTop: 8,
  },
  feedbackMainSep: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  armCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 8,
  },
  armCardTitle: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  armColumns: { flexDirection: "row" },
  armColumn: { alignItems: "center", gap: 2 },
  armThrowLabel: { fontSize: 12, fontWeight: "700" },
  armAngleValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  armAngleLate: { color: "#D86A6C" },
  armAngleEmpty: { fontSize: 18, fontWeight: "800", color: colors.textSecondary, opacity: 0.4 },
  armNote: { fontSize: 11, color: "#D86A6C", opacity: 0.85, marginTop: 2 },
  armCaveat: { fontSize: 10, color: colors.textSecondary, opacity: 0.5, marginTop: 2 },

  actionRow: { flexDirection: "row", gap: 12, marginTop: 4 },
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
  backText: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
  proceedText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
});
