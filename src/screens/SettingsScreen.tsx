import { StyleSheet, Text } from "react-native";

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
  } = useAppState();

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
});
