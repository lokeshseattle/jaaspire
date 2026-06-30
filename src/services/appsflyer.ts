import { mapAppsFlyerToAttribution } from "@/src/features/attribution/attribution.appsflyer";
import {
  getFullStoredAttribution,
  persistAttribution,
  setAttributionDone,
} from "@/src/features/attribution/attribution.storage";
import { ensureTrackingPermission } from "@/src/services/tracking-transparency";
import { Platform } from "react-native";
import appsFlyer from "react-native-appsflyer";

const APPSFLYER_DEV_KEY = "wFo7ecg3WKivkAR2236Phi";
const APPSFLYER_IOS_APP_ID = "6762010702";

let listenersRegistered = false;

async function persistAppsFlyerAttribution(
  data: Record<string, unknown>,
): Promise<void> {
  const attribution = mapAppsFlyerToAttribution(data);
  await persistAttribution(attribution);
  await setAttributionDone("true");

  if (__DEV__) console.log("[AppsFlyer] install attribution", attribution);
}

async function mergeAppsFlyerAttribution(
  data: Record<string, unknown>,
): Promise<void> {
  const existing = await getFullStoredAttribution();
  const mapped = mapAppsFlyerToAttribution(data);
  await persistAttribution({ ...existing, ...mapped });
  await setAttributionDone("true");

  if (__DEV__) console.log("[AppsFlyer] deep link attribution", mapped);
}

function registerAppsFlyerAttributionListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  appsFlyer.onInstallConversionData((res) => {
    if (res.status !== "success") {
      if (__DEV__) console.warn("[AppsFlyer] conversion failed", res);
      return;
    }

    const data = res.data;
    if (data.is_first_launch !== "true") return;

    void persistAppsFlyerAttribution(data).catch((error) => {
      if (__DEV__) console.warn("[AppsFlyer] persist install attribution failed", error);
    });
  });

  appsFlyer.onDeepLink((res) => {
    if (res.deepLinkStatus !== "FOUND") return;

    void mergeAppsFlyerAttribution(res.data).catch((error) => {
      if (__DEV__) console.warn("[AppsFlyer] persist deep link attribution failed", error);
    });
  });
}

function initAppsFlyer(): void {
  registerAppsFlyerAttributionListeners();

  appsFlyer.initSdk(
    {
      devKey: APPSFLYER_DEV_KEY,
      appId: APPSFLYER_IOS_APP_ID,
      isDebug: __DEV__,
      onInstallConversionDataListener: true,
      onDeepLinkListener: true,
      timeToWaitForATTUserAuthorization: 10,
    },
    (result) => {
      if (__DEV__) console.log("[AppsFlyer] initialized", result);

      appsFlyer.getAppsFlyerUID((error, uid) => {
        if (error) {
          if (__DEV__) console.error("[AppsFlyer] UID error", error);
          return;
        }
        if (__DEV__) console.log("[AppsFlyer] UID", uid);
      });
    },
    (error) => {
      if (__DEV__) console.error("[AppsFlyer] init error", error);
    },
  );
}

/** Request ATT (iOS) then start AppsFlyer. Safe to call once at app startup. */
export async function bootstrapAppsFlyer(): Promise<void> {
  if (Platform.OS !== "ios") return;

  await ensureTrackingPermission();
  initAppsFlyer();
}
