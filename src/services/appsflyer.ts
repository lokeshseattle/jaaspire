import { ensureTrackingPermission } from "@/src/services/tracking-transparency";
import appsFlyer from "react-native-appsflyer";

const APPSFLYER_DEV_KEY = "wFo7ecg3WKivkAR2236Phi";
const APPSFLYER_IOS_APP_ID = "6762010702";

function initAppsFlyer(): void {
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
        // store uid, send to your API, etc.
      });
    },
    (error) => {
      if (__DEV__) console.error("[AppsFlyer] init error", error);
    },
  );
}

/** Request ATT (iOS) then start AppsFlyer. Safe to call once at app startup. */
export async function bootstrapAppsFlyer(): Promise<void> {
  await ensureTrackingPermission();
  initAppsFlyer();
}
