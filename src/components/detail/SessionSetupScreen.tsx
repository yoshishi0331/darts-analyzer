import { Pressable, StyleSheet, Text, View } from "react-native";

import { SessionConfig, TargetLabel } from "@/domain/types";
import { colors } from "@/theme/colors";

type Props = {
  config: SessionConfig;
  onConfigChange: (config: SessionConfig) => void;
  onProceed: (config: SessionConfig) => void;
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

type MeasureItem = {
  key: keyof Pick<SessionConfig, "measureGrouping" | "measureRelease" | "measureAim">;
  label: string;
  sublabel: string;
};

const MEASURE_ITEMS: MeasureItem[] = [
  { key: "measureGrouping", label: "グルーピング",  sublabel: "着弾点 3投をタップ" },
  { key: "measureRelease",  label: "リリース安定",  sublabel: "リリース点 3投をタップ" },
  { key: "measureAim",      label: "狙い精度",      sublabel: "狙いと着弾を比較" },
];

function CheckRow({
  label,
  sublabel,
  checked,
  dimmed,
  onToggle,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
  dimmed?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [styles.checkRow, pressed && styles.checkRowPressed, dimmed && styles.checkRowDimmed]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.checkLabels}>
        <Text style={[styles.checkLabel, !checked && styles.checkLabelOff]}>{label}</Text>
        <Text style={styles.checkSublabel}>{sublabel}</Text>
      </View>
    </Pressable>
  );
}

export function SessionSetupScreen({ config, onConfigChange, onProceed }: Props) {
  const atLeastOne = config.measureGrouping || config.measureRelease || config.measureAim;
  const aimNeedsTarget = config.measureAim && config.targetLabel === null;
  const canProceed = atLeastOne && !aimNeedsTarget;

  const toggle = (key: MeasureItem["key"]) => {
    onConfigChange({ ...config, [key]: !config[key] });
  };

  const selectTarget = (label: TargetLabel) => {
    onConfigChange({ ...config, targetLabel: config.targetLabel === label ? null : label });
  };

  return (
    <View style={styles.wrapper}>
      {/* Title */}
      <Text style={styles.title}>今日の練習設定</Text>

      {/* ── 狙い ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>── 狙い ──</Text>
        <View style={styles.targetRow}>
          {TARGETS.map((item) => {
            const isActive = config.targetLabel === item.label;
            return (
              <Pressable
                key={item.label}
                onPress={() => selectTarget(item.label)}
                style={({ pressed }) => [
                  styles.targetBtn,
                  isActive && styles.targetBtnActive,
                  pressed && !isActive && styles.targetBtnPressed,
                ]}
              >
                <Text style={[styles.targetBtnText, isActive && styles.targetBtnTextActive]}>
                  {item.display}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {config.targetLabel === null && config.measureAim && (
          <Text style={styles.aimWarning}>※ 狙い精度をONにするには狙いの選択が必要です</Text>
        )}
      </View>

      {/* ── 測定項目 ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>── 測定項目 ──</Text>
        <View style={styles.checkList}>
          {MEASURE_ITEMS.map((item) => (
            <CheckRow
              key={item.key}
              label={item.label}
              sublabel={item.sublabel}
              checked={config[item.key]}
              dimmed={item.key === "measureAim" && config.targetLabel === null}
              onToggle={() => toggle(item.key)}
            />
          ))}
        </View>
        {!atLeastOne && (
          <Text style={styles.aimWarning}>※ 測定項目を最低1つONにしてください</Text>
        )}
      </View>

      {/* CTA */}
      <Pressable
        onPress={canProceed ? () => onProceed(config) : undefined}
        style={({ pressed }) => [
          styles.ctaBtn,
          !canProceed && styles.ctaBtnDim,
          pressed && canProceed && styles.ctaBtnPressed,
        ]}
      >
        <Text style={styles.ctaBtnText}>
          {config.measureRelease ? "動画を選ぶ　→" : "着弾点を入力する　→"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 20 },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    paddingHorizontal: 2,
  },

  section: { gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },

  // Target row — horizontal, all 7 items equal width
  targetRow: {
    flexDirection: "row",
    gap: 6,
  },
  targetBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetBtnActive: {
    backgroundColor: "rgba(42, 95, 255, 0.18)",
    borderColor: "rgba(102, 144, 255, 0.70)",
  },
  targetBtnPressed: { opacity: 0.65 },
  targetBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textSecondary,
  },
  targetBtnTextActive: { color: colors.text },

  aimWarning: {
    fontSize: 11,
    color: "#E57373",
    marginTop: -4,
  },

  // Measure items checklist
  checkList: { gap: 4 },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  checkRowPressed: { opacity: 0.72 },
  checkRowDimmed: { opacity: 0.45 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 15,
  },
  checkLabels: { flex: 1 },
  checkLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  checkLabelOff: { color: colors.textSecondary },
  checkSublabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
    opacity: 0.7,
  },

  // CTA button — full width
  ctaBtn: {
    minHeight: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: "#6690FF",
    marginTop: 4,
  },
  ctaBtnDim: { opacity: 0.38 },
  ctaBtnPressed: { opacity: 0.82 },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
