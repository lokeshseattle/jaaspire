/**
 * Expo Router native hook: rewrites incoming OS / custom-scheme URLs before they
 * become navigation state. See:
 * https://docs.expo.dev/router/advanced/native-intent/
 *
 * All path rules live in src/constants/linking.config.ts — search for AGENT_CONTEXT
 * there for the copy-paste template when adding web URL ↔ in-app route mappings.
 * Do not duplicate alias logic here.
 */

import { rewriteMarketingPathToRouterPath } from "@/src/constants/linking.config";

const SAFE_FALLBACK = "/";

export function redirectSystemPath({
  path,
  initial: _initial,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    return rewriteMarketingPathToRouterPath(path);
  } catch {
    return SAFE_FALLBACK;
  }
}
