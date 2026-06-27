import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  AD_FBCLID_KEY,
  AD_GAD_CAMPAIGNID_KEY,
  AD_GAD_SOURCE_KEY,
  AD_GBRAID_KEY,
  AD_GCLID_KEY,
  AD_REFERRER_KEY,
  AD_UTM_CAMPAIGN_KEY,
  AD_UTM_CONTENT_KEY,
  AD_UTM_MEDIUM_KEY,
  AD_UTM_SOURCE_KEY,
  AD_UTM_TERM_KEY,
  ATTRIBUTION_DONE_KEY,
  INSTALL_TRACK_DONE_KEY,
} from "./attribution.constants";
import type { ReferrerAttribution } from "./attribution.parser";

async function getOptionalString(key: string): Promise<string | undefined> {
  try {
    const value = await AsyncStorage.getItem(key);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  } catch {
    /* non-fatal */
  }
  return undefined;
}

async function setOptionalString(
  key: string,
  value: string | undefined,
): Promise<void> {
  try {
    if (value) {
      await AsyncStorage.setItem(key, value);
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    /* non-fatal */
  }
}

export async function getAttributionDone(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ATTRIBUTION_DONE_KEY);
  } catch {
    return null;
  }
}

export async function setAttributionDone(value: "true"): Promise<void> {
  try {
    await AsyncStorage.setItem(ATTRIBUTION_DONE_KEY, value);
  } catch {
    /* non-fatal */
  }
}

export async function getInstallTrackDone(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(INSTALL_TRACK_DONE_KEY);
  } catch {
    return null;
  }
}

export async function setInstallTrackDone(value: "true"): Promise<void> {
  try {
    await AsyncStorage.setItem(INSTALL_TRACK_DONE_KEY, value);
  } catch {
    /* non-fatal */
  }
}

export async function getAdUtmSource(): Promise<string | undefined> {
  const attribution = await getStoredAttribution();
  return attribution.utm_source;
}

export async function getStoredAttribution(): Promise<ReferrerAttribution> {
  return getFullStoredAttribution();
}

export async function getFullStoredAttribution(): Promise<ReferrerAttribution> {
  const attribution: ReferrerAttribution = {};

  try {
    const utmSource = await getOptionalString(AD_UTM_SOURCE_KEY);
    if (utmSource) attribution.utm_source = utmSource;

    const utmMedium = await getOptionalString(AD_UTM_MEDIUM_KEY);
    if (utmMedium) attribution.utm_medium = utmMedium;

    const utmCampaign = await getOptionalString(AD_UTM_CAMPAIGN_KEY);
    if (utmCampaign) attribution.utm_campaign = utmCampaign;

    const utmTerm = await getOptionalString(AD_UTM_TERM_KEY);
    if (utmTerm) attribution.utm_term = utmTerm;

    const utmContent = await getOptionalString(AD_UTM_CONTENT_KEY);
    if (utmContent) attribution.utm_content = utmContent;

    const fbclid = await getOptionalString(AD_FBCLID_KEY);
    if (fbclid) attribution.fbclid = fbclid;

    const gclid = await getOptionalString(AD_GCLID_KEY);
    if (gclid) attribution.gclid = gclid;

    const gbraid = await getOptionalString(AD_GBRAID_KEY);
    if (gbraid) attribution.gbraid = gbraid;

    const gadSource = await getOptionalString(AD_GAD_SOURCE_KEY);
    if (gadSource) attribution.gad_source = gadSource;

    const gadCampaignId = await getOptionalString(AD_GAD_CAMPAIGNID_KEY);
    if (gadCampaignId) attribution.gad_campaignid = gadCampaignId;

    const referrer = await getOptionalString(AD_REFERRER_KEY);
    if (referrer) attribution.referrer = referrer;
  } catch {
    /* non-fatal */
  }

  return attribution;
}

export async function persistAttribution(
  params: ReferrerAttribution,
): Promise<void> {
  try {
    await setOptionalString(AD_UTM_SOURCE_KEY, params.utm_source);
    await setOptionalString(AD_UTM_MEDIUM_KEY, params.utm_medium);
    await setOptionalString(AD_UTM_CAMPAIGN_KEY, params.utm_campaign);
    await setOptionalString(AD_UTM_TERM_KEY, params.utm_term);
    await setOptionalString(AD_UTM_CONTENT_KEY, params.utm_content);
    await setOptionalString(AD_FBCLID_KEY, params.fbclid);
    await setOptionalString(AD_GCLID_KEY, params.gclid);
    await setOptionalString(AD_GBRAID_KEY, params.gbraid);
    await setOptionalString(AD_GAD_SOURCE_KEY, params.gad_source);
    await setOptionalString(AD_GAD_CAMPAIGNID_KEY, params.gad_campaignid);
    await setOptionalString(AD_REFERRER_KEY, params.referrer);
  } catch {
    /* non-fatal */
  }
}
