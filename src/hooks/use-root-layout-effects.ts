import { useAttributionCapture } from "@/src/features/attribution/attribution.hooks";
import { useAuth } from "@/src/features/auth/auth.hooks";
import { useActiveChatRouteSync } from "@/src/hooks/use-active-chat-route-sync";
import { useAndroidNavigationBarSync } from "@/src/hooks/use-android-navigation-bar-sync";
import { useExpoUpdates } from "@/src/hooks/use-expo-updates";
import { useAnalyticsScreenTracking } from "@/src/hooks/use-firebase-analytics";
import { useNotificationDeepLink } from "@/src/hooks/use-notification-deep-link";
import { startSystemVolumeUnmuteSync } from "@/src/lib/system-volume-unmute-sync";
import { bootstrapAppsFlyer } from "@/src/services/appsflyer";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";

export function useRootLayoutEffects(): void {
  useAttributionCapture();
  useAnalyticsScreenTracking();
  useActiveChatRouteSync();
  useAndroidNavigationBarSync();
  useExpoUpdates();

  const { restoreSession, isLoading: authLoading } = useAuth();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const stopVolumeSync = startSystemVolumeUnmuteSync();
    void bootstrapAppsFlyer();
    return stopVolumeSync;
  }, []);

  useNotificationDeepLink({ enabled: !authLoading });

  useEffect(() => {
    if (authLoading) return;

    SplashScreen.setOptions({ duration: 1000, fade: true });
    void SplashScreen.hideAsync();
  }, [authLoading]);
}
