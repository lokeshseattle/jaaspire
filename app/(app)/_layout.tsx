import { useAuth } from "@/src/features/auth/auth.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import {
  initializePusher,
  subscribeUserChannel,
  useNotificationRealtime,
} from "@/src/lib/pusher";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

function UserPostDetailHeaderTitle({ username }: { username?: string }) {
  const { theme } = useTheme();
  const handle = username?.replace(/^@/, "") ?? "";

  return (
    <View style={styles.userPostHeaderTitle}>
      <Text
        style={[
          styles.userPostHeaderPrimary,
          { color: theme.colors.textPrimary },
        ]}
      >
        Posts
      </Text>
      {handle ? (
        <Text
          style={[
            styles.userPostHeaderSecondary,
            { color: theme.colors.textSecondary },
          ]}
          numberOfLines={1}
        >
          @{handle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  userPostHeaderTitle: {
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 200,
  },
  userPostHeaderPrimary: {
    fontSize: 17,
    fontWeight: "600",
  },
  userPostHeaderSecondary: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: 2,
  },
});

export default function AppLayout() {
  const { theme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const { data: profileData } = useGetProfile();

  useNotificationRealtime();

  useEffect(() => {
    const userId = profileData?.data?.id;
    if (userId == null) return;

    let cancelled = false;

    (async () => {
      try {
        await initializePusher();
        if (cancelled) return;
        await subscribeUserChannel(String(userId));
      } catch {
        /* errors already logged in pusher module */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileData?.data?.id]);

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

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
        name="settings"
        options={{
          headerShown: true,
          headerTitle: "Settings",
          headerBackButtonDisplayMode: "minimal",
        }}
      />

      <Stack.Screen
        name="messages"
        options={{
          headerShown: true,
          title: "Messages",
          presentation: "card",
          headerBackButtonDisplayMode: "minimal",
        }}
      />

      <Stack.Screen
        name="chat/[senderId]"
        options={{
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
          title: "Chat",
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
        name="user/[username]/posts/[postId]"
        options={({ route }) => {
          const params = route.params as { username?: string | string[] };
          const raw = params?.username;
          const username =
            typeof raw === "string"
              ? raw
              : Array.isArray(raw)
                ? raw[0]
                : undefined;

          return {
            headerShown: true,
            headerTitleAlign: "center",
            headerTitle: () => (
              <UserPostDetailHeaderTitle username={username} />
            ),
            headerBackButtonDisplayMode: "minimal",
            animation: "fade_from_bottom",
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

      <Stack.Screen
        name="global-search"
        options={{
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />

      <Stack.Screen
        name="followers-following"
        options={{
          headerShown: true,
          headerBackButtonDisplayMode: "minimal",
        }}
      />

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

      <Stack.Screen
        name="post-image-editor"
        options={{
          headerShown: false,
          headerTitle: "Image",
          headerBackButtonDisplayMode: "minimal",
          presentation: "fullScreenModal",
        }}
      />

      <Stack.Screen
        name="post-video-thumbnail"
        options={{
          headerShown: false,
          headerTitle: "Thumbnail",
          headerBackButtonDisplayMode: "minimal",
          presentation: "fullScreenModal",
        }}
      />

      <Stack.Screen
        name="blocked-users"
        options={{
          headerShown: true,
          headerTitle: "Blocked Users",
          headerBackButtonDisplayMode: "minimal",
        }}
      />

      <Stack.Screen
        name="privacy-settings"
        options={{
          headerShown: true,
          headerTitle: "Privacy",
          headerBackButtonDisplayMode: "minimal",
        }}
      />
    </Stack>
  );
}
