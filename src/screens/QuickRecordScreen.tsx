import { useEffect, useRef, useState } from "react";
import {
  Modal,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from "@react-native-voice/voice";

import { colors } from "@/theme/colors";

// ─────────────────────────────────────────────────────────────
// dartsNumericMapper
// 音声認識の誤認識パターンを含む、ダーツ専用の数字変換辞書。
// 完全一致で評価する（前後の余分な語はここでは処理しない）。
// ─────────────────────────────────────────────────────────────
export type DartsNumber = number | "BULL"; // 1-20 or BULL

export function dartsNumericMapper(text: string): DartsNumber | null {
  const t = text.trim();

  // 半角数字の直接一致
  const numMatch = t.match(/^(\d+)$/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 20) return n;
    if (n === 25) return "BULL";
    return null;
  }

  // ブル
  if (/^(ブル|ぶる|bull|BULL)$/i.test(t)) return "BULL";

  // 20（誤認識が最も多いため列挙）
  if (/^(二十|にじゅう|二次|にじ|二時|二次|に次|二重|にじゅ|虹|弐十)$/.test(t)) return 20;
  // 19
  if (/^(十九|じゅうく|じゅうきゅう)$/.test(t)) return 19;
  // 18
  if (/^(十八|じゅうはち)$/.test(t)) return 18;
  // 17
  if (/^(十七|じゅうなな|じゅうしち)$/.test(t)) return 17;
  // 16
  if (/^(十六|じゅうろく)$/.test(t)) return 16;
  // 15
  if (/^(十五|じゅうご)$/.test(t)) return 15;
  // 14
  if (/^(十四|じゅうし|じゅうよん)$/.test(t)) return 14;
  // 13
  if (/^(十三|じゅうさん)$/.test(t)) return 13;
  // 12
  if (/^(十二|じゅうに)$/.test(t)) return 12;
  // 11
  if (/^(十一|じゅういち)$/.test(t)) return 11;
  // 10（「自由」は「じゅう」の誤認識として頻出）
  if (/^(十|じゅう|自由|10)$/.test(t)) return 10;
  // 9
  if (/^(九|きゅう|9)$/.test(t)) return 9;
  // 8
  if (/^(八|はち|8)$/.test(t)) return 8;
  // 7
  if (/^(七|なな|しち|7)$/.test(t)) return 7;
  // 6
  if (/^(六|ろく|6)$/.test(t)) return 6;
  // 5
  if (/^(五|ご|5)$/.test(t)) return 5;
  // 4
  if (/^(四|よん|し|4)$/.test(t)) return 4;
  // 3
  if (/^(三|さん|3)$/.test(t)) return 3;
  // 2
  if (/^(二|に|2)$/.test(t)) return 2;
  // 1
  if (/^(一|いち|1)$/.test(t)) return 1;

  return null;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
type Judgment = "Near" | "Mid" | "Long";

type ThrowEntry = {
  number: DartsNumber | null;
  judgment: Judgment | null;
};

const makeEmptyThrows = (): [ThrowEntry, ThrowEntry, ThrowEntry] => [
  { number: null, judgment: null },
  { number: null, judgment: null },
  { number: null, judgment: null },
];

// ─────────────────────────────────────────────────────────────
// Permission
// ─────────────────────────────────────────────────────────────
async function requestMicPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: "マイクの使用許可",
      message: "音声認識のためにマイクへのアクセスが必要です。",
      buttonPositive: "許可する",
    },
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

// ─────────────────────────────────────────────────────────────
// NumberLabel
// ─────────────────────────────────────────────────────────────
function displayNumber(n: DartsNumber | null): string {
  if (n === null) return "---";
  if (n === "BULL") return "BULL";
  return String(n);
}

// ─────────────────────────────────────────────────────────────
// NumberPickerModal  （1-20 + BULL のグリッド）
// ─────────────────────────────────────────────────────────────
function NumberPickerModal({
  visible,
  onSelect,
  onClose,
}: {
  visible: boolean;
  onSelect: (n: DartsNumber) => void;
  onClose: () => void;
}) {
  const nums: DartsNumber[] = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    "BULL",
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={modalStyles.overlay} onPress={onClose}>
        <Pressable style={modalStyles.panel} onPress={() => {}}>
          <Text style={modalStyles.title}>数字を選択</Text>
          <View style={modalStyles.grid}>
            {nums.map((n) => (
              <Pressable
                key={String(n)}
                style={({ pressed }) => [modalStyles.cell, pressed && modalStyles.cellPressed]}
                onPress={() => { onSelect(n); onClose(); }}
              >
                <Text style={modalStyles.cellText}>{displayNumber(n)}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={modalStyles.cancelBtn} onPress={onClose}>
            <Text style={modalStyles.cancelText}>キャンセル</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  panel: {
    width: 300,
    backgroundColor: "#0E1C2E",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 15, fontWeight: "700", color: colors.text, textAlign: "center", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  cell: {
    width: 52,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  cellPressed: { opacity: 0.6, backgroundColor: colors.accent },
  cellText: { fontSize: 15, fontWeight: "700", color: colors.text },
  cancelBtn: { marginTop: 16, alignItems: "center" },
  cancelText: { fontSize: 14, color: colors.textSecondary },
});

// ─────────────────────────────────────────────────────────────
// ThrowSlot
// ─────────────────────────────────────────────────────────────
function ThrowSlot({
  index,
  entry,
  isActive,
  onTapNumber,
  onJudgment,
}: {
  index: number;
  entry: ThrowEntry;
  isActive: boolean;
  onTapNumber: () => void;
  onJudgment: (j: Judgment) => void;
}) {
  const hasNumber = entry.number !== null;
  const judgments: Judgment[] = ["Near", "Mid", "Long"];

  return (
    <View style={[slotStyles.row, isActive && slotStyles.rowActive]}>
      {/* 投番号 */}
      <Text style={slotStyles.label}>{index + 1}投目</Text>

      {/* 数字（タップで修正） */}
      <Pressable
        onPress={hasNumber ? onTapNumber : undefined}
        style={[slotStyles.numberBox, hasNumber && slotStyles.numberBoxFilled]}
      >
        <Text style={[slotStyles.numberText, !hasNumber && slotStyles.numberTextEmpty]}>
          {displayNumber(entry.number)}
        </Text>
      </Pressable>

      {/* 判定ボタン */}
      <View style={slotStyles.judgmentRow}>
        {judgments.map((j) => (
          <Pressable
            key={j}
            onPress={() => hasNumber && onJudgment(j)}
            style={[
              slotStyles.jBtn,
              entry.judgment === j && slotStyles.jBtnActive,
              !hasNumber && slotStyles.jBtnDisabled,
            ]}
          >
            <Text style={[
              slotStyles.jBtnText,
              entry.judgment === j && slotStyles.jBtnTextActive,
            ]}>
              {j}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const slotStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowActive: {
    borderColor: colors.accent,
    backgroundColor: "#0A1E32",
  },
  label: { width: 38, fontSize: 12, color: colors.textSecondary, fontWeight: "700" },
  numberBox: {
    width: 64,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0B1525",
  },
  numberBoxFilled: {
    borderColor: "#49A37E",
    backgroundColor: "#0E2318",
  },
  numberText: { fontSize: 22, fontWeight: "800", color: "#7FD4AA" },
  numberTextEmpty: { fontSize: 16, color: colors.textSecondary, fontWeight: "400" },
  judgmentRow: { flex: 1, flexDirection: "row", gap: 6 },
  jBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  jBtnActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  jBtnDisabled: { opacity: 0.35 },
  jBtnText: { fontSize: 12, fontWeight: "700", color: colors.textSecondary },
  jBtnTextActive: { color: "#fff" },
});

// ─────────────────────────────────────────────────────────────
// QuickRecordScreen
// ─────────────────────────────────────────────────────────────
export function QuickRecordScreen() {
  const [throws, setThrows] = useState<[ThrowEntry, ThrowEntry, ThrowEntry]>(makeEmptyThrows());
  const [isListening, setIsListening] = useState(false);
  const [lastRaw, setLastRaw] = useState<string>("");
  const [editingSlot, setEditingSlot] = useState<0 | 1 | 2 | null>(null);
  const [savedRounds, setSavedRounds] = useState<[ThrowEntry, ThrowEntry, ThrowEntry][]>([]);
  const isListeningRef = useRef(false);

  // 次に数字を入れるスロットのインデックス
  const nextSlot = throws.findIndex((t) => t.number === null) as 0 | 1 | 2 | -1;
  const isComplete = throws.every((t) => t.number !== null && t.judgment !== null);

  // ─── Voice セットアップ（マウント時1回のみ）───
  useEffect(() => {
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const raw = e.value?.[0] ?? "";
      console.log("[Voice] raw:", raw);
      setLastRaw(raw);

      const mapped = dartsNumericMapper(raw);
      console.log("[Voice] mapped:", mapped);

      if (mapped !== null) {
        setThrows((prev) => {
          const next = prev.findIndex((t) => t.number === null);
          if (next === -1) return prev; // 3投分埋まっていたら無視
          const updated = prev.map((t, i) =>
            i === next ? { ...t, number: mapped } : t,
          ) as [ThrowEntry, ThrowEntry, ThrowEntry];
          return updated;
        });
      }

      // 結果取得後すぐ再スタート（連続認識）
      if (isListeningRef.current) {
        Voice.start("ja-JP").catch(() => {
          setIsListening(false);
          isListeningRef.current = false;
        });
      }
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      const code = e.error?.code;
      console.log("[Voice] error code:", code, e.error?.message);
      // 無音タイムアウト(5) / No match(7) → 再スタート
      if (code === "5" || code === 5 || code === "7" || code === 7) {
        if (isListeningRef.current) {
          Voice.start("ja-JP").catch(() => {
            setIsListening(false);
            isListeningRef.current = false;
          });
        }
      } else {
        setIsListening(false);
        isListeningRef.current = false;
      }
    };

    return () => { Voice.destroy().then(Voice.removeAllListeners); };
  }, []);

  const startListening = async () => {
    const ok = await requestMicPermission();
    if (!ok) return;
    try {
      await Voice.start("ja-JP");
      isListeningRef.current = true;
      setIsListening(true);
    } catch (e) {
      console.log("[Voice] start error:", e);
    }
  };

  const stopListening = async () => {
    isListeningRef.current = false;
    setIsListening(false);
    try { await Voice.stop(); } catch { /* ignore */ }
  };

  const handleToggle = () => isListening ? stopListening() : startListening();

  const handleJudgment = (slotIndex: number, j: Judgment) => {
    setThrows((prev) =>
      prev.map((t, i) =>
        i === slotIndex ? { ...t, judgment: j } : t,
      ) as [ThrowEntry, ThrowEntry, ThrowEntry],
    );
  };

  const handleEditNumber = (n: DartsNumber) => {
    if (editingSlot === null) return;
    setThrows((prev) =>
      prev.map((t, i) =>
        i === editingSlot ? { ...t, number: n } : t,
      ) as [ThrowEntry, ThrowEntry, ThrowEntry],
    );
  };

  const handleSave = () => {
    console.log("[Save] round:", JSON.stringify(throws));
    setSavedRounds((prev) => [throws, ...prev].slice(0, 10));
    setThrows(makeEmptyThrows());
  };

  const handleClear = () => setThrows(makeEmptyThrows());

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>

        {/* ヘッダー */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>クイック記録</Text>
            <Text style={styles.subtitle}>声で数字 → 判定をタップ</Text>
          </View>
          <Pressable
            onPress={handleToggle}
            style={[styles.micBtn, isListening && styles.micBtnActive]}
          >
            <Text style={styles.micIcon}>{isListening ? "⏹" : "🎤"}</Text>
            <Text style={styles.micLabel}>{isListening ? "停止" : "録音"}</Text>
          </Pressable>
        </View>

        {/* 認識中インジケーター */}
        {isListening && (
          <Text style={styles.listeningHint}>
            聞いています… 数字を声で言ってください
          </Text>
        )}

        {/* 最後の認識テキスト（デバッグ兼ユーザー確認） */}
        {lastRaw !== "" && (
          <Text style={styles.rawText}>認識: 「{lastRaw}」</Text>
        )}

        {/* 3投スロット */}
        <View style={styles.slots}>
          {throws.map((entry, i) => (
            <ThrowSlot
              key={i}
              index={i}
              entry={entry}
              isActive={nextSlot === i}
              onTapNumber={() => setEditingSlot(i as 0 | 1 | 2)}
              onJudgment={(j) => handleJudgment(i, j)}
            />
          ))}
        </View>

        {/* アクション行 */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleClear}
            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.clearBtnText}>やり直し</Text>
          </Pressable>
          <Pressable
            onPress={isComplete ? handleSave : undefined}
            style={[styles.saveBtn, !isComplete && styles.saveBtnDisabled]}
          >
            <Text style={[styles.saveBtnText, !isComplete && styles.saveBtnTextDisabled]}>
              保存して次のラウンドへ
            </Text>
          </Pressable>
        </View>

        {/* 保存済みラウンド（デバッグ表示） */}
        {savedRounds.length > 0 && (
          <View style={styles.savedArea}>
            <Text style={styles.savedTitle}>保存済み（最新{savedRounds.length}ラウンド）</Text>
            {savedRounds.map((round, ri) => (
              <Text key={ri} style={styles.savedRow}>
                {round.map((t) => `${displayNumber(t.number)}/${t.judgment ?? "?"}`).join("  ")}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* 数字修正モーダル */}
      <NumberPickerModal
        visible={editingSlot !== null}
        onSelect={handleEditNumber}
        onClose={() => setEditingSlot(null)}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  micBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  micBtnActive: { backgroundColor: "#1A2E1A", borderColor: "#49A37E" },
  micIcon: { fontSize: 18 },
  micLabel: { fontSize: 14, fontWeight: "700", color: colors.text },

  listeningHint: { fontSize: 12, color: "#49A37E", textAlign: "center", marginBottom: 6 },
  rawText: { fontSize: 11, color: colors.textSecondary, textAlign: "center", marginBottom: 8 },

  slots: { gap: 10, marginBottom: 16 },

  actionRow: { flexDirection: "row", gap: 10 },
  clearBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  clearBtnText: { fontSize: 14, fontWeight: "700", color: colors.textSecondary },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnDisabled: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  saveBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  saveBtnTextDisabled: { color: colors.textSecondary },

  savedArea: { marginTop: 20, gap: 4 },
  savedTitle: { fontSize: 11, color: colors.textSecondary, fontWeight: "700", marginBottom: 4 },
  savedRow: { fontSize: 13, color: colors.text },
});
