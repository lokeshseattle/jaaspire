// app/(tabs)/index.tsx
import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper";
import Stories from "@/src/components/home/story";
import {
  useGetFeedQuery,
  useTrackPostView,
} from "@/src/features/post/post.hooks";
import { useUnreadMessengerCount } from "@/src/features/profile/notification.hooks";
import { useUnreadMessengerBadgeRealtime } from "@/src/lib/pusher";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import { videoManager } from "@/src/lib/video-manager";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    FlatList,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewabilityConfig,
    ViewToken,
} from "react-native";

const HEADER_HEIGHT = 56;

// Define viewability config outside component to prevent recreation
const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 100,
};

export default function Home() {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const scrollOffsetRef = useRef(0);
  const lastScrollY = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const currentHeaderTranslate = useRef(0);
  const navigation = useNavigation();

  // Hide header on scroll down (match speed), show instantly on scroll up
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offsetY;
      const delta = offsetY - lastScrollY.current;
      lastScrollY.current = offsetY;

      if (offsetY <= 0) {
        // At top: always show header
        currentHeaderTranslate.current = 0;
        headerTranslateY.setValue(0);
      } else if (delta > 0) {
        // Scrolling down: move header up by delta, clamp to -HEADER_HEIGHT
        currentHeaderTranslate.current = Math.max(
          -HEADER_HEIGHT,
          currentHeaderTranslate.current - delta,
        );
        headerTranslateY.setValue(currentHeaderTranslate.current);
      } else if (delta < 0) {
        // Scrolling up: show header instantly
        currentHeaderTranslate.current = 0;
        headerTranslateY.setValue(0);
      }
    },
    [headerTranslateY],
  );

  const trackPostView = useTrackPostView();

  // Comments hook
  const { bottomSheetRef, selectedPostId, openComments, onDismiss } =
    useCommentsSheet();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    isRefetching,
  } = useGetFeedQuery();

  // Flatten all post IDs from paginated data
  const postIds = useMemo(
    () => data?.pages.flatMap((page) => page.data.posts) ?? [],
    [data?.pages],
  );

  const { refetch: storyRefetch } = useGetAllStories();

  // Track screen focus for pausing videos when navigating away
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
        // Pause all videos when screen loses focus
        videoManager.pauseAll();
      };
    }, []),
  );

  const handleRefresh = async () => {
    await Promise.all([refetch(), storyRefetch()]);
  };

  // Wire unread messenger badge to counts API + realtime Pusher events.
  useUnreadMessengerBadgeRealtime();
  const unreadMessageCount = useUnreadMessengerCount();

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as any, () => {
      if (navigation.isFocused()) {
        if (scrollOffsetRef.current <= 10) {
          // Already at top - refresh feed
          handleRefresh();
        } else {
          // Scroll to top
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }
      }
    });

    return unsubscribe;
  }, [navigation, handleRefresh]);

  // Stable callback using useCallback + ref pattern for viewability
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) {
        setVisiblePostId(null);
        return;
      }

      let mostVisibleItem = viewableItems[0];

      for (const item of viewableItems) {
        if (item.isViewable) {
          mostVisibleItem = item;
          break;
        }
      }

      const newVisibleId = mostVisibleItem.item as number;

      setVisiblePostId((prevId) => {
        if (prevId !== newVisibleId) {
          console.log(`👁️ Visible post changed: ${prevId} → ${newVisibleId}`);
          trackPostView.mutate(newVisibleId);
        }
        return newVisibleId;
      });
    },
    [],
  );

  // Use viewabilityConfigCallbackPairs for stable behavior
  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: VIEWABILITY_CONFIG,
      onViewableItemsChanged,
    },
  ]);

  // Helper to get next post ID for preloading
  const getNextPostId = useCallback(
    (currentId: number): number | undefined => {
      const currentIndex = postIds.indexOf(currentId);
      if (currentIndex === -1 || currentIndex >= postIds.length - 1) {
        return undefined;
      }
      return postIds[currentIndex + 1];
    },
    [postIds],
  );

  // Render item with nextId for preloading
  const renderItem = useCallback(
    ({ item: id }: { item: number }) => {
      const nextId = getNextPostId(id);

      return (
        <PostItem
          id={id}
          nextId={nextId}
          visiblePostId={visiblePostId}
          isScreenFocused={isScreenFocused}
          openComments={openComments}
        />
      );
    },
    [visiblePostId, isScreenFocused, openComments, getNextPostId],
  );

  const keyExtractor = useCallback((item: number) => item.toString(), []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const ListFooter = useMemo(
    () =>
      isFetchingNextPage ? (
        <ActivityIndicator
          style={styles.loader}
          color={theme.colors.textSecondary}
        />
      ) : null,
    [isFetchingNextPage, styles.loader, theme.colors.textSecondary],
  );

  const ListHeader = useMemo(() => <Stories />, []);

  const HeaderRight = useMemo(
    () => (
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
    ),
    [theme.colors.icon, unreadMessageCount],
  );

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.header,
          {
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Jaaspire</Text>
        {HeaderRight}
      </Animated.View>
      <FlatList
        ref={flatListRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.listContent}
        data={postIds}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        // Pagination
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        // Pull to refresh
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        // Performance optimizations
        removeClippedSubviews={true}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        updateCellsBatchingPeriod={50}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        extraData={visiblePostId}
      />

      <CommentsBottomSheet
        bottomSheetRef={bottomSheetRef}
        postId={selectedPostId}
        onDismiss={onDismiss}
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
    header: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: HEADER_HEIGHT,
      zIndex: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerSpacer: {
      width: 24,
      height: 24,
    },
    listContent: {
      paddingTop: HEADER_HEIGHT,
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
    loader: {
      padding: theme.spacing.xl,
    },
  });
