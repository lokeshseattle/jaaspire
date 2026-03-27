import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from "react-native";

const ERROR_COLOR = "#DC2626";

export type OtpInputProps = {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Accessibility label for the hidden input (e.g. "Verification code") */
  accessibilityLabel?: string;
};

/**
 * Six (or `length`) digit OTP: invisible native input for keyboard, paste, and SMS autofill;
 * visible cells show one character each with focus/active styling.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  error = false,
  disabled = false,
  autoFocus = true,
  accessibilityLabel = "One-time code",
}: OtpInputProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const inputRef = useRef<TextInputType>(null);
  const [focused, setFocused] = useState(false);

  const digits = useMemo(
    () => value.replace(/\D/g, "").slice(0, length),
    [value, length],
  );

  const handleChange = useCallback(
    (text: string) => {
      const next = text.replace(/\D/g, "").slice(0, length);
      onChange(next);
    },
    [length, onChange],
  );

  const activeIndex = focused ? Math.min(digits.length, length - 1) : -1;

  const focusInput = useCallback(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={focusInput}
        disabled={disabled}
        accessibilityRole="none"
        style={({ pressed }) => [
          styles.row,
          disabled && styles.rowDisabled,
          pressed && !disabled && styles.rowPressed,
        ]}
      >
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[
              styles.cell,
              error && styles.cellError,
              !error && focused && activeIndex === i && styles.cellActive,
            ]}
            pointerEvents="none"
          >
            <Text style={styles.digit} maxFontSizeMultiplier={1.4}>
              {digits[i] ?? ""}
            </Text>
          </View>
        ))}

        <TextInput
          ref={inputRef}
          value={digits}
          onChangeText={handleChange}
          maxLength={length}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === "android" ? "sms-otp" : undefined}
          importantForAutofill={Platform.OS === "android" ? "yes" : undefined}
          caretHidden
          editable={!disabled}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={accessibilityLabel}
          style={styles.hiddenInput}
          underlineColorAndroid="transparent"
        />
      </Pressable>
    </View>
  );
}

function createStyles(theme: AppTheme) {
  const gap = theme.spacing.sm;
  return StyleSheet.create({
    wrapper: {
      width: "100%",
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap,
      position: "relative",
    },
    rowDisabled: {
      opacity: 0.55,
    },
    rowPressed: {
      opacity: 0.92,
    },
    cell: {
      flex: 1,
      minWidth: 40,
      maxWidth: 56,
      height: 56,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    cellActive: {
      borderColor: theme.colors.primary,
      borderWidth: 2,
    },
    cellError: {
      borderColor: ERROR_COLOR,
    },
    digit: {
      fontSize: 22,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    hiddenInput: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.015,
      color: theme.colors.textPrimary,
    },
  });
}
