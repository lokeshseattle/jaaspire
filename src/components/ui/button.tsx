import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline";
  style?: StyleProp<ViewStyle>;
}

const Button: React.FC<ButtonProps> = ({
  title,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const isDisabled = disabled || loading;

  // Colors for spinner based on variant
  const spinnerColor = variant === "primary" ? "#fff" : theme.colors.primary;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => {
        const computedStyle: StyleProp<ViewStyle> = [
          styles.base,
          variant === "primary" && styles.primary,
          variant === "outline" && styles.outline,
          isDisabled && styles.disabled,
          pressed && !isDisabled && styles.pressed,
          style,
        ];

        return computedStyle;
      }}
      {...props}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={spinnerColor}
            style={styles.spinner}
          />
        )}

        <Text
          style={[
            styles.text,
            variant === "outline" && styles.outlineText,
          ]}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
};

export default Button;

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    base: {
      height: 48,
      borderRadius: theme.radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    primary: {
      backgroundColor: theme.colors.primary,
    },
    outline: {
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: "transparent",
    },
    disabled: {
      opacity: 0.6,
    },
    pressed: {
      opacity: 0.85,
    },
    content: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    spinner: {
      marginRight: theme.spacing.sm,
    },
    text: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
    },
    outlineText: {
      color: theme.colors.primary,
    },
  });