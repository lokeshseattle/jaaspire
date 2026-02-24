import { AppTheme, appThemes } from "@/src/theme";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

const theme: AppTheme = appThemes.light;

interface DateInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
}

function DateInput<T extends FieldValues>({
  control,
  name,
  label,
}: DateInputProps<T>) {
  const [show, setShow] = useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, value } }) => (
        <View style={{ gap: 6 }}>
          <Text style={styles.label}>{label}</Text>

          <Pressable
            onPress={() => setShow(true)}
            style={styles.inputContainer}
          >
            <Text
              style={{
                color: value
                  ? theme.colors.textPrimary
                  : theme.colors.textSecondary,
              }}
            >
              {value ? new Date(value).toLocaleDateString() : "Select date"}
            </Text>
          </Pressable>

          {show && (
            <DateTimePicker
              value={value ? new Date(value) : new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              maximumDate={new Date()}
              onChange={(event, selectedDate) => {
                setShow(false);
                if (selectedDate) {
                  onChange(selectedDate);
                }
              }}
            />
          )}
        </View>
      )}
    />
  );
}

export default DateInput;

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  inputContainer: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: "center",
  },
});
