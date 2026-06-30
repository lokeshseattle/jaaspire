import type { ReferrerAttribution } from "./attribution.parser";

type AppsFlyerData = Record<string, unknown>;

function str(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

/** Maps AppsFlyer conversion / deep link payload into stored attribution fields. */
export function mapAppsFlyerToAttribution(
  data: AppsFlyerData,
): ReferrerAttribution {
  return {
    utm_source: str(data.media_source) ?? str(data.pid),
    utm_medium: str(data.af_channel),
    utm_campaign: str(data.campaign) ?? str(data.c),
    utm_term: str(data.af_keywords),
    utm_content: str(data.af_adset) ?? str(data.af_ad) ?? str(data.af_sub2),
    gclid: str(data.gclid),
    fbclid: str(data.fbclid),
    gbraid: str(data.gbraid),
    gad_source: str(data.gad_source),
    gad_campaignid: str(data.gad_campaignid),
    referrer: JSON.stringify(data),
  };
}
