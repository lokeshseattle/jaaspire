import type { AttributionExtras } from "@/src/services/api/api.types";

export type ReferrerAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  gclid?: string;
  gbraid?: string;
  gad_source?: string;
  gad_campaignid?: string;
  referrer?: string;
};

function decodeReferrerSearchParams(raw: string): URLSearchParams | null {
  try {
    const decoded = decodeURIComponent(raw.replace(/\+/g, " "));
    return new URLSearchParams(decoded);
  } catch {
    return null;
  }
}

export function decodeReferrerQueryParams(raw: string): Record<string, string> {
  const params = decodeReferrerSearchParams(raw);
  if (!params) return {};
  return Object.fromEntries(params.entries());
}

export function extractReferrerAttribution(
  raw: string,
): ReferrerAttribution | null {
  const params = decodeReferrerSearchParams(raw);
  if (!params) return null;

  const attribution: ReferrerAttribution = {};

  const utmSource = params.get("utm_source")?.trim();
  if (utmSource) attribution.utm_source = utmSource;

  const utmMedium = params.get("utm_medium")?.trim();
  if (utmMedium) attribution.utm_medium = utmMedium;

  const utmCampaign = params.get("utm_campaign")?.trim();
  if (utmCampaign) attribution.utm_campaign = utmCampaign;

  const gadCampaignId = params.get("gad_campaignid")?.trim();
  if (gadCampaignId) attribution.gad_campaignid = gadCampaignId;

  const utmTerm = params.get("utm_term")?.trim();
  if (utmTerm) attribution.utm_term = utmTerm;

  const utmContent = params.get("utm_content")?.trim();
  if (utmContent) attribution.utm_content = utmContent;

  const fbclid = params.get("fbclid")?.trim();
  if (fbclid) attribution.fbclid = fbclid;

  const gclid = params.get("gclid")?.trim();
  if (gclid) attribution.gclid = gclid;

  const gbraid = params.get("gbraid")?.trim();
  if (gbraid) attribution.gbraid = gbraid;

  const gadSource = params.get("gad_source")?.trim();
  if (gadSource) attribution.gad_source = gadSource;

  if (Object.keys(attribution).length === 0) return null;

  return attribution;
}

export function parseReferrerParams(raw: string): string | null {
  return extractReferrerAttribution(raw)?.utm_source ?? null;
}

export function buildAttributionExtras(
  attribution: ReferrerAttribution,
): AttributionExtras | null {
  const raw = attribution.referrer?.trim();
  if (!raw) return null;

  const parsed = decodeReferrerQueryParams(raw);
  const trimmedEntries = Object.entries(parsed)
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0);

  if (trimmedEntries.length === 0) {
    return { raw };
  }

  return {
    raw,
    ...Object.fromEntries(trimmedEntries),
  };
}
