import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BoardInput } from "@/components/BoardInput";
import { DPad } from "@/components/DPad";
import { ThrowTabs } from "@/components/ThrowTabs";
import { ThrowIndex, ThrowWindow } from "@/domain/types";
import { colors } from "@/theme/colors";

type Props = {
  throws: ThrowWindow[];
  activeIndex: ThrowIndex;
  stepNumber: number;
  totalSteps: number;
  onUpdateThrow: (index: ThrowIndex, patch: Partial<ThrowWindow>) => void;
  onSelectThrow: (index: ThrowIndex) => void;
  onBack: () => void;
  onProceed: () => void;
};

const CENTER = { x: 0.5, y: 0.5 };

export function LandingScreen({
  throws,
  activeIndex,
  stepNumber,
  totalSteps,
  onUpdateThrow,
  onSelectThrow,
  onBack,
  onProceed,
}: Props) {
  // Local override so we can toggle "all 3 visible" vs "active only"
  const [showAll, setShowAll] = useState(true);

  // showAll=true: 入力済み投 + activeのみ表示（nullの非active投は非表示）
  const displayEntries = showAll
    ? throws
        .map((t, i) => ({ point: t.impactPoint ?? CENTER, origIndex: i, show: t.impactPoint !== null || i === activeIndex }))
        .filter((e) => e.show)
    : [{ point: throws[activeIndex].impactPoint ?? CENTER, origIndex: activeIndex, show: true }];

  const boardPoints = displayEntries.map((e) => e.point);
  const boardActiveIndex = displayEntries.findIndex((e) => e.origIndex === activeIndex);
  const boardThrowIndices = displayEntries.map((e) => e.origIndex);

  const handleSelectPoint = (point: { x: number; y: number }) => {
    onUpdateThrow(activeIndex, { impactPoint: point });
  };

  const handleDragPoint = (index: number, point: { x: number; y: number }) => {
    onUpdateThrow(index as ThrowIndex, { impactPoint: point });
  };

  const allSet = throws.every((t) => t.impactPoint !== null);

  return (
    <View style={styles.wrapper}>
      {/* Step header */}
      <Text style={styles.stepText}>ステップ {stepNumber}/{totalSteps}　着弾点を記録する</Text>
      <Text style={styles.hintText}>ダーツが刺さった位置をタップしてください</Text>

      {/* Throw tabs */}
      <ThrowTabs activeIndex={activeIndex} onSelect={onSelectThrow} />

      {/* Board canvas */}
      <BoardInput
        points={boardPoints}
        activeIndex={boardActiveIndex}
        throwIndices={boardThrowIndices}
        onSelectPoint={handleSelectPoint}
        onDragPoint={(index, point) => {
          const realIndex = boardThrowIndices[index] ?? activeIndex;
          handleDragPoint(realIndex as ThrowIndex, point);
        }}
      />

      {/* Show all toggle */}
      <Pressable
        onPressIn={() => setShowAll((v) => !v)}
        style={[styles.toggleBtn, showAll && styles.toggleBtnActive]}
      >
        <Text style={[styles.toggleText, showAll && styles.toggleTextActive]}>
          {showAll ? "3投まとめて表示中" : "選択中の投のみ表示中"}
        </Text>
      </Pressable>

      {/* Progress indicator */}
      <View style={styles.statusRow}>
        {throws.map((t, i) => (
          <View
            key={i}
            style={[styles.dot, t.impactPoint !== null && styles.dotSet]}
          />
        ))}
        <Text style={styles.statusCaption}>
          {throws.filter((t) => t.impactPoint !== null).length} / 3 投入力済み
        </Text>
      </View>

      {/* D-pad: nudge active impact point */}
      <DPad
        onMove={(dx, dy) => {
          const p = throws[activeIndex].impactPoint ?? CENTER;
          onUpdateThrow(activeIndex, {
            impactPoint: {
              x: Math.max(0, Math.min(1, p.x + dx)),
              y: Math.max(0, Math.min(1, p.y + dy)),
            },
          });
        }}
      />

      {/* Navigation */}
      <View style={styles.actionRow}>
        <Pressable onPressIn={onBack} style={[styles.actionBtn, styles.backBtn]}>
          <Text style={styles.actionText}>戻る</Text>
        </Pressable>
        <Pressable
          onPressIn={allSet ? onProceed : undefined}
          style={[styles.actionBtn, styles.proceedBtn, !allSet && styles.proceedBtnDim]}
        >
          <Text style={styles.actionText}>比較・分析へ →</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  stepText: { fontSize: 15, fontWeight: "700", color: colors.text, paddingHorizontal: 2 },
  hintText: { fontSize: 12, color: colors.textSecondary, marginTop: -4 },
  toggleBtn: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  toggleBtnActive: {
    backgroundColor: "rgba(55, 97, 214, 0.22)",
    borderColor: "rgba(122, 154, 255, 0.34)",
  },
  toggleText: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
  toggleTextActive: { color: colors.text },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  dotSet: { backgroundColor: colors.success },
  statusCaption: { fontSize: 12, color: colors.textSecondary },
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
  proceedBtnDim: { opacity: 0.72 },
  actionText: { fontSize: 15, fontWeight: "800", color: "#FFFFFF" },
});
