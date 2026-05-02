// app/(tabs)/profile.tsx
import { useShareProfileSheet } from "@/hooks/use-share-profile-sheet";
import { ProfileFeedView } from "@/src/components/profile/ProfileFeedView";
import { ProfileGridView } from "@/src/components/profile/ProfileGridView";
import ProfileHeader from "@/src/components/profile/ProfileHeader";
import { ShareProfileBottomSheet } from "@/src/components/share/ShareProfileBottomSheet";
import { AnimatedTabBar } from "@/src/components/ui/animated-tabbar";
import { useGetUserFeedQuery } from "@/src/features/post/post.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import { useVideoFinalized } from "@/src/lib/pusher";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

export type TabKey = "gallery" | "home_feed" | "exclusive" | "video";

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
  exclusive: {
    icon: "heart-circle-outline",
    activeIcon: "heart",
  },
  video: {
    icon: "play-circle-outline",
    activeIcon: "play",
  },
};

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState<TabKey>("gallery");

  const {
    bottomSheetRef: shareProfileSheetRef,
    selectedUsername: selectedShareUsername,
    openShareProfile,
    onDismiss: onShareProfileDismiss,
  } = useShareProfileSheet();

  const {
    data: profileData,
    refetch: refetchProfile,
    isRefetching: isRefetchingProfile,
  } = useGetProfile();

  const username = profileData?.data.username;

  const handleShareProfile = useCallback(() => {
    if (username) openShareProfile(username);
  }, [username, openShareProfile]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: username || "Profile",
    });
  }, [username, navigation]);

  const {
    data: feedData,
    refetch: refetchFeed,
    isRefetching: isRefetchingFeed,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useGetUserFeedQuery(
    username,
    activeTab as "" | "video" | "exclusive" | undefined,
  );

  useVideoFinalized();

  // Get post IDs from query
  const postIds = useMemo(() => {
    if (!feedData?.pages) return [];
    return feedData.pages.flatMap((page) => page.data.posts);
  }, [feedData?.pages]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchProfile(), refetchFeed()]);
  }, [refetchProfile, refetchFeed]);

  // Handle pagination
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Handle tab change
  const handleTabChange = useCallback((key: string) => {
    setActiveTab(key as TabKey);
  }, []);

  // Shared header component for both views
  const ListHeader = useMemo(
    () => (
      <>
        {username && (
          <ProfileHeader
            username={username}
            isOwnProfile={true}
            onShareProfile={handleShareProfile}
          />
        )}
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
    switch (activeTab) {
      case "home_feed":
        return (
          <ProfileFeedView
            postIds={postIds}
            ListHeaderComponent={ListHeader}
            onRefresh={handleRefresh}
            isRefreshing={isRefetchingProfile || isRefetchingFeed}
            onEndReached={handleEndReached}
            isFetchingNextPage={isFetchingNextPage}
            isTabActive={activeTab === "home_feed"}
          />
        );

      case "exclusive":
      case "video":
      case "gallery":
        return (
          <ProfileGridView
            postIds={postIds} // Empty for now
            ListHeaderComponent={ListHeader}
            onRefresh={handleRefresh}
            isRefreshing={isRefetchingProfile || isRefetchingFeed}
            onEndReached={handleEndReached}
            isFetchingNextPage={isFetchingNextPage}
            postRouteUsername={username}
          />
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderContent()}
      <ShareProfileBottomSheet
        bottomSheetRef={shareProfileSheetRef}
        username={selectedShareUsername}
        onDismiss={onShareProfileDismiss}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    tabContainer: {
      marginTop: theme.spacing.lg,
    },
  });
