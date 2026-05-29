import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export type PushPlatform = "ios" | "android";

export function getPushPlatform(): PushPlatform | null {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return null;
}

export async function getPushDeviceName(): Promise<string> {
  const name = Device.deviceName?.trim();
  if (name) return name;

  const model = Device.modelName?.trim();
  if (model) return model;

  return `${Platform.OS} device`;
}

export async function registerForPushNotificationsAsync(): Promise<
  string | null
> {
  const platform = getPushPlatform();
  if (!platform) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    if (__DEV__) {
      console.warn(
        "Push notification permission not granted; skipping device registration.",
      );
    }
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId;
  if (!projectId) {
    if (__DEV__) {
      console.warn("EAS project ID not found; skipping push token registration.");
    }
    return null;
  }

  try {
    const pushTokenString = (
      await Notifications.getExpoPushTokenAsync({
        projectId,
      })
    ).data;
    return pushTokenString;
  } catch (e: unknown) {
    if (__DEV__) {
      console.warn("Failed to get Expo push token:", e);
    }
    return null;
  }
}
