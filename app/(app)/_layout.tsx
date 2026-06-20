import IapRecoveryBanner from "@/src/components/wallet/IapRecoveryBanner";
import { useAuth } from "@/src/features/auth/auth.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { IapProvider } from "@/src/features/wallet/IapProvider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { getHeaderTitle } from "@react-navigation/elements";
import type { NativeStackHeaderProps } from "@react-navigation/native-stack";
import {
  initializePusher,
  subscribeUserChannel,
  useNotificationRealtime,
} from "@/src/lib/pusher";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

/** Deep links into this stack keep “(tabs)” as the root so Back can return home. */
export const unstable_settings = {
  initialRouteName: "(tabs)",
};

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

function AndroidStackHeader({
  back,
  navigation,
  options,
  route,
  theme,
}: NativeStackHeaderProps & {
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const resolvedTitle = getHeaderTitle(options, route.name);
  const headerTitle =
    typeof options.headerTitle === "function"
      ? options.headerTitle({
          children: resolvedTitle,
          tintColor: theme.colors.textPrimary,
        })
      : (options.headerTitle ?? resolvedTitle);

  return (
    <View
      style={[
        styles.androidHeaderContainer,
        { backgroundColor: theme.colors.background },
      ]}
    >
      {back ? (
        <Pressable
          onPress={navigation.goBack}
          style={styles.androidBackButton}
          hitSlop={12}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={theme.colors.textPrimary}
          />
        </Pressable>
      ) : null}
      <View style={styles.androidHeaderTitleWrap}>
        {typeof headerTitle === "string" ? (
          <Text
            numberOfLines={1}
            style={[styles.androidHeaderTitle, { color: theme.colors.textPrimary }]}
          >
            {headerTitle}
          </Text>
        ) : (
          headerTitle
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  authLoadingRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
  androidHeaderContainer: {
    height: 76,
    paddingTop: 20,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
  },
  androidBackButton: {
    minWidth: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  androidHeaderTitleWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 44,
  },
  androidHeaderTitle: {
    fontSize: 17,
    fontWeight: "600",
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

  if (isLoading) {
    return (
      <View
        style={[
          styles.authLoadingRoot,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <IapProvider>
      <IapRecoveryBanner />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: {
            backgroundColor: theme.colors.background,
          },
          headerTintColor: theme.colors.textPrimary,
          ...(Platform.OS === "android"
            ? {
                header: (props: NativeStackHeaderProps) =>
                  props.options.headerShown === false ? null : (
                    <AndroidStackHeader {...props} theme={theme} />
                  ),
              }
            : {}),
          // headerShadowVisible: false,
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
            // headerShadowVisible: true,
          }}
        />

        <Stack.Screen
          name="manage-subscriptions"
          options={{
            headerShown: true,
            headerTitle: "Manage subscriptions",
            headerBackButtonDisplayMode: "minimal",
          }}
        />

        <Stack.Screen
          name="manage-payments"
          options={{
            headerShown: true,
            headerTitle: "Manage payments",
            headerBackButtonDisplayMode: "minimal",
          }}
        />

        <Stack.Screen
          name="help-support"
          options={{
            headerShown: true,
            headerTitle: "Help & Support",
            headerBackButtonDisplayMode: "minimal",
          }}
        />

        <Stack.Screen
          name="wallet"
          options={{
            headerShown: true,
            headerTitle: "Balance",
            headerBackButtonDisplayMode: "minimal",
          }}
        />

        {/* Dev: subscription IAP debug screen */}
        {/* <Stack.Screen
        name="iap-debug"
        options={{
          headerShown: true,
          headerTitle: "Subscription debug",
          headerBackButtonDisplayMode: "minimal",
        }}
      /> */}

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
          name="notifications"
          options={{
            headerShown: true,
            title: "Notifications",
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
            contentStyle: { backgroundColor: "#000000" },
            gestureEnabled: false,
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
          name="flick/[postId]"
          options={{
            headerShown: false,
            animation: "fade_from_bottom",
            contentStyle: { backgroundColor: "#000000" },
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
            contentStyle: { backgroundColor: "#0B0F14" },
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

        <Stack.Screen
          name="account-verification"
          options={{
            headerShown: true,
            headerTitle: "Account verification",
            headerBackButtonDisplayMode: "minimal",
          }}
        />

        <Stack.Screen
          name="delete-account"
          options={{
            headerShown: true,
            headerTitle: "Delete account",
            headerBackButtonDisplayMode: "minimal",
          }}
        />
      </Stack>
    </IapProvider>
  );
}
