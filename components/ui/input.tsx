import React from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from "react-native";
import {
  Control,
  Controller,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import { IconProps } from "@expo/vector-icons/build/createIconSet";

interface FormInputProps<T extends FieldValues>
  extends TextInputProps {
  control: Control<T>;
  name: Path<T>;
  label: string;
  rules?: RegisterOptions<T, Path<T>>;
  Left?: React.ReactNode;
  leftIconName?: string;
}

function FormInput<T extends FieldValues>({
  control,
  name,
  label,
  rules,
  Left,
  leftIconName,
  ...inputProps
}: FormInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => {
        const hasError = !!error;

        return (
          <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>

            <View
              style={[
                styles.inputContainer,
                hasError && styles.errorBorder,
              ]}
            >
              {Left && (
                <View style={styles.iconWrapper}>
                  {Left}
                </View>
              )}
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholderTextColor="#999"
                {...inputProps}
              />
            </View>

            {error?.message && (
              <Text style={styles.errorText}>
                {error.message}
              </Text>
            )}
          </View>
        );
      }}
    />
  );
}

export default FormInput;

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  label: {
    marginBottom: 6,
    fontWeight: "600",
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
  },
  errorBorder: {
    borderColor: "red",
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  errorText: {
    color: "red",
    fontSize: 12,
    marginTop: 4,
  },
  iconWrapper: {
    marginRight: 8,
  },
});
