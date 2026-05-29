import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import BottomSheet from "./bottom-sheet";

interface Option {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onClose: () => void;
}

export default function SelectPickerSheet({
  visible,
  value,
  options,
  onChange,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const fallbackValue = useMemo(() => options[0]?.value ?? "", [options]);
  const [draftValue, setDraftValue] = useState(value || fallbackValue);

  useEffect(() => {
    if (!visible) return;
    setDraftValue(value || fallbackValue);
  }, [visible, value, fallbackValue]);

  const handleDone = () => {
    if (!draftValue) {
      onClose();
      return;
    }
    onChange(draftValue);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.pickerWrapper}>
        <View style={styles.headerRow}>
          <View />
          <Pressable
            onPress={handleDone}
            disabled={!draftValue}
            style={({ pressed }) => [
              styles.doneButton,
              pressed && styles.doneButtonPressed,
              !draftValue && styles.doneButtonDisabled,
            ]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
        <Picker
          selectedValue={draftValue}
          onValueChange={(nextValue) => setDraftValue(nextValue)}
          style={styles.picker}
          itemStyle={Platform.OS === "ios" ? styles.pickerItem : undefined}
          dropdownIconColor={theme.colors.icon}
        >
          {options.map((opt) => (
            <Picker.Item
              key={opt.value}
              label={opt.label}
              value={opt.value}
              color={theme.colors.textPrimary}
            />
          ))}
        </Picker>
      </View>
    </BottomSheet>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    pickerWrapper: {
      backgroundColor: theme.colors.card,
    },
    headerRow: {
      height: 44,
      paddingHorizontal: theme.spacing.md,
      alignItems: "center",
      justifyContent: "space-between",
      flexDirection: "row",
    },
    doneButton: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.sm,
    },
    doneButtonPressed: {
      opacity: 0.7,
    },
    doneButtonDisabled: {
      opacity: 0.4,
    },
    doneButtonText: {
      color: theme.colors.primary,
      fontSize: 17,
      fontWeight: "600",
    },
    picker: {
      backgroundColor: theme.colors.card,
      color: theme.colors.textPrimary,
    },
    pickerItem: {
      fontSize: 18,
      color: theme.colors.textPrimary,
    },
  });
