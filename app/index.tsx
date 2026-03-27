import { useAuth } from "@/src/features/auth/auth.hooks";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (isLoading) return;
    SplashScreen.setOptions({
      duration: 1000,
      fade: true,
    });
    void SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Checking authentication...
        </Text>
      </View>
    );
  }

  const destination = isAuthenticated ? "/(app)/(tabs)" : "/(auth)/login";
  return <Redirect href={destination} />;
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
});
