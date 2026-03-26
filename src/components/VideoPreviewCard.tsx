import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/Card";
import { colors } from "@/theme/colors";

export function VideoPreviewCard({ videoUri }: { videoUri?: string }) {
  return (
    <Card>
      <View style={styles.preview}>
        <Text style={styles.badge}>1動画 = 3投</Text>
        <Text style={styles.title}>動画プレビュー領域</Text>
        <Text style={styles.caption}>
          {videoUri ? `選択中: ${videoUri}` : "まだ動画は選択されていません"}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  preview: {
    minHeight: 180,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#07101A",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  badge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  caption: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 20,
    textAlign: "center",
  },
});
