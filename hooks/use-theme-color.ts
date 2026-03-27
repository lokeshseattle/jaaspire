/**
 * Resolves colors using the same light/dark source as `ThemeProvider`
 * (manual theme in Settings + system when mode is "system").
 * Do not use raw `useColorScheme()` here — it breaks when the user forces dark
 * while the device stays in light appearance.
 */

import { Colors } from "@/src/constants/theme";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useColorScheme } from "react-native";

function colorFromTheme(
  theme: AppTheme,
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
): string {
  switch (colorName) {
    case "text":
      return theme.colors.textPrimary;
    case "background":
      return theme.colors.background;
    case "tint":
      return theme.colors.tint;
    case "icon":
      return theme.colors.icon;
    case "tabIconDefault":
      return theme.colors.tabIconDefault;
    case "tabIconSelected":
      return theme.colors.tabIconSelected;
    default:
      return theme.colors.textPrimary;
  }
}

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
) {
  const { theme, mode } = useTheme();
  const systemScheme = useColorScheme() ?? "light";
  const resolved: "light" | "dark" =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const colorFromProps = props[resolved];
  if (colorFromProps) {
    return colorFromProps;
  }

  return colorFromTheme(theme, colorName);
}
