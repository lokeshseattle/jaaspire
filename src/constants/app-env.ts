/**
 * Public web origin + API base — single place for environment-specific URLs.
 *
 * Set EXPO_PUBLIC_WEB_ORIGIN and optionally EXPO_PUBLIC_API_BASE_URL (see root
 * .env.example). Defaults match current staging (stgx) until you switch prod.
 *
 * Native Universal Links / App Links hosts are derived from the same origin in
 * app.config.ts — run a new prebuild after changing EXPO_PUBLIC_WEB_ORIGIN.
 */

/** Default staging origin — must match resolveWebOriginForConfig() in app.config.ts */
const DEFAULT_WEB_ORIGIN = "https://stgx.jaaspire.com";

function trimTrailingSlashes(s: string): string {
  return s.replace(/\/+$/, "");
}

function readWebOrigin(): string {
  const raw =
    typeof process !== "undefined"
      ? process.env.EXPO_PUBLIC_WEB_ORIGIN?.trim()
      : undefined;
  return trimTrailingSlashes(raw || DEFAULT_WEB_ORIGIN);
}

export const WEB_ORIGIN = readWebOrigin();

export const WEB_HOSTNAME: string = (() => {
  try {
    return new URL(WEB_ORIGIN).hostname;
  } catch {
    return "stgx.jaaspire.com";
  }
})();

/** API base including /api/v1 — override with EXPO_PUBLIC_API_BASE_URL if needed */
export const API_BASE_URL: string = (() => {
  const explicit =
    typeof process !== "undefined"
      ? process.env.EXPO_PUBLIC_API_BASE_URL?.trim()
      : undefined;
  if (explicit) return trimTrailingSlashes(explicit);
  return `${WEB_ORIGIN}/api/v1`;
})();
