import { getAnalytics, logEvent } from "@react-native-firebase/analytics";

import { Platform } from "react-native";
import { getAdUtmSource } from "./attribution.storage";

export async function logRegistrationAttribution(): Promise<void> {
  try {
    const campaign_source = await getAdUtmSource();
    const analytics = getAnalytics();

    // Typed sign_up overload only allows { method }; use string name for extra params.
    await logEvent(analytics, "sign_up" as string, {
      method: "email",
      ...(campaign_source ? { campaign_source } : {}),
    });
  } catch (error) {
    if (__DEV__) console.warn("[attribution] sign_up failed", error);
  }
}

export async function logScreenView(
  screenName: string,
  screenClass?: string,
): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  try {
    const analytics = getAnalytics();
    await logEvent(analytics, "screen_view", {
      screen_name: screenName,
      screen_class: screenClass ?? screenName,
    });
  } catch (error) {
    if (__DEV__) console.warn("[analytics] screen_view failed", error);
  }
}
