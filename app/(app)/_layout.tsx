import { initializePusher } from "@/src/lib/pusher";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Stack } from "expo-router";
import { useEffect } from "react";

export default function AppLayout() {
  const { theme } = useTheme();

  useEffect(() => {
    initializePusher();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      <Stack.Screen
        name="messages"
        options={{
          headerShown: true,
          title: "Messages",
          presentation: "card",
        }}
      />

      <Stack.Screen
        name="story/[username]"
        options={{
          animation: "fade",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name="user/[username]"
        options={({ route }) => {
          const { username } = route.params as { username: string };
          return {
            headerShown: true,
            headerBackButtonDisplayMode: "minimal",
          };
        }}
      />

      <Stack.Screen
        name="story-editor"
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "fade",
        }}
      />

      <Stack.Screen
        name="video-editor"
        options={{
          headerShown: false,
          animation: "fade",
        }}
      />

      <Stack.Screen
        name="post/[postId]"
        options={{
          headerShown: true,
          headerTitle: "Explore",
          headerBackButtonDisplayMode: "minimal",
          animation: "fade_from_bottom",
        }}
      />

      <Stack.Screen name="followers_following" />

      <Stack.Screen
        name="bookmarks"
        options={{
          headerShown: true,
          headerTitle: "Bookmarks",
          headerBackButtonDisplayMode: "minimal",
        }}
      />

      <Stack.Screen
        name="pending-requests"
        options={{
          headerShown: true,
          headerTitle: "Pending Requests",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
    </Stack>
  );
}