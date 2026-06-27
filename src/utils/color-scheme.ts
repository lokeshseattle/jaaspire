import type { ColorSchemeName } from "react-native";

/** Maps RN color scheme (incl. `unspecified`) to a concrete light/dark value. */
export function resolveColorScheme(
  scheme: ColorSchemeName | null | undefined,
): "light" | "dark" {
  return scheme === "dark" ? "dark" : "light";
}
