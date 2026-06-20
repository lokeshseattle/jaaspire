import { getAnalytics, logEvent } from "@react-native-firebase/analytics";

import { getAdUtmSource } from "./attribution.storage";

export async function logRegistrationAttribution(): Promise<void> {
  try {
    const campaign_source = await getAdUtmSource();
    const analytics = getAnalytics();

    // Typed sign_up overload only allows { method }; use string name for extra params.
    await logEvent(analytics, "sign_up" as string, {
      method: "email",
      campaign_source,
    });
  } catch (error) {
    if (__DEV__) console.warn("[attribution] sign_up failed", error);
  }
}
