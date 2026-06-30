import {
    getTrackingPermissionsAsync,
    PermissionStatus,
    requestTrackingPermissionsAsync,
} from "expo-tracking-transparency";
import { Platform } from "react-native";

export type TrackingPermissionResult = {
  granted: boolean;
  status: PermissionStatus;
};

export async function ensureTrackingPermission(): Promise<TrackingPermissionResult> {
  if (Platform.OS !== "ios") {
    return { granted: true, status: PermissionStatus.GRANTED };
  }

  try {
    const current = await getTrackingPermissionsAsync();

    if (current.status !== PermissionStatus.UNDETERMINED) {
      return { granted: current.granted, status: current.status };
    }

    const requested = await requestTrackingPermissionsAsync();
    return { granted: requested.granted, status: requested.status };
  } catch (error) {
    if (__DEV__) console.warn("[att] request failed", error);
    return { granted: false, status: PermissionStatus.DENIED };
  }
}
