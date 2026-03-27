import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { colors } from "@/theme/colors";

const HIDE_KEY = "darts-analyzer/hide-shooting-tips";

export function ShootingTipsModal() {
  const [visible, setVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_KEY).then((val) => {
      if (val !== "true") setVisible(true);
    });
  }, []);

  const handleOk = async () => {
    if (dontShowAgain) {
      await AsyncStorage.setItem(HIDE_KEY, "true");
    }
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>📹 撮影のコツ</Text>

          <Text style={styles.body}>全身が真横から映るように撮影してください</Text>

          <Text style={styles.note}>
            ※上半身・腕だけでも使えますが、全身の方がより正確に分析できます
          </Text>

          <Pressable
            onPress={() => setDontShowAgain((v) => !v)}
            style={styles.checkRow}
          >
            <View style={[styles.checkbox, dontShowAgain && styles.checkboxChecked]}>
              {dontShowAgain && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>次回から表示しない</Text>
          </Pressable>

          <Pressable onPress={handleOk} style={styles.okBtn}>
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    color: colors.text,
    textAlign: "center",
    lineHeight: 22,
  },
  note: {
    fontSize: 12,
    color: colors.textSecondary,
    opacity: 0.6,
    textAlign: "center",
    lineHeight: 18,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "center",
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  checkLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  okBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  okText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});
