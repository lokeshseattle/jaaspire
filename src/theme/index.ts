import { Platform } from "react-native";

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

const typography = {
  fontFamily: Platform.select({
    ios: {
      sans: "system-ui",
      serif: "ui-serif",
      rounded: "ui-rounded",
      mono: "ui-monospace",
    },
    default: {
      sans: "normal",
      serif: "serif",
      rounded: "normal",
      mono: "monospace",
    },
  }),
} as const;

const lightTheme = {
  colors: {
    background: "#FFFFFF",
    surface: "#F9FAFB",
    card: "#FFFFFF",
    textPrimary: "#11181C",
    textSecondary: "#687076",
    border: "#E5E7EB",
    tint: "#0a7ea4",
    primary: "#2563eb",
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: "#0a7ea4",
  },
  spacing,
  radius,
  typography,
} as const;

const darkTheme = {
  colors: {
    background: "#0F172A",
    surface: "#111827",
    card: "#1E293B",
    textPrimary: "#F1F5F9",
    textSecondary: "#94A3B8",
    border: "#1F2937",
    tint: "#38BDF8",
    primary: "#3B82F6",
    icon: "#94A3B8",
    tabIconDefault: "#64748B",
    tabIconSelected: "#38BDF8",
  },
  spacing,
  radius,
  typography,
} as const;

export const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

export type AppTheme = typeof lightTheme;
export type ThemeMode = keyof typeof appThemes;
