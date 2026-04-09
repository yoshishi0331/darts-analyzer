import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { Stars } from "@/components/Stars";
import { RootTabParamList } from "@/navigation/AppNavigator";
import { calcRecordTotalScore, getRank as getScoringRank, toStars } from "@/domain/scoring";
import { AnalysisRecord } from "@/domain/types";
import { useAppState } from "@/state/AppProvider";
import { colors } from "@/theme/colors";
import { Rank, RankAppearance, rankAppearanceMap } from "@/theme/rankAppearance";

type Props = BottomTabScreenProps<RootTabParamList, "Home">;

// ── Constants ────────────────────────────────────────────────────────────────
const MEDAL_OUTER = 152;   // halo ring diameter
const MEDAL_RING  = 134;   // main ring diameter
const MEDAL_R     = MEDAL_RING / 2;


// ── RankMedal ────────────────────────────────────────────────────────────────
/**
 * Ring-style rank medal.
 * - Dark interior (not filled)
 * - Ring border glows in rank color
 * - Top edge brighter (metallic highlight)
 * - Rank text glows with rank color (textShadow)
 */
function RankMedal({ rank, palette }: { rank: string; palette: RankAppearance }) {
  return (
    <View style={medalStyles.container}>
      {/* Outer halo — same size as container, very soft */}
      <View
        style={[
          medalStyles.halo,
          {
            borderColor: palette.accent,
            shadowColor: palette.accent,
          },
        ]}
        pointerEvents="none"
      />

      {/* Main ring */}
      <View
        style={[
          medalStyles.ring,
          {
            // Metallic: top edge bright, sides/bottom in rank color
            borderTopColor: "rgba(255, 255, 255, 0.32)",
            borderLeftColor: palette.edge,
            borderRightColor: palette.edge,
            borderBottomColor: palette.edge,
            shadowColor: palette.accent,
          },
        ]}
      >
        {/* Inner background — deep dark navy */}
        <View style={medalStyles.inner} />

        {/* Top-of-ring shine arc */}
        <View style={medalStyles.ringTopArc} pointerEvents="none" />

        {/* Rank letter — colored + textShadow glow */}
        <Text
          style={[
            medalStyles.rankText,
            {
              color: palette.text,
              textShadowColor: palette.accent,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 20,
            },
          ]}
        >
          {rank}
        </Text>
      </View>
    </View>
  );
}

const medalStyles = StyleSheet.create({
  container: {
    width: MEDAL_OUTER,
    height: MEDAL_OUTER,
    alignItems: "center",
    justifyContent: "center",
  },
  // Elliptical glow on the floor beneath the ring
  floorGlow: {
    position: "absolute",
    bottom: -8,
    width: MEDAL_OUTER + 12,
    height: 24,
    borderRadius: 12,
    opacity: 0.55,
  },
  // Outer halo — wider soft ring
  halo: {
    position: "absolute",
    width: MEDAL_OUTER,
    height: MEDAL_OUTER,
    borderRadius: MEDAL_OUTER / 2,
    borderWidth: 1.5,
    opacity: 0.38,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 22,
    shadowOpacity: 0.55,
    elevation: 6,
  },
  // Main visible ring
  ring: {
    width: MEDAL_RING,
    height: MEDAL_RING,
    borderRadius: MEDAL_R,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    shadowOpacity: 0.35,
    elevation: 4,
  },
  // Dark interior fill
  inner: {
    position: "absolute",
    width: MEDAL_RING,
    height: MEDAL_RING,
    borderRadius: MEDAL_R,
    backgroundColor: "rgba(7, 14, 28, 0.96)",
  },
  // Soft glow cloud in the center
  innerGlow: {
    position: "absolute",
    width: 108,
    height: 84,
    borderRadius: 42,
    opacity: 0.85,
  },
  // Thin bright arc at the top of the ring (metallic highlight)
  ringTopArc: {
    position: "absolute",
    top: 0,
    left: "22%",
    right: "22%",
    height: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.36)",
    borderRadius: 1,
  },
  rankText: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: "800",
    letterSpacing: -2,
  },
});

// ── StatusHero ───────────────────────────────────────────────────────────────
function StatusHero({
  rank,
  score,
  delta,
}: {
  rank: Rank;
  score: number;
  delta: number;
}) {
  const palette = rankAppearanceMap[rank];

  return (
    <View
      style={[
        styles.heroCard,
        {
          // Metallic top edge in rank color, subtle bottom
          borderTopColor: palette.edge,
          borderBottomColor: "rgba(50, 70, 110, 0.28)",
        },
      ]}
    >
      {/* Heading */}
      <Text style={styles.heroHeading}>フォームランク</Text>
      <Text style={styles.heroCaption}>最新セッション</Text>

      {/* Medal + Score */}
      <View style={styles.heroCenter}>
        <RankMedal rank={rank} palette={palette} />
        <Text style={styles.heroScore}>
          総合{" "}
          <Text
            style={[
              styles.heroScoreAccent,
              {
                color: palette.text,
                textShadowColor: palette.accent,
                textShadowOffset: { width: 0, height: 0 },
                textShadowRadius: 10,
              },
            ]}
          >
            {score}
          </Text>
        </Text>
      </View>

      {/* Meta */}
      <Text style={styles.heroMeta}>
        前回比{" "}
        <Text style={[styles.heroMetaAccent, { color: palette.accent }]}>
          {delta >= 0 ? `+${delta}` : delta}
        </Text>
      </Text>

      <View style={[styles.heroDivider, { backgroundColor: palette.edge }]} />

      <View style={styles.heroFoot}>
        <Text style={styles.heroFootLabel}>評価基準</Text>
        <Text style={styles.heroFootValue}>
          フォーム再現性 × リリース位置 × グルーピング
        </Text>
      </View>
    </View>
  );
}

// ── MetricCard ───────────────────────────────────────────────────────────────
function MetricCard({
  title,
  value,
  compact = false,
}: {
  title: string;
  value?: number;
  compact?: boolean;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Text
          style={[
            styles.metricTitle,
            compact && styles.metricTitleCompact,
          ]}
        >
          {title}
        </Text>
      </View>

      <View style={styles.metricContent}>
        <Text style={styles.metricValue}>{value ?? "--"}</Text>
        <Stars value={toStars(value)} />
      </View>
    </View>
  );
}

// ── HomeScreen ───────────────────────────────────────────────────────────────
function recordTotalScore(r: AnalysisRecord): number {
  return calcRecordTotalScore(r.groupingScore, r.releaseStabilityScore, r.aimAccuracyScore) ?? 0;
}

export function HomeScreen({ navigation }: Props) {
  const { records } = useAppState();
  const detailRecords = records.filter((r) => r.mode === "detail");
  const latestRecord = detailRecords[0] ?? null;
  const prevRecord   = detailRecords[1] ?? null;

  // 最新1セッションのスコア。未測定はundefined→「--」表示
  const groupingScore        = latestRecord?.groupingScore        ?? undefined;
  const releaseScore         = latestRecord?.releaseStabilityScore ?? undefined;
  const aimScore             = latestRecord?.aimAccuracyScore      ?? undefined;

  const overallScore = latestRecord
    ? calcRecordTotalScore(latestRecord.groupingScore, latestRecord.releaseStabilityScore, latestRecord.aimAccuracyScore) ?? 0
    : 0;

  const delta = latestRecord && prevRecord
    ? recordTotalScore(latestRecord) - recordTotalScore(prevRecord)
    : 0;

  const rank = getScoringRank(overallScore);

  return (
    <Screen
      title="フォームチェッカー"
      subtitle="3投のリリースと結果からフォームを研究する"
    >
      <StatusHero rank={rank} score={overallScore} delta={delta} />

      {/* Metric row — top/bottom metallic border only */}
      <View style={styles.metricRow}>
        {/* Top metallic shine strip */}
        <View style={styles.metricRowShine} pointerEvents="none" />
        <MetricCard title="狙い精度" value={aimScore} />
        <MetricCard title="リリース安定" value={releaseScore} />
        <MetricCard title="グルーピング" value={groupingScore} compact />
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="フォーム解析を開始"
          size="large"
          onPress={() => navigation.navigate("Detail")}
        />
      </View>

      <View style={styles.bottomSpacer} />
    </Screen>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Hero card
  heroCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    backgroundColor: "#091220",
    // Metallic: top/bottom border only (colors set inline per rank)
    borderTopWidth: 1.5,
    borderBottomWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.38,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 30,
    elevation: 14,
  },
  heroSheen: {
    position: "absolute",
    left: 20,
    right: 20,
    top: -20,
    height: 160,
    borderRadius: 32,
    opacity: 0.22,
  },
  heroTopShine: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 0,
    height: 64,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.040)",
  },
  heroHeading: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  heroCaption: {
    marginTop: 6,
    fontSize: 13,
    color: "#B9C4D7",
  },
  heroCenter: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 10,
    gap: 10,
  },
  heroScore: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
  },
  heroScoreAccent: {
    fontWeight: "800",
  },
  heroMeta: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: "#CBD4E3",
  },
  heroMetaAccent: {
    fontWeight: "800",
  },
  heroDivider: {
    marginTop: 14,
    marginBottom: 14,
    height: 1,
    opacity: 0.5,
  },
  heroFoot: {
    alignItems: "center",
    gap: 5,
  },
  heroFootLabel: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  heroFootValue: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: "#DBE3F1",
  },

  // Metric row — top/bottom metallic border, no left/right
  metricRow: {
    flexDirection: "row",
    gap: 0,
    backgroundColor: "#0C1626",
    borderRadius: 30,
    // Top/bottom only — metallic
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(80, 100, 140, 0.22)",
    overflow: "hidden",
  },
  // Top shine inside metric row
  metricRowShine: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 0,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.032)",
    zIndex: 1,
  },
  metricCard: {
    flex: 1,
    minHeight: 124,
    paddingHorizontal: 14,
    paddingVertical: 16,
    justifyContent: "space-between",
    backgroundColor: "#0C1626",
    // Subtle vertical divider — metallic feel
    borderRightWidth: 1,
    borderRightColor: "rgba(130, 150, 180, 0.13)",
  },
  metricTop: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  metricTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.text,
  },
  metricTitleCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
  metricContent: {
    minHeight: 54,
    justifyContent: "flex-end",
    gap: 8,
  },
  metricValue: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },
  // Actions
  actions: {
    gap: 8,
    paddingTop: 0,
  },
  bottomSpacer: {
    height: 16,
  },
});
