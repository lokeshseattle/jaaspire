import { ColorValue, Platform } from "react-native";

type ThemeShape = {
  colors: {
    background: string;
    surface: string;
    card: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    tint: string;
    primary: string;
    icon: string;
    tabIconDefault: string;
    tabIconSelected: string;
    gradient: readonly [ColorValue, ColorValue, ...ColorValue[]];
  };
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
};

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

const lightTheme: ThemeShape = {
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
    gradient: ["#5a42b7", "#2761df", "#00f1ed"]
  },
  spacing,
  radius,
  typography,
} as const;

const darkTheme: ThemeShape = {
  colors: {
    background: "#0B0F14",   // app background
    surface: "#121821",      // screens / containers
    card: "#1A2230",         // cards / elevated surfaces

    textPrimary: "#F8FAFC",  // main readable text
    textSecondary: "#94A3B8",// subtitles / metadata

    border: "#222B3A",       // subtle separators

    tint: "#60A5FA",         // interactive elements
    primary: "#3B82F6",      // main brand color

    icon: "#9CA3AF",

    tabIconDefault: "#6B7280",
    tabIconSelected: "#60A5FA",

    gradient: ["#7C3AED", "#2563EB", "#06B6D4"],
  },
  spacing,
  radius,
  typography,
} as const;

export const appThemes = {
  light: lightTheme,
  dark: darkTheme,
};

export type AppTheme = ThemeShape;
export type ThemeMode = "light" | "dark" | "system";
