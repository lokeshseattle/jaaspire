export const ATTRIBUTION_DONE_KEY = "attribution_done";
export const INSTALL_TRACK_DONE_KEY = "install_track_done";
export const AD_UTM_SOURCE_KEY = "ad_utm_source";
export const AD_UTM_MEDIUM_KEY = "ad_utm_medium";
export const AD_UTM_CAMPAIGN_KEY = "ad_utm_campaign";
export const AD_UTM_TERM_KEY = "ad_utm_term";
export const AD_UTM_CONTENT_KEY = "ad_utm_content";
export const AD_FBCLID_KEY = "ad_fbclid";
export const AD_GCLID_KEY = "ad_gclid";
export const AD_GAD_SOURCE_KEY = "ad_gad_source";
export const AD_GAD_CAMPAIGNID_KEY = "ad_gad_campaignid";
export const AD_REFERRER_KEY = "ad_referrer";

export const DEFAULT_SOURCE = "organic";

export const SOURCE_ALIASES: Record<string, string> = {
  google: "google",
  "google ads": "google",
  // "google-play": "organic",
  gclid: "google",
  facebook: "meta",
  meta: "meta",
  instagram: "meta",
  fb: "meta",
  organic: "organic",
};

export function normalizeSource(raw: string): string {
  const key = raw.trim().toLowerCase();
  return SOURCE_ALIASES[key] ?? key;
}
