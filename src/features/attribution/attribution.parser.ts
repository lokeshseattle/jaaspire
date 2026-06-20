import { normalizeSource } from "./attribution.constants";

export type ReferrerAttribution = {
  utm_source: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  fbclid?: string;
  gclid?: string;
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

  let utmSource: string | null = null;
  const utmSourceParam = params.get("utm_source");
  if (utmSourceParam) utmSource = normalizeSource(utmSourceParam);
  else if (params.has("gclid")) utmSource = "google";
  else if (params.has("fbclid")) utmSource = "meta";

  if (!utmSource) return null;

  const attribution: ReferrerAttribution = { utm_source: utmSource };

  const utmMedium = params.get("utm_medium")?.trim();
  if (utmMedium) attribution.utm_medium = utmMedium;

  const utmCampaign = params.get("utm_campaign")?.trim();
  if (utmCampaign) attribution.utm_campaign = utmCampaign;

  const utmTerm = params.get("utm_term")?.trim();
  if (utmTerm) attribution.utm_term = utmTerm;

  const utmContent = params.get("utm_content")?.trim();
  if (utmContent) attribution.utm_content = utmContent;

  const fbclid = params.get("fbclid")?.trim();
  if (fbclid) attribution.fbclid = fbclid;

  const gclid = params.get("gclid")?.trim();
  if (gclid) attribution.gclid = gclid;

  return attribution;
}

export function parseReferrerParams(raw: string): string | null {
  return extractReferrerAttribution(raw)?.utm_source ?? null;
}
