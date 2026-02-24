import { AppTheme, appThemes } from "@/src/theme";
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

const theme: AppTheme = appThemes.light;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
}: BottomSheetProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View />
      </Pressable>

      <View style={styles.sheet}>{children}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
