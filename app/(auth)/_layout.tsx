import { useAuth } from "@/src/features/auth/auth.hooks";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Redirect, Stack } from "expo-router";

export default function AuthLayout() {
  const { theme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen
        name="register"
        options={{
          headerBackVisible: true,
          headerShown: true,
          headerBackTitle: "Back",
          title: "",
        }}
      />
      <Stack.Screen
        name="verify-2fa"
        options={{
          headerBackVisible: true,
          headerShown: true,
          headerBackTitle: "Back",
          title: "",
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          headerBackVisible: true,
          headerShown: true,
          headerBackTitle: "Back",
          title: "",
        }}
      />
    </Stack>
  );
}
