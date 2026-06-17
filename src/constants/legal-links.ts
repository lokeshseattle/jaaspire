import { LEGAL_WEB_ORIGIN } from "@/src/constants/app-env";

/** Apple Standard EULA for in-app purchases (App Store requirement). */
export const APPLE_STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

/** Public policy pages (same paths as Help & Support). */
export const LEGAL_LINKS = {
  termsOfService: `${LEGAL_WEB_ORIGIN}/pages/terms-of-service`,
  privacyPolicy: `${LEGAL_WEB_ORIGIN}/pages/privacy-policy`,
  acceptableUsePolicy: `${LEGAL_WEB_ORIGIN}/pages/acceptable-use-policy`,
  complaintsPolicy: `${LEGAL_WEB_ORIGIN}/pages/complaint-policy`,
  termsOfUseEULA: `${LEGAL_WEB_ORIGIN}/pages/terms-of-use`,
} as const;
