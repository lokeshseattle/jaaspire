import { configureForegroundNotificationHandler } from "@/src/features/push/foreground-notification-handler";
import { initializeSessionSeed } from "@/src/lib/seed.store";
import * as SplashScreen from "expo-splash-screen";

/** One-time module init before the root React tree mounts. */
export function runModuleBootstrap(): void {
  void SplashScreen.preventAutoHideAsync();
  initializeSessionSeed();
  configureForegroundNotificationHandler();
}
