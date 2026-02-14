import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { KeyboardProvider } from "react-native-keyboard-controller";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/src/features/auth/auth.hooks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

const queryClient = new QueryClient();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { restoreSession, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <QueryClientProvider client={queryClient}>
        <KeyboardProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(app)" />
              <Stack.Screen
                name="(auth)"
                options={{ animation: "slide_from_left" }}
              />
            </Stack>
          </SafeAreaView>
        </KeyboardProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
