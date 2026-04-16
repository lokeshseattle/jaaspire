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
    description: "Short profile links: /@username → /user/username",
    pattern: /^\/@([^/]+)\/?$/,
    replacement: "/user/$1",
  },
  {
    description: "Web post URLs: /posts/id → /post/id (matches post/[postId])",
    pattern: /^\/posts\/([^/]+)\/?$/,
    replacement: "/post/$1",
  },
  {
    description: "Short post links: /p/id → /post/id",
    pattern: /^\/p\/([^/]+)\/?$/,
    replacement: "/post/$1",
  },
];

const SAFE_FALLBACK_PATH = "/";

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
 * Rewrites a marketing/public path segment to an Expo Router pathname.
 * Accepts a full URL or a path; preserves query + hash on output.
 * Returns pass-through pathname if no alias matches.
 */
export function rewriteMarketingPathToRouterPath(inputPath: string): string {
  try {
    const { pathname, rest } = splitPathnameQueryAndHash(inputPath);

    for (const rule of PUBLIC_ROUTE_ALIASES) {
      if (rule.pattern.test(pathname)) {
        const rewritten = pathname.replace(rule.pattern, rule.replacement);
        return `${rewritten}${rest}`;
      }
    }

    return `${pathname}${rest}`;
  } catch {
    return SAFE_FALLBACK_PATH;
  }
}
