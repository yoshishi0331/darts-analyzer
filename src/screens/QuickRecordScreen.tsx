import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Voice, {
  SpeechErrorEvent,
  SpeechResultsEvent,
} from "@react-native-voice/voice";

import { Screen } from "@/components/Screen";
import { colors } from "@/theme/colors";

// 認識済みとみなすダーツ用語（部分一致）
const KNOWN_WORDS = [
  "ブル", "bull", "BULL",
  "20", "にじゅう", "二十",
  "19", "じゅうく", "十九",
  "18", "じゅうはち", "十八",
  "17", "じゅうなな", "十七",
  "16", "じゅうろく", "十六",
  "15", "じゅうご", "十五",
  "トリプル", "とりぷる", "triple",
  "シングル", "しんぐる", "single",
  "ニア", "にあ", "near",
  "ミス", "みす", "外れ",
];

type RecordEntry = {
  id: string;
  text: string;
  timestamp: string;
  isKnown: boolean;
};

function containsKnownWord(text: string): boolean {
  return KNOWN_WORDS.some((w) => text.includes(w));
}

function nowLabel(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

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

export function QuickRecordScreen() {
  const [isListening, setIsListening] = useState(false);
  const [records, setRecords] = useState<RecordEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const partialRef = useRef<string>("");

  useEffect(() => {
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const text = e.value?.[0] ?? "";
      if (!text) return;
      partialRef.current = "";
      const entry: RecordEntry = {
        id: `${Date.now()}`,
        text,
        timestamp: nowLabel(),
        isKnown: containsKnownWord(text),
      };
      setRecords((prev) => [entry, ...prev].slice(0, 20));
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      const msg = e.error?.message ?? "不明なエラー";
      // code 5 = "client side error" = 認識できずタイムアウト。正常系扱いで再起動。
      if (e.error?.code === "5" || e.error?.code === 5) {
        if (isListening) restartListening();
      } else {
        setError(msg);
        setIsListening(false);
      }
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  const startListening = async () => {
    const ok = await requestMicPermission();
    if (!ok) {
      setError("マイク権限が拒否されました");
      return;
    }
    setError(null);
    try {
      await Voice.start("ja-JP");
      setIsListening(true);
    } catch (e: unknown) {
      setError(String(e));
    }
  };

  const stopListening = async () => {
    try {
      await Voice.stop();
    } catch {
      // ignore
    }
    setIsListening(false);
  };

  const restartListening = async () => {
    try {
      await Voice.stop();
      await Voice.start("ja-JP");
    } catch {
      setIsListening(false);
    }
  };

  const handleToggle = () => {
    if (isListening) stopListening();
    else startListening();
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>クイック記録</Text>
        <Text style={styles.subtitle}>ダーツの結果を声で記録</Text>

        {/* 録音ボタン */}
        <Pressable
          onPress={handleToggle}
          style={({ pressed }) => [
            styles.micBtn,
            isListening && styles.micBtnActive,
            pressed && styles.micBtnPressed,
          ]}
        >
          <Text style={styles.micIcon}>{isListening ? "⏹" : "🎤"}</Text>
          <Text style={styles.micLabel}>
            {isListening ? "録音停止" : "録音開始"}
          </Text>
        </Pressable>

        {isListening && (
          <Text style={styles.listeningHint}>
            聞いています…「ブル」「20ニア」「トリプル」など
          </Text>
        )}

        {error && <Text style={styles.errorText}>エラー: {error}</Text>}

        {/* ヘッダー行 */}
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>認識結果（最新20件）</Text>
          {records.length > 0 && (
            <Pressable onPress={() => setRecords([])}>
              <Text style={styles.clearBtn}>クリア</Text>
            </Pressable>
          )}
        </View>

        {/* 認識結果リスト */}
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          style={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              録音を開始して発話してください
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.row, item.isKnown && styles.rowKnown]}>
              <Text style={styles.rowTime}>{item.timestamp}</Text>
              <Text
                style={[styles.rowText, item.isKnown && styles.rowTextKnown]}
              >
                {item.text}
              </Text>
              {item.isKnown && (
                <Text style={styles.rowBadge}>✓</Text>
              )}
            </View>
          )}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  title: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 2 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },

  micBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  micBtnActive: {
    backgroundColor: "#1A2E1A",
    borderColor: "#49A37E",
  },
  micBtnPressed: { opacity: 0.7 },
  micIcon: { fontSize: 22 },
  micLabel: { fontSize: 16, fontWeight: "700", color: colors.text },

  listeningHint: {
    fontSize: 12,
    color: "#49A37E",
    textAlign: "center",
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: "#D86A6C",
    marginBottom: 8,
    textAlign: "center",
  },

  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  listHeaderText: { fontSize: 12, color: colors.textSecondary, fontWeight: "700" },
  clearBtn: { fontSize: 12, color: colors.accent },

  list: { flex: 1 },
  emptyText: {
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 32,
    fontSize: 13,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowKnown: {
    backgroundColor: "#0E2318",
    borderColor: "#49A37E",
  },
  rowTime: { fontSize: 11, color: colors.textSecondary, width: 60 },
  rowText: { flex: 1, fontSize: 15, color: colors.text },
  rowTextKnown: { color: "#7FD4AA", fontWeight: "700" },
  rowBadge: { fontSize: 14, color: "#49A37E" },
});
