import { useAuth } from "@/src/features/auth/auth.hooks";
import { asyncStoragePersister } from "@/src/lib/persister";
import { ThemeProvider, useTheme } from "@/src/theme/ThemeProvider";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import NetworkListener from "@/src/components/toast/NetworkListener";
import { ToastProvider } from "@/src/components/toast/ToastProvider";
import { queryClient } from "@/src/lib/query-client";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

SplashScreen.preventAutoHideAsync();

// Inner layout that can use theme hooks
function RootLayoutInner() {
  const { restoreSession } = useAuth();
  const { theme } = useTheme();

  // Determine if dark mode
  const isDark = theme.colors.background === "#0B0F14";

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
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
        </ToastProvider>
      </ActionSheetProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SafeAreaProvider style={{ flex: 1 }}>
        <RootLayoutInner />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}