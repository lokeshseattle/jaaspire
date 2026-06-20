import { requestTrackingPermissionsAsync } from "expo-tracking-transparency";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * Requests iOS App Tracking Transparency (ATT) permission on cold start.
 * Required for Firebase Analytics to access IDFA when the user allows tracking.
 */
export function useAppTrackingTransparency(): void {
  const startedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const { status, granted, canAskAgain } =
          await requestTrackingPermissionsAsync();

        if (status === "granted" || granted) {
          console.log(
            "[ATT] Granted — user selected Allow. Firebase Analytics may collect IDFA.",
            { status, canAskAgain },
          );
          return;
        }

        if (status === "denied") {
          console.log(
            "[ATT] Denied — user selected Ask App Not to Track. IDFA will not be available.",
            { status, canAskAgain },
          );
          return;
        }

        console.log("[ATT] Permission not granted.", {
          status,
          granted,
          canAskAgain,
        });
      } catch (error) {
        console.log("[ATT] Failed to request tracking permission.", error);
      }
    })();
  }, []);
}
