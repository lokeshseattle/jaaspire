import { AppTheme, appThemes } from "@/src/theme";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";

const theme: AppTheme = appThemes.light;

interface Option {
  label: string;
  value: string;
}

interface SelectInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  options: Option[];
}

function SelectInput<T extends FieldValues>({
  control,
  name,
  label,
  options,
}: SelectInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>{label}</Text>

          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={value}
              onValueChange={onChange}
              dropdownIconColor={theme.colors.textSecondary}
            >
              <Picker.Item
                label="Select..."
                value=""
                color={theme.colors.textSecondary}
              />
              {options.map((opt) => (
                <Picker.Item
                  key={opt.value}
                  label={opt.label}
                  value={opt.value}
                />
              ))}
            </Picker>
          </View>
        </View>
      )}
    />
  );
}

export default SelectInput;

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    overflow: "hidden",
  },
});
