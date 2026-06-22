// Android home feed: viewability picks a single primary post; FlatList tuned for smooth scroll.
import { FeedContainer } from "@/src/components/feed/FeedContainer";
import { useFeedController } from "@/src/components/feed/use-feed-controller";
import JaasiAiFloatingAvatar from "@/src/components/home/JaasiAiFloatingAvatar";
import Stories from "@/src/components/home/story";
import { flickPreloadTarget } from "@/src/features/flicks/flicks-feed-video";
import { useNotificationBadgeStore } from "@/src/features/notifications/notification-badge.store";
import { useGetFeedQuery } from "@/src/features/post/post.hooks";
import { usePostStore } from "@/src/features/post/post.store";
import { useUnreadMessengerCount } from "@/src/features/profile/notification.hooks";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import { useUnreadMessengerBadgeRealtime } from "@/src/lib/pusher";
import { applyHomeTabFocusVolume } from "@/src/lib/system-volume-unmute-sync";
import { videoManager } from "@/src/lib/video-manager";
import {
  isVideoNetworkDebugEnabled,
  logVideoFeedWindow,
  setVideoNetworkDebugScreen,
} from "@/src/lib/video-network-debug";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewabilityConfig,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
const HEADER_HEIGHT = 44;
/** Matches PostItem preload radius — videos within ±1 of primary post mount a player. */
const HOME_VIDEO_PRELOAD_RADIUS = 1;

/** One primary visible item; slightly higher minimumViewTime reduces play/pause churn while scrolling. */
const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 55,
  minimumViewTime: 160,
};

export default function Home() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const flatListRef = useRef<FlatList<number>>(null);
  const scrollOffsetRef = useRef(0);
  const lastScrollY = useRef(0);

  const headerTranslateY = useSharedValue(0);
  const currentHeaderTranslate = useRef(0);
  const navigation = useNavigation();

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offsetY;
      const delta = offsetY - lastScrollY.current;
      lastScrollY.current = offsetY;

      if (offsetY <= 0) {
        currentHeaderTranslate.current = 0;
        headerTranslateY.value = 0;
      } else if (delta > 0) {
        currentHeaderTranslate.current = Math.max(
          -HEADER_HEIGHT,
          currentHeaderTranslate.current - delta,
        );
        headerTranslateY.value = currentHeaderTranslate.current;
      } else if (delta < 0) {
        currentHeaderTranslate.current = 0;
        headerTranslateY.value = 0;
      }
    },
    [headerTranslateY],
  );

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: headerTranslateY.value }],
    marginBottom: headerTranslateY.value,
  }));

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useGetFeedQuery();

  const postIds = useMemo(
    () => data?.pages.flatMap((page) => page.data.posts) ?? [],
    [data?.pages],
  );

  const controller = useFeedController({
    postIds,
    viewabilityConfig: VIEWABILITY_CONFIG,
    onScreenBlur: applyHomeTabFocusVolume,
  });

  const { refetch: storyRefetch } = useGetAllStories();

  useFocusEffect(
    useCallback(() => {
      setVideoNetworkDebugScreen("home");
      videoManager.setPinnedFeedPostId(null);
      applyHomeTabFocusVolume();
      return () => {
        const visibleId = controller.visiblePostIdRef.current;
        if (typeof visibleId === "number") {
          videoManager.setPinnedFeedPostId(visibleId);
          videoManager.pause(visibleId);
        }
      };
    }, [controller.visiblePostIdRef]),
  );

  useEffect(() => {
    if (!isVideoNetworkDebugEnabled()) return;

    const visibleIndex = controller.visibleFeedIndex;
    const visibleId = controller.visiblePostId;
    if (visibleIndex < 0 || postIds.length === 0) return;

    const postsMap = usePostStore.getState().posts;
    const videos: { postId: number; url: string; role: string }[] = [];
    for (
      let offset = -HOME_VIDEO_PRELOAD_RADIUS;
      offset <= HOME_VIDEO_PRELOAD_RADIUS;
      offset++
    ) {
      const idx = visibleIndex + offset;
      const id = postIds[idx];
      if (id == null) continue;
      const target = flickPreloadTarget(postsMap[id]);
      if (!target) continue;
      videos.push({
        postId: target.postId,
        url: target.url,
        role: offset === 0 ? "focused" : offset > 0 ? "next" : "prev",
      });
    }

    logVideoFeedWindow("home", {
      focusedPostId: visibleId,
      focusedIndex: visibleIndex,
      videos,
    });
  }, [controller.visibleFeedIndex, controller.visiblePostId, postIds]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), storyRefetch()]);
  }, [refetch, storyRefetch]);

  useUnreadMessengerBadgeRealtime();
  const unreadMessageCount = useUnreadMessengerCount();
  const notificationUnread = useNotificationBadgeStore((s) => s.unreadCount);

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as any, () => {
      if (navigation.isFocused()) {
        if (scrollOffsetRef.current <= 10) {
          handleRefresh();
        } else {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }
      }
    });

    return unsubscribe;
  }, [navigation, handleRefresh]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const ListHeader = useMemo(() => <Stories />, []);

  const HeaderRight = useMemo(
    () => (
      <View style={styles.headerRightRow}>
        <Pressable
          onPress={() => router.push("/notifications")}
          style={({ pressed }) => [
            styles.headerIconButton,
            pressed && styles.headerIconButtonPressed,
          ]}
          hitSlop={12}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={theme.colors.icon}
          />
          {notificationUnread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {notificationUnread > 99 ? "99+" : notificationUnread}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => router.push("/messages")}
          style={({ pressed }) => [
            styles.headerIconButton,
            pressed && styles.headerIconButtonPressed,
          ]}
          hitSlop={12}
        >
          <Ionicons
            name="chatbubble-outline"
            size={24}
            color={theme.colors.icon}
          />
          {unreadMessageCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {unreadMessageCount > 99 ? "99+" : unreadMessageCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    ),
    [theme.colors.icon, notificationUnread, unreadMessageCount],
  );

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, headerAnimatedStyle]}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Jaaspire</Text>
        {HeaderRight}
      </Animated.View>
      <FeedContainer
        controller={controller}
        flatListRef={flatListRef}
        postIds={postIds}
        ListHeaderComponent={ListHeader}
        onRefresh={handleRefresh}
        isRefreshing={isRefetching}
        onEndReached={handleEndReached}
        isFetchingNextPage={isFetchingNextPage}
        flatListProps={{
          onScroll: handleScroll,
          scrollEventThrottle: 32,
          maxToRenderPerBatch: 2,
          initialNumToRender: 2,
          updateCellsBatchingPeriod: 100,
        }}
      />
      <JaasiAiFloatingAvatar />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      overflow: "hidden",
      backgroundColor: theme.colors.background,
    },
    header: {
      height: HEADER_HEIGHT,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerSpacer: {
      width: 88,
      height: 24,
    },
    headerRightRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      letterSpacing: 0.3,
    },
    headerIconButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.pill,
    },
    headerIconButtonPressed: {
      backgroundColor: theme.colors.surface,
      opacity: 0.8,
    },
    badge: {
      position: "absolute",
      top: -2,
      right: -2,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: "#FFFFFF",
    },
  });
