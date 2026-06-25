import { useAttributionCapture } from "@/src/features/attribution/attribution.hooks";
import { AuthLogoutAlert } from "@/src/features/auth/AuthLogoutAlert";
import { useAuth } from "@/src/features/auth/auth.hooks";
import { configureForegroundNotificationHandler } from "@/src/features/push/foreground-notification-handler";
import { useActiveChatRouteSync } from "@/src/hooks/use-active-chat-route-sync";
import { useAndroidNavigationBarSync } from "@/src/hooks/use-android-navigation-bar-sync";
import { useExpoUpdates } from "@/src/hooks/use-expo-updates";
import { useNotificationDeepLink } from "@/src/hooks/use-notification-deep-link";
import { asyncStoragePersister } from "@/src/lib/persister";
import { initializeSessionSeed } from "@/src/lib/seed.store";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeProvider";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import NetworkListener from "@/src/components/toast/NetworkListener";
import { ToastProvider } from "@/src/components/toast/ToastProvider";
import { useAnalyticsScreenTracking } from "@/src/hooks/use-firebase-analytics";
import { queryClient } from "@/src/lib/query-client";
import { startSystemVolumeUnmuteSync } from "@/src/lib/system-volume-unmute-sync";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "react-native-reanimated";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

SplashScreen.preventAutoHideAsync();

initializeSessionSeed();

configureForegroundNotificationHandler();

// Inner layout that can use theme hooks
function RootLayoutInner() {
  useAttributionCapture();
  useAnalyticsScreenTracking();
  const { restoreSession, isLoading: authLoading } = useAuth();
  const { theme } = useTheme();

  // Determine if dark mode
  const isDark = theme.colors.background === "#0B0F14";

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    return startSystemVolumeUnmuteSync();
  }, []);

  useActiveChatRouteSync();
  useAndroidNavigationBarSync();
  useExpoUpdates();

  // Notification tap → rewrite data.url → router.push (cold start + foreground/background).
  useNotificationDeepLink({ enabled: !authLoading });

  // Hide splash for every entry route (including cold-start universal links that skip app/index.tsx).
  useEffect(() => {
    if (authLoading) return;
    SplashScreen.setOptions({
      duration: 1000,
      fade: true,
    });
    void SplashScreen.hideAsync();
  }, [authLoading]);

  return (
    <>
      <StatusBar
        // style={isDark ? "light" : "dark"}
        translucent={false}
        backgroundColor={theme.colors.background}
      />
      <ActionSheetProvider>
        <ToastProvider>
          <PersistQueryClientProvider
            persistOptions={{
              persister: asyncStoragePersister,
              maxAge: 1000 * 60 * 60 * 24, // 24h
              dehydrateOptions: {
                shouldDehydrateQuery: (query) => {
                  if (!query.meta?.persist) return false;
                  return !!query.state.data;
                },
              },
            }}
            client={queryClient}
          >
            <KeyboardProvider>
              <GestureHandlerRootView
                style={{ flex: 1, backgroundColor: theme.colors.background }}
              >
                <BottomSheetModalProvider>
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(app)" />
                    <Stack.Screen
                      name="(auth)"
                      options={{ animation: "slide_from_left" }}
                    />
                  </Stack>
                </BottomSheetModalProvider>
              </GestureHandlerRootView>
            </KeyboardProvider>
          </PersistQueryClientProvider>
          <NetworkListener />
          <AuthLogoutAlert />
        </ToastProvider>
      </ActionSheetProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider
        initialMetrics={initialWindowMetrics}
        style={{ flex: 1 }}
      >
        <RootLayoutInner />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
