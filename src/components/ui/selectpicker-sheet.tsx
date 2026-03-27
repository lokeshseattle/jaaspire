import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
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

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={value}
          onValueChange={onChange}
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
    picker: {
      backgroundColor: theme.colors.card,
      color: theme.colors.textPrimary,
    },
    pickerItem: {
      fontSize: 18,
      color: theme.colors.textPrimary,
    },
  });
