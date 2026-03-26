import { Pressable, StyleSheet, Text, View } from "react-native";

import { Point } from "@/domain/types";
import { TargetLabel } from "@/domain/types";
import { colors } from "@/theme/colors";

type Props = {
  targetLabel: TargetLabel | null;
  onSelectTarget: (label: TargetLabel) => void;
  onBack: () => void;
  onProceed: () => void;
};

type TargetItem = { label: TargetLabel; display: string };

const TARGETS: TargetItem[] = [
  { label: "bull", display: "ブル" },
  { label: "20",   display: "20" },
  { label: "19",   display: "19" },
  { label: "18",   display: "18" },
  { label: "17",   display: "17" },
  { label: "16",   display: "16" },
  { label: "15",   display: "15" },
];

// トリプルエリア中心座標（BoardCanvas の正規化座標系）
// ブル以外はトリプルリング中心（103mm）を基準に算出。
// 座標は要実機確認・微調整。
export const TARGET_POINTS: Record<TargetLabel, Point> = {
  bull: { x: 0.50, y: 0.50 },
  "20": { x: 0.50, y: 0.29 },
  "19": { x: 0.44, y: 0.70 },
  "18": { x: 0.62, y: 0.33 },
  "17": { x: 0.57, y: 0.70 },
  "16": { x: 0.33, y: 0.62 },
  "15": { x: 0.67, y: 0.62 },
};

// TARGETS を2列ずつに分割
const ROWS: TargetItem[][] = [];
for (let i = 0; i < TARGETS.length; i += 2) {
  ROWS.push(TARGETS.slice(i, i + 2));
}

export function TargetScreen({ targetLabel, onSelectTarget, onBack, onProceed }: Props) {
  const canProceed = targetLabel !== null;

  return (
    <View style={styles.wrapper}>
      {/* Step header */}
      <Text style={styles.stepText}>ステップ 3/5　狙いを選択</Text>

      {/* Description */}
      <View style={styles.descBlock}>
        <Text style={styles.descMain}>今回狙った場所を選んでください</Text>
        <Text style={styles.descSub}>
          20〜15はトリプルエリア中心を基準にしています。ブルは中心に近いほど高評価になります
        </Text>
      </View>

      {/* 2-column selection grid */}
      <View style={styles.grid}>
        {ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((item) => {
              const isActive = targetLabel === item.label;
              return (
                <Pressable
                  key={item.label}
                  onPress={() => onSelectTarget(item.label)}
                  style={({ pressed }) => [
                    styles.gridItem,
                    isActive && styles.gridItemActive,
                    pressed && !isActive && styles.gridItemPressed,
                  ]}
                >
                  <Text style={[styles.gridItemText, isActive && styles.gridItemTextActive]}>
                    {item.display}
                  </Text>
                </Pressable>
              );
            })}
            {row.length === 1 && <View style={styles.gridItemSpacer} />}
          </View>
        ))}
      </View>

      {/* Selection feedback */}
      {targetLabel !== null && (
        <Text style={styles.selectedFeedback}>
          選択中：{TARGETS.find((t) => t.label === targetLabel)?.display ?? ""}
        </Text>
      )}

      {/* Navigation */}
      <View style={styles.actionRow}>
        <Pressable onPressIn={onBack} style={[styles.actionBtn, styles.backBtn]}>
          <Text style={styles.backText}>戻る</Text>
        </Pressable>
        <Pressable
          onPressIn={canProceed ? onProceed : undefined}
          style={[styles.actionBtn, styles.proceedBtn, !canProceed && styles.proceedBtnDim]}
        >
          <Text style={styles.proceedText}>次へ：着弾点を入力する</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },

  stepText: { fontSize: 15, fontWeight: "700", color: colors.text, paddingHorizontal: 2 },

  descBlock: { gap: 6 },
  descMain: { fontSize: 14, fontWeight: "600", color: colors.text },
  descSub: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  grid: { gap: 10 },
  gridRow: { flexDirection: "row", gap: 10 },
  gridItem: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridItemActive: {
    backgroundColor: "rgba(42, 95, 255, 0.18)",
    borderColor: "rgba(102, 144, 255, 0.70)",
  },
  gridItemPressed: { opacity: 0.65 },
  gridItemSpacer: { flex: 1 },
  gridItemText: { fontSize: 20, fontWeight: "800", color: colors.textSecondary },
  gridItemTextActive: { color: colors.text },

  selectedFeedback: {
    fontSize: 12,
    color: colors.accent,
    textAlign: "center",
    fontWeight: "600",
    opacity: 0.85,
  },
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
  proceedBtnDim: { opacity: 0.42 },
  backText: { fontSize: 15, fontWeight: "700", color: colors.textSecondary },
  proceedText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
});
