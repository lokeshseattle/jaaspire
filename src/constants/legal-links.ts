import { LEGAL_WEB_ORIGIN } from "@/src/constants/app-env";

/** Public policy pages (same paths as Help & Support). */
export const LEGAL_LINKS = {
  termsOfService: `${LEGAL_WEB_ORIGIN}/pages/terms-of-service`,
  privacyPolicy: `${LEGAL_WEB_ORIGIN}/pages/privacy-policy`,
  acceptableUsePolicy: `${LEGAL_WEB_ORIGIN}/pages/acceptable-use-policy`,
  complaintsPolicy: `${LEGAL_WEB_ORIGIN}/pages/complaint-policy`,
} as const;
