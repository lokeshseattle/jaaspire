import "dotenv/config";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Mirrors logic in src/constants/app-env.ts (keep defaults in sync).
 * Inline here because Expo config evaluation does not resolve TS path imports
 * from ./src the same way Metro does.
 */
function resolveWebOriginForConfig(): string {
  const DEFAULT = "https://stgx.jaaspire.com";
  const raw = process.env.EXPO_PUBLIC_WEB_ORIGIN?.trim();
  const origin = raw || DEFAULT;
  return origin.replace(/\/+$/, "");
}

function hostnameFromOrigin(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return "stgx.jaaspire.com";
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const webOrigin = resolveWebOriginForConfig();
  const hostname = hostnameFromOrigin(webOrigin);

  const extra = config.extra as Record<string, unknown> | undefined;
  const routerExtra =
    extra && typeof extra.router === "object" && extra.router !== null
      ? (extra.router as Record<string, unknown>)
      : {};

  return {
    ...config,
    // ConfigContext.config is partial; ExpoConfig requires these (see app.json).
    name: config.name ?? "Jaaspire",
    slug: config.slug ?? "jaaspire",
    version: config.version ?? "1.0.0",
    ios: {
      ...config.ios,
      associatedDomains: [`applinks:${hostname}`],
    },
    android: {
      ...config.android,
      intentFilters: [
        {
          action: "VIEW",
          data: [
            {
              scheme: "https",
              host: hostname,
              pathPrefix: "/",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },
    extra: {
      ...extra,
      router: {
        ...routerExtra,
        origin: webOrigin,
      },
    },
  };
};
