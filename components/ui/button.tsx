import { Colors } from "@/constants/theme";
import React from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  PressableProps,
  StyleProp,
  ViewStyle,
} from "react-native";

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "outline";
  style?: StyleProp<ViewStyle>; // ✅ explicitly typed
}


const Button: React.FC<ButtonProps> = ({
  title,
  loading = false,
  disabled = false,
  variant = "primary",
  style,
  ...props
}) => {
  const isDisabled = disabled || loading;

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
            color={variant === "primary" ? "#fff" : "#007AFF"}
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

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: Colors.primaryColor,
  },
  outline: {
    borderWidth: 1,
    borderColor: "#007AFF",
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
    marginRight: 8,
  },
  text: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  outlineText: {
    color: "#007AFF",
  },
});
