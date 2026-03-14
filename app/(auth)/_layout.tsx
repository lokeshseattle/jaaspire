import { useTheme } from "@/src/theme/ThemeProvider";
import { Stack } from "expo-router";

export default function AuthLayout() {
  const { theme } = useTheme();

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
    </Stack>
  );
}