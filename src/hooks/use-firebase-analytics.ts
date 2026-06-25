import { usePathname, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { logScreenView } from "../features/attribution/attribution.analytics";

function resolveScreenName(pathname: string, segments: string[]): string {
  // Tab home
  if (pathname === "/" || pathname === "/index") return "home";
  // Auth
  if (segments.includes("(auth)")) {
    if (pathname.includes("login")) return "auth_login";
    if (pathname.includes("register")) return "auth_register";
    if (pathname.includes("verify-2fa")) return "auth_verify_2fa";
    if (pathname.includes("forgot-password")) return "auth_forgot_password";
  }
  // Dynamic routes → template names
  if (/^\/user\/[^/]+$/.test(pathname)) return "user_profile";
  if (/^\/user\/[^/]+\/posts\//.test(pathname)) return "user_post_detail";
  if (/^\/chat\//.test(pathname)) return "chat";
  if (/^\/post\//.test(pathname)) return "post_detail";
  if (/^\/flick\//.test(pathname)) return "flick_detail";
  if (/^\/story\//.test(pathname)) return "story_viewer";

  console.log("pathname", pathname);
  console.log("segments", segments);
  // Static screens: strip leading slash, replace / with _
  return pathname.replace(/^\//, "").replace(/\//g, "_") || "unknown";
}

export function useAnalyticsScreenTracking(): void {
  const pathname = usePathname();
  const segments = useSegments();
  const lastScreenRef = useRef<string | null>(null);
  useEffect(() => {
    const screenName = resolveScreenName(pathname, segments);
    if (screenName === lastScreenRef.current) return;
    lastScreenRef.current = screenName;
    void logScreenView(screenName);
  }, [pathname, segments]);
}
