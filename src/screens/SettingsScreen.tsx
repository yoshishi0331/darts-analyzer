import { Alert, Pressable, StyleSheet, Text } from "react-native";

import { Card } from "@/components/Card";
import { LabeledSwitchRow } from "@/components/LabeledSwitchRow";
import { Screen } from "@/components/Screen";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useAppState } from "@/state/AppProvider";
import { colors } from "@/theme/colors";

export function SettingsScreen() {
  const {
    settings,
    setHandedness,
    setFutureFaceMaskEnabled,
    clearAllData,
  } = useAppState();

  const handleDeleteAll = () => {
    Alert.alert(
      "データをすべて削除しますか？",
      "記録・スコアがすべて削除されます。この操作は元に戻せません。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: () => {
            clearAllData();
            Alert.alert("削除しました");
          },
        },
      ],
    );
  };

  return (
    <Screen title="設定" subtitle="研究条件と保存ポリシーをここで管理">
      <Card>
        <Text style={styles.sectionTitle}>利き手</Text>
        <SegmentedControl
          options={[
            { label: "右", value: "right" },
            { label: "左", value: "left" },
          ]}
          selected={settings.handedness}
          onChange={setHandedness}
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>将来の顔隠し機能</Text>
        <LabeledSwitchRow
          label="顔隠しを有効化"
          description="MVPではダミー設定だけを保持しています。"
          value={settings.futureFaceMaskEnabled}
          onValueChange={setFutureFaceMaskEnabled}
        />
      </Card>

      <Pressable
        onPress={handleDeleteAll}
        style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
      >
        <Text style={styles.deleteBtnText}>データをすべて削除</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  deleteBtn: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(229, 115, 115, 0.45)",
    marginTop: 8,
  },
  deleteBtnPressed: { opacity: 0.6 },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#E57373",
  },
});
