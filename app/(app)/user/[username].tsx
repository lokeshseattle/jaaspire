// app/(app)/user/[username].tsx
import { ProfileFeedView } from "@/src/components/profile/ProfileFeedView";
import { ProfileGridView } from "@/src/components/profile/ProfileGridView";
import { ProfilePostsLockedPlaceholder } from "@/src/components/profile/ProfilePostsLockedPlaceholder";
import UserProfileHeader from "@/src/components/profile/UserProfileHeader";
import { AnimatedTabBar } from "@/src/components/ui/animated-tabbar";
import { useGetUserFeedQuery } from "@/src/features/post/post.hooks";
import {
  useBlockUserMutation,
  useGetProfile,
  useGetProfileByUsername,
  useUnblockUserMutation,
} from "@/src/features/profile/profile.hooks";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { canViewerSeeAnotherUsersPosts } from "@/src/utils/profile-visibility";
import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import * as Linking from "expo-linking";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

export type TabKey = "gallery" | "home_feed" | "premium" | "video";

export type TabConfig = {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
};

const tabs: Record<TabKey, TabConfig> = {
  gallery: {
    icon: "grid-outline",
    activeIcon: "grid",
  },
  home_feed: {
    icon: "layers-outline",
    activeIcon: "layers",
  },
  premium: {
    icon: "heart-circle-outline",
    activeIcon: "heart",
  },
  video: {
    icon: "play-circle-outline",
    activeIcon: "play",
  },
};

export default function UserProfileScreen() {
  const navigation = useNavigation();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerHeight = useHeaderHeight();
  const { data: me } = useGetProfile();

  console.log(981792891);
  const {
    data: profileByUsername,
    isLoading: profileByUsernameLoading,
    refetch: refetchProfile,
  } = useGetProfileByUsername(username ?? "");
  const blockMutation = useBlockUserMutation();
  const unblockMutation = useUnblockUserMutation();

  const isBlockedByUser =
    profileByUsername?.data?.blocked_status === "blocked_by_user";
  const isBlockedByYou =
    profileByUsername?.data?.blocked_status === "blocked_by_you";

  const [activeTab, setActiveTab] = useState<TabKey>("gallery");
  const [menuVisible, setMenuVisible] = useState(false);

  const isOwnProfile = useMemo(() => {
    const u = me?.data?.username;
    if (!u || username == null) return false;
    return u.toLowerCase() === String(username).toLowerCase();
  }, [me?.data?.username, username]);

  const profileData = profileByUsername?.data;

  const canViewPosts = useMemo(() => {
    if (!username) return false;
    if (profileData?.blocked_status === "blocked_by_you") return false;
    if (isOwnProfile) return true;
    if (!profileData?.viewer) return false;
    return canViewerSeeAnotherUsersPosts({
      profile: profileData,
      viewer: profileData.viewer,
    });
  }, [username, isOwnProfile, profileData]);

  const feedEnabled =
    !!username && (isOwnProfile || canViewPosts) && !isBlockedByYou;

  const postsListEmpty = useMemo(() => {
    if (isOwnProfile) return null;
    if (profileByUsernameLoading && !profileData) {
      return <ProfilePostsLockedPlaceholder loading />;
    }
    if (profileData && !canViewPosts) {
      return (
        <ProfilePostsLockedPlaceholder
          username={String(username)}
          followStatus={profileData.viewer.follow_status}
        />
      );
    }
    return null;
  }, [
    isOwnProfile,
    profileByUsernameLoading,
    profileData,
    canViewPosts,
    username,
  ]);

  const closeMenu = useCallback(() => setMenuVisible(false), []);
  const openMenu = useCallback(() => setMenuVisible(true), []);

  const handleShare = useCallback(async () => {
    closeMenu();
    try {
      const path = `/user/${username}`;
      const url = Linking.createURL(path);
      const message = `Check out @${username} on Jaaspire`;
      await Share.share(
        Platform.OS === "android"
          ? { message: `${message}\n${url}` }
          : { message, url },
      );
    } catch {
      /* dismissed */
    }
  }, [username, closeMenu]);

  const handleBlock = useCallback(() => {
    if (username == null) return;
    closeMenu();
    Alert.alert(
      "Block user",
      `Block @${username}? You won't see their posts or profile.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            blockMutation.mutate(username, {
              onSuccess: () => {
                Alert.alert(
                  "Blocked",
                  "You won't see this user's posts or profile.",
                  [{ text: "OK", onPress: () => router.back() }],
                );
              },
              onError: () => {
                Alert.alert(
                  "Couldn't block",
                  "Something went wrong. Try again.",
                );
              },
            });
          },
        },
      ],
    );
  }, [username, closeMenu, blockMutation]);

  const handleUnblock = useCallback(() => {
    if (username == null) return;
    closeMenu();
    Alert.alert("Unblock user", `Unblock @${username}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: () => {
          unblockMutation.mutate(username, {
            onSuccess: () => {
              Alert.alert("Unblocked", "You can see their profile again.");
            },
            onError: () => {
              Alert.alert(
                "Couldn't unblock",
                "Something went wrong. Try again.",
              );
            },
          });
        },
      },
    ]);
  }, [username, closeMenu, unblockMutation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: username,
      headerRight: isOwnProfile
        ? undefined
        : () => (
            <Pressable onPress={openMenu} style={styles.headerRightButton}>
              <Ionicons
                name="ellipsis-vertical"
                size={20}
                color={theme.colors.textPrimary}
              />
            </Pressable>
          ),
    });
  }, [
    username,
    navigation,
    isOwnProfile,
    openMenu,
    theme.colors.textPrimary,
    styles.headerRightButton,
  ]);

  console.log({ activeTab }, 981792891);

  const mode = useMemo(() => {
    switch (activeTab) {
      case "video":
        return "video";
      case "premium":
        return "exclusive";
      default:
        return "";
    }
  }, [activeTab]);

  const {
    data: feedData,
    refetch: refetchFeed,
    isRefetching: isRefetchingFeed,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGetUserFeedQuery(username, mode, {
    enabled: feedEnabled,
  });

  // Get post IDs from query
  const postIds = useMemo(() => {
    if (!feedData?.pages) return [];
    return feedData.pages.flatMap((page) => page.data.posts);
  }, [feedData?.pages]);

  // Refetch profile when screen gains focus (e.g. after B accepts request, or returning from elsewhere)
  useFocusEffect(
    useCallback(() => {
      if (username && !isOwnProfile) refetchProfile();
    }, [username, isOwnProfile, refetchProfile]),
  );

  // Handle refresh: profile must be refetched first—canViewPosts and feedEnabled depend on it
  const handleRefresh = useCallback(async () => {
    const { data: freshProfile } = await refetchProfile();
    const profile = freshProfile?.data;
    const shouldFetchFeed =
      isOwnProfile ||
      (profile?.viewer &&
        canViewerSeeAnotherUsersPosts({
          profile,
          viewer: profile.viewer,
        }));
    if (shouldFetchFeed) await refetchFeed();
  }, [refetchProfile, refetchFeed, isOwnProfile]);

  // Handle pagination
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle tab change with video cleanup
  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
  };

  // Shared header component for both views
  const ListHeader = useMemo(
    () => (
      <>
        <UserProfileHeader username={username} />
        <View style={styles.tabContainer}>
          <AnimatedTabBar
            tabs={tabs}
            activeKey={activeTab}
            onTabChange={handleTabChange}
          />
        </View>
      </>
    ),
    [username, activeTab, handleTabChange, styles.tabContainer],
  );

  // Render content based on active tab
  const renderContent = () => {
    if (isBlockedByYou) {
      return (
        <ScrollView
          style={styles.blockedProfileScroll}
          contentContainerStyle={styles.blockedProfileScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <UserProfileHeader username={String(username)} />
        </ScrollView>
      );
    }

    switch (activeTab) {
      case "gallery":
      case "video":
      case "premium":
        return (
          <ProfileGridView
            postIds={postIds}
            ListHeaderComponent={ListHeader}
            onRefresh={handleRefresh}
            isRefreshing={isRefetchingFeed}
            onEndReached={handleEndReached}
            isFetchingNextPage={isFetchingNextPage}
            postRouteUsername={username ?? undefined}
            ListEmptyComponent={postsListEmpty}
          />
        );

      case "home_feed":
        return (
          <ProfileFeedView
            postIds={postIds}
            ListHeaderComponent={ListHeader}
            onRefresh={handleRefresh}
            isRefreshing={isRefetchingFeed}
            onEndReached={handleEndReached}
            isFetchingNextPage={isFetchingNextPage}
            isTabActive={activeTab === "home_feed"}
            ListEmptyComponent={postsListEmpty}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderContent()}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <View />
        </Pressable>
        <View
          style={[styles.menuPanel, { top: headerHeight + 6 }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={({ pressed }) => [
              styles.menuRow,
              pressed && styles.menuRowPressed,
            ]}
            onPress={handleShare}
          >
            <Ionicons
              name="share-outline"
              size={22}
              color={theme.colors.textPrimary}
            />
            <Text style={styles.menuRowLabel}>Share</Text>
          </Pressable>
          <View style={styles.menuDivider} />
          {isBlockedByUser || isBlockedByYou ? (
            <Pressable
              style={({ pressed }) => [
                styles.menuRow,
                pressed && styles.menuRowPressed,
              ]}
              onPress={handleUnblock}
              disabled={unblockMutation.isPending}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={22}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.menuRowLabel}>Unblock</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.menuRow,
                pressed && styles.menuRowPressed,
              ]}
              onPress={handleBlock}
              disabled={blockMutation.isPending}
            >
              <Ionicons name="ban-outline" size={22} color="#EF4444" />
              <Text
                style={[styles.menuRowLabel, styles.menuRowLabelDestructive]}
              >
                Block
              </Text>
            </Pressable>
          )}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    blockedProfileScroll: {
      flex: 1,
    },
    blockedProfileScrollContent: {
      flexGrow: 1,
      paddingBottom: theme.spacing.xl,
    },
    headerRightButton: {
      width: 36,
      height: 36,
      justifyContent: "center",
      alignItems: "center",
      marginRight: -8,
    },
    tabContainer: {
      marginTop: theme.spacing.lg,
    },
    menuOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    menuPanel: {
      position: "absolute",
      zIndex: 1,
      right: theme.spacing.md,
      minWidth: 200,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      paddingVertical: theme.spacing.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    menuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    menuRowPressed: {
      opacity: 0.65,
    },
    menuRowLabel: {
      fontSize: 16,
      color: theme.colors.textPrimary,
    },
    menuRowLabelDestructive: {
      color: "#EF4444",
    },
    menuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginHorizontal: theme.spacing.sm,
    },
  });
