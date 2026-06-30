import NetworkListener from "@/src/components/toast/NetworkListener";
import { ToastProvider } from "@/src/components/toast/ToastProvider";
import { AuthLogoutAlert } from "@/src/features/auth/AuthLogoutAlert";
import { asyncStoragePersister } from "@/src/lib/persister";
import { queryClient } from "@/src/lib/query-client";
import { useTheme } from "@/src/theme/ThemeProvider";
import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type { PropsWithChildren } from "react";
import { StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

const QUERY_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export function RootProviders({ children }: PropsWithChildren) {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar
        translucent={false}
        backgroundColor={theme.colors.background}
      />
      <ActionSheetProvider>
        <ToastProvider>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
              persister: asyncStoragePersister,
              maxAge: QUERY_CACHE_MAX_AGE_MS,
              dehydrateOptions: {
                shouldDehydrateQuery: (query) =>
                  !!query.meta?.persist && !!query.state.data,
              },
            }}
          >
            <KeyboardProvider>
              <GestureHandlerRootView
                style={{ flex: 1, backgroundColor: theme.colors.background }}
              >
                <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
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
