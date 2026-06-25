import { Platform } from "react-native";

import { getAndroidReferrerAttribution } from "./attribution.android";
import { DEFAULT_SOURCE } from "./attribution.constants";
import {
  getAppVersion,
  getInstallDeviceId,
  getInstallPlatform,
} from "./attribution.device";
import { trackInstall } from "./attribution.install.api";
import type { ReferrerAttribution } from "./attribution.parser";
import {
  getAttributionDone,
  getFullStoredAttribution,
  getInstallTrackDone,
  persistAttribution,
  setAttributionDone,
  setInstallTrackDone,
} from "./attribution.storage";

export async function captureAttributionOnce(): Promise<void> {
  try {
    if ((await getAttributionDone()) === "true") return;

    let attribution: ReferrerAttribution = { utm_source: DEFAULT_SOURCE };

    if (Platform.OS === "android") {
      const referrerResult = await getAndroidReferrerAttribution();
      if (referrerResult) {
        attribution = {
          ...referrerResult.attribution,
          referrer: referrerResult.rawReferrer,
        };
      }
    }

    await persistAttribution(attribution);
    await setAttributionDone("true");
  } catch (error) {
    if (__DEV__) console.warn("[attribution] capture failed", error);
    await persistAttribution({ utm_source: DEFAULT_SOURCE }).catch(() => {});
    await setAttributionDone("true").catch(() => {});
  }
}

export async function trackInstallOnce(): Promise<void> {
  try {
    if ((await getInstallTrackDone()) === "true") return;

    const platform = getInstallPlatform();
    if (!platform) return;

    await captureAttributionOnce();

    const attribution = await getFullStoredAttribution();
    const [deviceId, appVersion] = await Promise.all([
      getInstallDeviceId(),
      Promise.resolve(getAppVersion()),
    ]);
    // const country = getDeviceCountry();

    await trackInstall({
      device_id: deviceId,
      platform,
      app_version: appVersion,
      utm_source: attribution.utm_source ?? attribution.gad_source ?? null,
      utm_medium: attribution.utm_medium ?? null,
      utm_campaign:
        attribution.utm_campaign ?? attribution.gad_campaignid ?? null,
      utm_term: attribution.utm_term ?? null,
      utm_content: attribution.utm_content ?? null,
      fbclid: attribution.fbclid ?? null,
      gclid: attribution.gclid ?? null,
      referrer: attribution.referrer ?? null,
      country: "",
    });

    await setInstallTrackDone("true");
  } catch (error) {
    if (__DEV__) console.warn("[attribution] install track once failed", error);
  }
}
