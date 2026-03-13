import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import React, { useState } from "react";
import {
  Control,
  Controller,
  FieldValues,
  Path,
  RegisterOptions,
} from "react-hook-form";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import DatePickerSheet from "./datepicker-sheet";
import SelectPickerSheet from "./selectpicker-sheet";

const ERROR_COLOR = "#DC2626";

// Option interface for select picker
interface Option {
  label: string;
  value: string;
}

// Base props shared by all variants
interface BaseFormInputProps<T extends FieldValues> {
  control: Control<T>;
  name: Path<T>;
  label: string;
  rules?: RegisterOptions<T, Path<T>>;
  Left?: React.ReactNode;
}

// Props for normal text input (no pickerType)
interface TextFormInputProps<T extends FieldValues>
  extends BaseFormInputProps<T>,
  Omit<TextInputProps, "style"> {
  pickerType?: undefined;
  options?: never;
  style?: TextInputProps["style"];
  placeholder?: string;
}

// Props for date picker
interface DateFormInputProps<T extends FieldValues>
  extends BaseFormInputProps<T> {
  pickerType: "date";
  options?: never;
  placeholder?: string;
}

// Props for select picker
interface SelectFormInputProps<T extends FieldValues>
  extends BaseFormInputProps<T> {
  pickerType: "select";
  options: Option[];
  placeholder?: string;
}

// Union type for all variants
type FormInputProps<T extends FieldValues> =
  | TextFormInputProps<T>
  | DateFormInputProps<T>
  | SelectFormInputProps<T>;

function FormInput<T extends FieldValues>(props: FormInputProps<T>) {
  const { control, name, label, rules, Left, pickerType, placeholder } = props;

  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Type guard to check if it's a text input
  const isTextInput = !pickerType;
  const isMultiline = isTextInput && (props as TextFormInputProps<T>).multiline;

  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      render={({
        field: { onChange, onBlur, value },
        fieldState: { error },
      }) => {
        const hasError = !!error;

        // Render content based on pickerType
        const renderInput = () => {
          // DATE PICKER
          if (pickerType === "date") {
            return (
              <>
                <Pressable
                  onPress={() => setIsPickerOpen(true)}
                  style={[
                    styles.inputContainer,
                    styles.pickerTrigger,
                    hasError && styles.errorBorder,
                  ]}
                >
                  {Left && <View style={styles.iconWrapper}>{Left}</View>}
                  <Text
                    style={[
                      styles.pickerText,
                      !value && styles.placeholderText,
                    ]}
                  >
                    {value
                      ? new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                      })
                      : placeholder || "Select date"}
                  </Text>
                </Pressable>

                <DatePickerSheet
                  visible={isPickerOpen}
                  value={value}
                  onChange={(date) => {
                    console.log(
                      "DatePickerSheet onChange fired:",
                      date.toISOString()
                    );
                    onChange(date);
                  }}
                  onClose={() => setIsPickerOpen(false)}
                />
              </>
            );
          }

          // SELECT PICKER
          if (pickerType === "select") {
            const selectProps = props as SelectFormInputProps<T>;
            const selectedOption = selectProps.options.find(
              (opt) => opt.value === value
            );

            return (
              <>
                <Pressable
                  onPress={() => setIsPickerOpen(true)}
                  style={[
                    styles.inputContainer,
                    styles.pickerTrigger,
                    hasError && styles.errorBorder,
                  ]}
                >
                  {Left && <View style={styles.iconWrapper}>{Left}</View>}
                  <Text
                    style={[
                      styles.pickerText,
                      !value && styles.placeholderText,
                    ]}
                  >
                    {selectedOption?.label || placeholder || "Select option"}
                  </Text>
                </Pressable>

                <SelectPickerSheet
                  visible={isPickerOpen}
                  value={value}
                  options={selectProps.options}
                  onChange={(selected) => {
                    onChange(selected);
                    setIsPickerOpen(false);
                  }}
                  onClose={() => setIsPickerOpen(false)}
                />
              </>
            );
          }

          // DEFAULT TEXT INPUT
          const textProps = props as TextFormInputProps<T>;
          const { style, ...inputProps } = textProps;

          return (
            <View
              style={[
                styles.inputContainer,
                isMultiline && styles.multilineContainer,
                hasError && styles.errorBorder,
              ]}
            >
              {Left && <View style={styles.iconWrapper}>{Left}</View>}
              <TextInput
                style={[
                  styles.input,
                  isMultiline && styles.multilineInput,
                  style,
                ]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.textSecondary}
                {...inputProps}
              />
            </View>
          );
        };

        return (
          <View style={styles.container}>
            <Text style={styles.label}>{label}</Text>
            {renderInput()}
            {error?.message && (
              <Text style={styles.errorText}>{error.message}</Text>
            )}
          </View>
        );
      }}
    />
  );
}

export default FormInput;

export const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      marginBottom: 0,
    },

    label: {
      marginBottom: theme.spacing.sm,
      fontWeight: "600",
      fontSize: 14,
      color: theme.colors.textPrimary,
    },

    inputContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.spacing.md,
      minHeight: 40,
      backgroundColor: theme.colors.card,
    },

    multilineContainer: {
      minHeight: 100,
      alignItems: "flex-start",
      paddingVertical: theme.spacing.sm,
    },

    pickerTrigger: {
      justifyContent: "flex-start",
    },

    pickerText: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily?.sans,
    },

    placeholderText: {
      color: theme.colors.textSecondary,
    },

    errorBorder: {
      borderColor: ERROR_COLOR,
    },

    input: {
      flex: 1,
      fontSize: 16,
      color: theme.colors.textPrimary,
      fontFamily: theme.typography.fontFamily?.sans,
    },

    multilineInput: {
      minHeight: 80,
      textAlignVertical: "top",
      paddingTop: 0,
    },

    errorText: {
      color: ERROR_COLOR,
      fontSize: 12,
      marginTop: theme.spacing.xs,
    },

    iconWrapper: {
      marginRight: theme.spacing.sm,
    },
  });