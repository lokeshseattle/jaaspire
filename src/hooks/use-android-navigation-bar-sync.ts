import { useTheme } from "@/src/theme/ThemeProvider";
import * as NavigationBar from "expo-navigation-bar";
import { usePathname, useSegments } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

const BLACK = "#000000";
const DARK_THEME_BG = "#0B0F14";

/** Gesture nav on Android may ignore nav bar color APIs; three-button nav shows changes. */
export function resolveNavigationBarColor(
  pathname: string,
  segments: string[],
  background: string,
): string {
  if (pathname === "/flicks" || segments.includes("flicks")) {
    return BLACK;
  }
  if (pathname.startsWith("/flick/")) {
    return BLACK;
  }
  if (pathname.startsWith("/story/") || segments.includes("story")) {
    return BLACK;
  }
  return background;
}

function resolveNavigationBarButtonStyle(color: string): "light" | "dark" {
  const normalized = color.toLowerCase();
  if (normalized === BLACK || normalized === DARK_THEME_BG) {
    return "light";
  }
  return "dark";
}

/**
 * Syncs Android system navigation bar color/buttons to the active route and theme.
 * Call once from root layout.
 */
export function useAndroidNavigationBarSync(): void {
  const pathname = usePathname();
  const segments = useSegments();
  const { theme } = useTheme();

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const color = resolveNavigationBarColor(
      pathname,
      segments as string[],
      theme.colors.background,
    );
    const buttonStyle = resolveNavigationBarButtonStyle(color);

    void NavigationBar.setBackgroundColorAsync(color);
    void NavigationBar.setButtonStyleAsync(buttonStyle);
  }, [pathname, segments, theme.colors.background]);
}
