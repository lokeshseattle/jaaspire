import { WEB_ORIGIN } from "@/src/constants/app-env";

/** Public policy pages (same paths as Help & Support). */
export const LEGAL_LINKS = {
  termsOfService: `${WEB_ORIGIN}/pages/terms-of-service`,
  privacyPolicy: `${WEB_ORIGIN}/pages/privacy-policy`,
  acceptableUsePolicy: `${WEB_ORIGIN}/pages/acceptable-use-policy`,
  complaintsPolicy: `${WEB_ORIGIN}/pages/complaint-policy`,
} as const;
