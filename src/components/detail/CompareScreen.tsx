import { Pressable, StyleSheet, Text, View } from "react-native";

import { ResearchCanvas } from "@/components/ResearchCanvas";
import { Stars } from "@/components/Stars";
import { TARGET_POINTS } from "@/domain/targetPoints";
import {
  getFeedback,
  groupingScore,
  scoreFromAimAccuracy,
  scoreFromPointCluster,
  toStars,
} from "@/domain/scoring";
import { SessionConfig, ThrowWindow } from "@/domain/types";
import { colors } from "@/theme/colors";

type Props = {
  throwWindows: ThrowWindow[];
  sessionConfig: SessionConfig;
  stepNumber: number;
  totalSteps: number;
  onBack: () => void;
  onProceed: () => void;
};

// グルーピングスコアのscale: analysisAdapter.ts の computeGroupingScore と合わせる
const GROUPING_SCALE = 1.6;
// リリース安定スコアのscale: analysisAdapter.ts の computeReleaseStabilityScore と合わせる
const RELEASE_SCALE = 1.9;
// TODO: 狙い精度のscaleは実機確認後に調整する
const AIM_SCALE = 2.0;

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Stars value={toStars(score)} />
      <Text style={styles.scoreValue}>{score}点</Text>
    </View>
  );
}

export function CompareScreen({ throwWindows, sessionConfig, stepNumber, totalSteps, onBack, onProceed }: Props) {
  const boardHits = throwWindows.map((w) => w.impactPoint ?? { x: 0.5, y: 0.5 });
  const releasePoints = throwWindows.map((w) => w.releasePoint);

  const targetPoint = sessionConfig.targetLabel != null ? TARGET_POINTS[sessionConfig.targetLabel] : null;

  const gScore = sessionConfig.measureGrouping
    ? groupingScore(boardHits, GROUPING_SCALE)
    : null;
  const releaseScore = sessionConfig.measureRelease
    ? scoreFromPointCluster(releasePoints, RELEASE_SCALE)
    : null;
  const aimScore = sessionConfig.measureAim && targetPoint != null
    ? scoreFromAimAccuracy(boardHits, targetPoint, AIM_SCALE)
    : null;

  const feedback = getFeedback({
    releaseScore,
    groupingScore: gScore,
    aimScore,
    boardHits,
    targetPoint: targetPoint ?? null,
    measuredMetrics: {
      grouping: sessionConfig.measureGrouping,
      release: sessionConfig.measureRelease,
      aim: sessionConfig.measureAim,
    },
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

      {/* Score section */}
      <View style={styles.scoreCard}>
        <Text style={styles.scoreCardTitle}>スコア</Text>

        {gScore !== null && <ScoreRow label="グルーピング" score={gScore} />}
        {releaseScore !== null && <ScoreRow label="リリース安定" score={releaseScore} />}
        {aimScore !== null && <ScoreRow label="狙い精度" score={aimScore} />}
      </View>

      <Text style={styles.note}>※ スコアは目安です</Text>

      {/* Feedback card */}
      {feedback !== null && (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackLabel}>📋 フォームフィードバック</Text>
          <Text style={styles.feedbackMain}>{feedback.main}</Text>
          {feedback.direction !== null && (
            <Text style={styles.feedbackDirection}>→ {feedback.direction}</Text>
          )}
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
  feedbackDirection: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    opacity: 0.8,
    marginTop: 10,
  },

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
