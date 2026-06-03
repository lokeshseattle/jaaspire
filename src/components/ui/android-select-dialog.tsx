import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import React from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface Option {
  label: string;
  value: string;
}

interface AndroidSelectDialogProps {
  visible: boolean;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onClose: () => void;
  title?: string;
}

export default function AndroidSelectDialog({
  visible,
  value,
  options,
  onChange,
  onClose,
  title,
}: AndroidSelectDialogProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.dialog}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            style={styles.list}
            renderItem={({ item }) => {
              const selected = item.value === value;
              return (
                <Pressable
                  style={[styles.option, selected && styles.optionSelected]}
                  onPress={() => {
                    onChange(item.value);
                    onClose();
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.5)",
    },
    dialog: {
      width: "100%",
      maxHeight: "70%",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      overflow: "hidden",
    },
    title: {
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    list: {
      flexGrow: 0,
    },
    option: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    optionSelected: {
      backgroundColor: theme.colors.primary + "18",
    },
    optionText: {
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
    optionTextSelected: {
      color: theme.colors.primary,
      fontWeight: "600",
    },
  });
