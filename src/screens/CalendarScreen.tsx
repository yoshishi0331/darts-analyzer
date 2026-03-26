import { Ionicons } from "@expo/vector-icons";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Screen } from "@/components/Screen";
import { Stars } from "@/components/Stars";
import { toStars } from "@/domain/scoring";
import { AnalysisRecord } from "@/domain/types";
import { RootTabParamList } from "@/navigation/AppNavigator";
import { useAppState } from "@/state/AppProvider";
import { colors } from "@/theme/colors";
import { Rank, rankAppearanceMap } from "@/theme/rankAppearance";
import { createMonthGrid, groupRecordsByDate } from "@/utils/calendar";

type Props = BottomTabScreenProps<RootTabParamList, "Calendar">;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function scores(
  records: AnalysisRecord[],
  key: "groupingScore" | "releaseStabilityScore" | "aimAccuracyScore",
) {
  return records
    .map((record) => record[key])
    .filter((value): value is number => typeof value === "number");
}

function averageOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function calcFormScore(
  grouping: number | null,
  release: number | null,
  aim: number | null,
): number | null {
  if (grouping === null && release === null && aim === null) return null;
  return Math.round(
    (grouping ?? 0) * 0.4 + (release ?? 0) * 0.4 + (aim ?? 0) * 0.2,
  );
}

function getRank(score: number): Rank {
  if (score >= 90) return "SS";
  if (score >= 82) return "S";
  if (score >= 74) return "A+";
  if (score >= 66) return "A";
  if (score >= 58) return "B+";
  if (score >= 50) return "B";
  return "C";
}

function formatMonthTitle(date = new Date()): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function CalendarMedal({
  rank,
  score,
  active = false,
}: {
  rank: Rank;
  score?: number;
  active?: boolean;
}) {
  const palette = rankAppearanceMap[rank];

  return (
    <View style={styles.medalWrap}>
      <View
        style={[
          styles.medalGlow,
          {
            backgroundColor: palette.glow,
            opacity: active ? 0.95 : 0.72,
          },
        ]}
      />
      <View
        style={[
          styles.medalOuterRing,
          {
            borderColor: palette.edge,
          },
        ]}
      >
        <View
          style={[
            styles.medal,
            {
              borderColor: palette.edge,
              shadowColor: palette.accent,
              backgroundColor: palette.glow,
            },
          ]}
        >
          <Text style={[styles.medalRank, { color: palette.text }]}>{rank}</Text>
        </View>
      </View>
      {typeof score === "number" ? <Text style={styles.medalScore}>{score}</Text> : null}
    </View>
  );
}

function CalendarCell({
  day,
  score,
  active,
  hasRecord,
  onPress,
}: {
  day: number;
  score: number | null;
  active: boolean;
  hasRecord: boolean;
  onPress: () => void;
}) {
  const rank = score !== null ? getRank(score) : null;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.dayCell,
        hasRecord && styles.dayCellRecorded,
        active && styles.dayCellActive,
      ]}
    >
      <Text style={styles.dayNumber}>{day}</Text>
      <View style={styles.dayBody}>
        {hasRecord && rank !== null ? (
          <CalendarMedal rank={rank} score={score ?? undefined} active={active} />
        ) : (
          <Text style={styles.emptyMark}>+</Text>
        )}
      </View>
    </Pressable>
  );
}

function DetailMetric({
  label,
  value,
  stars,
  compact = false,
  last = false,
}: {
  label: string;
  value: number;
  stars: number;
  compact?: boolean;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailMetric, last && styles.detailMetricLast]}>
      <Text style={[styles.detailMetricLabel, compact && styles.detailMetricLabelCompact]}>
        {label}
      </Text>
      <Text style={styles.detailMetricValue}>{value}</Text>
      <Stars value={stars} />
    </View>
  );
}

export function CalendarScreen({ navigation }: Props) {
  const { records } = useAppState();
  const grouped = useMemo(() => groupRecordsByDate(records), [records]);
  const monthGrid = useMemo(() => createMonthGrid(new Date()), []);
  const currentMonthGrid = useMemo(() => monthGrid.filter((day) => day.inMonth), [monthGrid]);

  const initialSelectedKey =
    currentMonthGrid.find((day) => grouped[day.key])?.key ?? currentMonthGrid[0]?.key ?? "";
  const [selectedDateKey, setSelectedDateKey] = useState(initialSelectedKey);

  const selectedRecords = grouped[selectedDateKey] ?? [];
  const detailRecords = selectedRecords.filter((record) => record.mode === "detail");
  const groupingScore = averageOrNull(scores(detailRecords, "groupingScore"));
  const releaseScore = averageOrNull(scores(selectedRecords, "releaseStabilityScore"));
  const aimScore = averageOrNull(scores(detailRecords, "aimAccuracyScore"));
  const summaryScore = calcFormScore(groupingScore, releaseScore, aimScore);
  const selectedRank = summaryScore !== null ? getRank(summaryScore) : null;

  return (
    <Screen title="記録" subtitle="研究ログを振り返る">
      <View style={styles.calendarCard}>
        <View style={styles.calendarGlow} />

        <View style={styles.calendarHeader}>
          <Text style={styles.calendarTitle}>カレンダー</Text>
          <Ionicons name="calendar-outline" size={22} color="#B7C2DA" />
        </View>

        <View style={styles.monthRow}>
          <Ionicons name="chevron-back" size={22} color="#AEB8D6" />
          <Text style={styles.monthText}>{formatMonthTitle(new Date())}</Text>
          <Ionicons name="chevron-forward" size={22} color="#AEB8D6" />
        </View>

        <View style={styles.weekRow}>
          {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
            <Text key={day} style={styles.weekLabel}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {currentMonthGrid.map((day) => {
            const dayRecords = grouped[day.key] ?? [];
            const dayDetails = dayRecords.filter((record) => record.mode === "detail");
            const dayGrouping = averageOrNull(scores(dayDetails, "groupingScore"));
            const dayRelease = averageOrNull(scores(dayRecords, "releaseStabilityScore"));
            const dayAim = averageOrNull(scores(dayDetails, "aimAccuracyScore"));
            const dayScore = calcFormScore(dayGrouping, dayRelease, dayAim);

            return (
              <CalendarCell
                key={day.key}
                day={day.day}
                score={dayScore}
                hasRecord={dayRecords.length > 0}
                active={selectedDateKey === day.key}
                onPress={() => setSelectedDateKey(day.key)}
              />
            );
          })}
        </View>
      </View>

      <Card>
        <Text style={styles.detailDate}>{selectedDateKey}</Text>

        <View style={styles.detailCard}>
          <View style={styles.detailGlow} />

          <View style={styles.detailHead}>
            {selectedRank !== null ? (
              <CalendarMedal rank={selectedRank} />
            ) : null}
            <View style={styles.detailHeadText}>
              {selectedRank !== null ? (
                <Text style={styles.detailRankName}>研究ランク {selectedRank}</Text>
              ) : null}
              <Text style={styles.detailScore}>
                総合 {summaryScore !== null ? summaryScore : "---"}
              </Text>
              <Text style={styles.detailMeta}>直近 7 件ベース</Text>
            </View>
          </View>

          <View style={styles.detailMetricsRow}>
            <DetailMetric
              label="リリース安定"
              value={releaseScore ?? 0}
              stars={toStars(releaseScore ?? 0)}
              compact
            />
            <DetailMetric
              label="グルーピング"
              value={groupingScore ?? 0}
              stars={toStars(groupingScore ?? 0)}
              compact
              last={aimScore === null}
            />
            {aimScore !== null && (
              <DetailMetric
                label="狙い精度"
                value={aimScore}
                stars={toStars(aimScore)}
                compact
                last
              />
            )}
          </View>

          <View style={styles.memoBox}>
            <Text style={styles.memoLabel}>メモ</Text>
            {selectedRecords.length === 0 ? (
              <Text style={styles.memoText}>この日の記録はまだありません。</Text>
            ) : (
              selectedRecords.map((record) => (
                <Text key={record.id} style={styles.memoText}>
                  ・{record.memo || "メモなし"}
                </Text>
              ))
            )}
          </View>
        </View>
      </Card>

      <PrimaryButton
        label="フォーム解析を開始"
        size="large"
        onPress={() => navigation.navigate("Detail")}
      />

      <View style={styles.bottomSpacer} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  calendarCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 34,
    padding: 18,
    backgroundColor: "#091220",
    borderWidth: 1,
    borderColor: "rgba(111, 131, 166, 0.22)",
    gap: 14,
    shadowColor: "#000000",
    shadowOpacity: 0.34,
    shadowOffset: { width: 0, height: 18 },
    shadowRadius: 28,
    elevation: 12,
  },
  calendarGlow: {
    position: "absolute",
    top: -48,
    left: "28%",
    width: 220,
    height: 100,
    borderRadius: 110,
    backgroundColor: "rgba(145, 156, 255, 0.05)",
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  calendarTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
  },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  monthText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#D8E0F1",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  weekLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 12,
    color: "#AAB6CE",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayCell: {
    width: "13.9%",
    minHeight: 108,
    paddingTop: 9,
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: "rgba(18, 28, 45, 0.62)",
    borderWidth: 1,
    borderColor: "rgba(120, 136, 168, 0.11)",
    justifyContent: "space-between",
    alignItems: "center",
    overflow: "hidden",
  },
  dayCellRecorded: {
    backgroundColor: "rgba(24, 36, 58, 0.78)",
  },
  dayCellActive: {
    backgroundColor: "rgba(31, 45, 74, 0.9)",
    borderColor: "rgba(122, 154, 255, 0.22)",
  },
  dayNumber: {
    alignSelf: "flex-start",
    fontSize: 13,
    color: "#DBE5F5",
  },
  dayBody: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 5,
  },
  emptyMark: {
    fontSize: 20,
    color: "#728099",
  },
  medalWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  medalGlow: {
    position: "absolute",
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  medalOuterRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(7, 12, 21, 0.26)",
  },
  medal: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    elevation: 0,
  },
  medalRank: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  medalScore: {
    marginTop: 4,
    fontSize: 9,
    color: "#DCE3F1",
  },
  detailDate: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  detailCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    padding: 18,
    backgroundColor: "#0A1323",
    borderWidth: 1,
    borderColor: "rgba(111, 131, 166, 0.22)",
    gap: 16,
  },
  detailGlow: {
    position: "absolute",
    left: 20,
    top: -30,
    width: 180,
    height: 100,
    borderRadius: 90,
    backgroundColor: "rgba(145, 156, 255, 0.05)",
  },
  detailHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  detailHeadText: {
    gap: 2,
  },
  detailRankName: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  detailScore: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
  },
  detailMeta: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailMetricsRow: {
    flexDirection: "row",
  },
  detailMetric: {
    flex: 1,
    minHeight: 94,
    gap: 6,
    paddingRight: 10,
    marginRight: 10,
    borderRightWidth: 1,
    borderRightColor: "rgba(130, 150, 180, 0.14)",
  },
  detailMetricLast: {
    paddingRight: 0,
    marginRight: 0,
    borderRightWidth: 0,
  },
  detailMetricLabel: {
    fontSize: 12,
    lineHeight: 16,
    minHeight: 16,
    color: colors.textSecondary,
  },
  detailMetricLabelCompact: {
    fontSize: 11,
    lineHeight: 16,
    minHeight: 16,
    color: colors.textSecondary,
  },
  detailMetricValue: {
    fontSize: 24,
    minHeight: 30,
    fontWeight: "800",
    color: colors.text,
  },
  memoBox: {
    borderTopWidth: 1,
    borderTopColor: "rgba(130, 150, 180, 0.14)",
    paddingTop: 14,
    gap: 8,
  },
  memoLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  memoText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#D8E1EF",
  },
  bottomSpacer: {
    height: 44,
  },
});
