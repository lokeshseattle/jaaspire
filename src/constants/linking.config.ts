import { WEB_HOSTNAME, WEB_ORIGIN } from "@/src/constants/app-env";

/**
 * Deep linking — public URL → in-app route mapping (runtime).
 *
 * Build-time scheme lives in app.json (expo.scheme). Universal Links hosts and
 * Android intent filters are set from EXPO_PUBLIC_WEB_ORIGIN in app.config.ts.
 * This module is the single place for **marketing / web path → Expo Router path**
 * rewrites used by app/+native-intent.tsx.
 *
 * Server-side: host apple-app-site-association and Android assetlinks.json on
 * your domain so iOS/Android open the app for https links; Expo does not
 * replace that.
 */

/* ============================================================================
 * AGENT_CONTEXT — for AI / maintainers (keep this block updated)
 *
 * When adding a new deep link, paste something like this into chat:
 *
 *   Web URL (full or path): <WEB_ORIGIN>/posts/3492  or  <WEB_ORIGIN>/@alice
 *   In-app route (href):     /post/3492  or  /user/alice
 *   (or file route:          app/(app)/user/[username].tsx)
 *
 * Then: add ONE ordered rule in PUBLIC_ROUTE_ALIASES below (first match wins).
 * Do not search the repo for routing unless you are adding a brand-new screen
 * under app/. Expo Router groups like (app) are omitted from the public URL.
 *
 * To change staging vs production URLs: set EXPO_PUBLIC_WEB_ORIGIN (see .env.example).
 * ============================================================================ */

/** Must match expo.scheme in app.json */
export const APP_SCHEME = "jaaspire" as const;

/** Same origin as app.config extra.router.origin and native Universal Links host */
export const UNIVERSAL_LINK_ORIGIN = WEB_ORIGIN;

/**
 * Prefixes used when building or documenting URLs (custom scheme + https).
 * Keep aligned with app.config.ts / native domains you ship.
 */
export const LINKING_PREFIXES: readonly string[] = [
  `${APP_SCHEME}://`,
  `${WEB_ORIGIN}/`,
  `https://www.${WEB_HOSTNAME}/`,
];

export type PublicRouteAlias = {
  /** Why this rule exists */
  description: string;
  /** Match against a pathname that starts with `/` */
  pattern: RegExp;
  /** Replacement; use $1, $2 for capture groups */
  replacement: string;
};

/**
 * Ordered rules — first match wins. Extend with new marketing paths here only.
 *
 * Examples:
 * - /@handle          → /user/:handle
 * - /posts/:postId    → /post/:postId (web uses plural; app route is /post/[postId])
 * - /p/:postId        → /post/:postId (short link)
 */
export const PUBLIC_ROUTE_ALIASES: readonly PublicRouteAlias[] = [
  {
    description:
      "Push / web messenger: /my/messenger?chat=id → /chat/id (app/(app)/chat/[senderId].tsx)",
    pattern: /^\/my\/messenger\/?$/,
    replacement: "/chat",
  },
  {
    description: "Web post URLs: /posts/id → /post/id (matches post/[postId])",
    pattern: /^\/posts\/([^/]+)\/?$/,
    replacement: "/post/$1",
  },
  {
    description: "Creator wallet links: /creator/* → /wallet",
    pattern: /^\/creator\/?.*$/,
    replacement: "/wallet",
  },
];

/**
 * Single-path URLs like https://origin/alice must not be mistaken for in-app
 * routes (e.g. /wallet). Only segments not in this set rewrite to /user/:seg.
 */
const RESERVED_SINGLE_SEGMENT_PATHS = new Set([
  "api",
  "bookmarks",
  "blocked-users",
  "chat",
  "create",
  "flicks",
  "followers-following",
  "flick",
  "global-search",
  "help-support",
  "login",
  "messages",
  "delete-account",
  "notifications",
  "p",
  "pending-requests",
  "post",
  "post-image-editor",
  "post-video-thumbnail",
  "privacy-settings",
  "profile",
  "posts",
  "search",
  "settings",
  "signup",
  "story",
  "story-editor",
  "story-viewer",
  "user",
  "video-editor",
  "wallet",
]);

/** Returned when a marketing/public URL has no matching rewrite rule. */
export const LINKING_SAFE_FALLBACK_PATH = "/(app)/(tabs)" as const;

function splitPathnameQueryAndHash(input: string): {
  pathname: string;
  rest: string;
} {
  const trimmed = input.trim();
  if (trimmed.includes("://")) {
    try {
      const u = new URL(trimmed);
      const rest = `${u.search}${u.hash}`;
      const rawPath = u.pathname;
      const blankPath = rawPath === "" || rawPath === "/";
      // jaaspire://wallet puts "wallet" in hostname with an empty path — normalize to /wallet
      if (`${u.protocol}` === `${APP_SCHEME}:` && blankPath && u.hostname) {
        return { pathname: `/${u.hostname}`, rest };
      }
      const pathname = rawPath && rawPath !== "" ? rawPath : "/";
      return { pathname, rest };
    } catch {
      /* fall through to path-only handling */
    }
  }

  const q = trimmed.indexOf("?");
  const h = trimmed.indexOf("#");
  let pathPart = trimmed;
  let rest = "";

  if (q >= 0) {
    pathPart = trimmed.slice(0, q);
    rest = trimmed.slice(q);
  } else if (h >= 0) {
    pathPart = trimmed.slice(0, h);
    rest = trimmed.slice(h);
  }

  if (pathPart === "" || pathPart === "/") {
    return { pathname: "/", rest };
  }

  const pathname = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  return { pathname, rest };
}

/**
 * Extracts peer/sender id from push or web messenger URLs, e.g.
 * `/my/messenger?chat=5452`, `/chat/5452`, or `?chat=5452`.
 */
export function extractChatPeerIdFromPushUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.includes("://")) {
      const u = new URL(trimmed);
      const fromQuery = u.searchParams.get("chat");
      if (fromQuery) return fromQuery;

      const pathMatch = u.pathname.match(/\/chat\/([^/]+)\/?$/);
      if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);
    }
  } catch {
    /* fall through */
  }

  const { pathname, rest } = splitPathnameQueryAndHash(trimmed);
  if (pathname === "/chat" && rest.startsWith("?")) {
    const params = new URLSearchParams(rest.slice(1));
    const chat = params.get("chat");
    if (chat) return chat;
  }

  const pathMatch = pathname.match(/^\/chat\/([^/]+)\/?$/);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

  const queryMatch = trimmed.match(/[?&]chat=([^&#]+)/);
  if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1]);

  return null;
}

/**
 * Maps /chat?chat={senderId} → /chat/{senderId} for app/(app)/chat/[senderId].tsx.
 */
function applyChatSenderIdFromQuery(
  pathname: string,
  rest: string,
): string | null {
  if (pathname !== "/chat" || rest === "") return null;

  const hashIdx = rest.indexOf("#");
  const queryPart = hashIdx >= 0 ? rest.slice(0, hashIdx) : rest;
  const hashPart = hashIdx >= 0 ? rest.slice(hashIdx) : "";
  if (!queryPart.startsWith("?")) return null;

  const params = new URLSearchParams(queryPart.slice(1));
  const senderId = params.get("chat");
  if (!senderId) return null;

  params.delete("chat");
  const remainingQuery = params.toString();
  const suffix = remainingQuery ? `?${remainingQuery}` : "";

  return `/chat/${encodeURIComponent(senderId)}${suffix}${hashPart}`;
}

/**
 * Rewrites a marketing/public path segment to an Expo Router pathname.
 * Accepts a full URL or a path; preserves query + hash on output.
 * Falls back to the home tab for unsupported public URLs.
 */
export function rewriteMarketingPathToRouterPath(inputPath: string): string {
  try {
    const { pathname, rest } = splitPathnameQueryAndHash(inputPath);

    for (const rule of PUBLIC_ROUTE_ALIASES) {
      if (rule.pattern.test(pathname)) {
        const rewritten = pathname.replace(rule.pattern, rule.replacement);
        const withChatParam = applyChatSenderIdFromQuery(rewritten, rest);
        if (withChatParam != null) return withChatParam;
        return `${rewritten}${rest}`;
      }
    }

    // Web/marketing profile URLs: /username → /user/username (not /@handle)
    const oneSeg = pathname.match(/^\/([^/]+)\/?$/);
    if (oneSeg) {
      const seg = decodeURIComponent(oneSeg[1]);
      if (
        seg.length > 0 &&
        !RESERVED_SINGLE_SEGMENT_PATHS.has(seg.toLowerCase())
      ) {
        return `/user/${encodeURIComponent(seg)}${rest}`;
      }
    }

    return LINKING_SAFE_FALLBACK_PATH;
  } catch {
    return LINKING_SAFE_FALLBACK_PATH;
  }
}
