import { useAuth } from "@/src/features/auth/auth.hooks";
import { asyncStoragePersister } from "@/src/lib/persister";
import { ThemeProvider } from "@/src/theme/ThemeProvider";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import NetworkListener from "@/src/components/toast/NetworkListener";
import { ToastProvider } from "@/src/components/toast/ToastProvider";
import { queryClient } from "@/src/lib/query-client";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "react-native-reanimated";

export default function RootLayout() {
  const { restoreSession } = useAuth();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <ThemeProvider>
      <ActionSheetProvider>
        <ToastProvider>
          <PersistQueryClientProvider
            persistOptions={{
              persister: asyncStoragePersister,
              maxAge: 1000 * 60 * 60 * 24, // 24h
              dehydrateOptions: {
                shouldDehydrateQuery: (query) => {
                  // only persist queries marked with meta.persist
                  if (!query.meta?.persist) return false;

                  //As long as there is something useful to show, persist it.
                  return !!query.state.data;
                },
              },
            }}
            client={queryClient}
          >
            <KeyboardProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheetModalProvider>

                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(app)" />
                    <Stack.Screen
                      name="(auth)"
                      options={{ animation: "slide_from_left" }}
                    />
                  </Stack></BottomSheetModalProvider>
              </GestureHandlerRootView>
            </KeyboardProvider>
          </PersistQueryClientProvider>
          <NetworkListener />
        </ToastProvider>
      </ActionSheetProvider>
    </ThemeProvider>
  );
}
