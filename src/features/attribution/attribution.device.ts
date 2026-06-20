import * as Application from "expo-application";
import Constants from "expo-constants";
import { getLocales } from "expo-localization";
import { Platform } from "react-native";

export type InstallPlatform = "ios" | "android";

export function getInstallPlatform(): InstallPlatform | null {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return null;
}

export async function getInstallDeviceId(): Promise<string> {
  if (Platform.OS === "ios") {
    const deviceId = await Application.getIosIdForVendorAsync();
    if (deviceId) return deviceId;
  }

  if (Platform.OS === "android") {
    const deviceId = Application.getAndroidId();
    if (deviceId) return deviceId;
  }

  throw new Error("[attribution] stable device identifier unavailable");
}

export function getAppVersion(): string {
  const nativeVersion = Application.nativeApplicationVersion?.trim();
  if (nativeVersion) return nativeVersion;

  const configVersion = Constants.expoConfig?.version?.trim();
  if (configVersion) return configVersion;

  return "0.0.0";
}

export function getDeviceCountry(): string | null {
  try {
    const regionCode = getLocales()[0]?.regionCode?.trim();
    return regionCode || null;
  } catch {
    return null;
  }
}
