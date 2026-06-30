import { RootProviders } from "@/src/components/providers/RootProviders";
import { useRootLayoutEffects } from "@/src/hooks/use-root-layout-effects";
import { runModuleBootstrap } from "@/src/lib/app-bootstrap";
import { ThemeProvider } from "@/src/theme/ThemeProvider";
import { Stack } from "expo-router";
import "react-native-reanimated";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";

runModuleBootstrap();

function RootLayoutInner() {
  useRootLayoutEffects();

  return (
    <RootProviders>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
        <Stack.Screen
          name="(auth)"
          options={{ animation: "slide_from_left" }}
        />
      </Stack>
    </RootProviders>
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
