// Android home feed: viewability picks a single primary post; FlatList tuned for smooth scroll.
import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper";
import Stories from "@/src/components/home/story";
import {
  useGetFeedQuery,
  useTrackPostView,
} from "@/src/features/post/post.hooks";
import { useUnreadMessengerCount } from "@/src/features/profile/notification.hooks";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import { useUnreadMessengerBadgeRealtime } from "@/src/lib/pusher";
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

/** One primary visible item; slightly higher minimumViewTime reduces play/pause churn while scrolling. */
const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 55,
  minimumViewTime: 160,
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

  // ✅ FIX: Use refs for values that change on every scroll so renderItem
  // doesn't need them in its dependency array.  PostWrapper reads these
  // via props that are compared in its custom memo — but the renderItem
  // function identity stays stable, preventing FlatList from re-rendering
  // every mounted cell on each scroll stop.
  const visiblePostIdRef = useRef<number | null>(null);
  const visibleFeedIndexRef = useRef<number>(-1);
  const isScreenFocusedRef = useRef(true);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollOffsetRef.current = offsetY;
      const delta = offsetY - lastScrollY.current;
      lastScrollY.current = offsetY;

      if (offsetY <= 0) {
        currentHeaderTranslate.current = 0;
        headerTranslateY.setValue(0);
      } else if (delta > 0) {
        currentHeaderTranslate.current = Math.max(
          -HEADER_HEIGHT,
          currentHeaderTranslate.current - delta,
        );
        headerTranslateY.setValue(currentHeaderTranslate.current);
      } else if (delta < 0) {
        currentHeaderTranslate.current = 0;
        headerTranslateY.setValue(0);
      }
    },
    [headerTranslateY],
  );

  const trackPostView = useTrackPostView();
  const trackPostViewRef = useRef(trackPostView);
  trackPostViewRef.current = trackPostView;

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

  const postIds = useMemo(
    () => data?.pages.flatMap((page) => page.data.posts) ?? [],
    [data?.pages],
  );

  const visibleFeedIndex = useMemo(() => {
    if (visiblePostId == null) return -1;
    return postIds.indexOf(visiblePostId);
  }, [visiblePostId, postIds]);

  // Keep refs in sync
  visiblePostIdRef.current = visiblePostId;
  visibleFeedIndexRef.current = visibleFeedIndex;
  isScreenFocusedRef.current = isScreenFocused;

  const { refetch: storyRefetch } = useGetAllStories();

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
        videoManager.pauseAll();
      };
    }, []),
  );

  // ✅ FIX: memoize handleRefresh so the tabPress effect doesn't re-subscribe every render
  const handleRefresh = useCallback(async () => {
    await Promise.all([refetch(), storyRefetch()]);
  }, [refetch, storyRefetch]);

  useUnreadMessengerBadgeRealtime();
  const unreadMessageCount = useUnreadMessengerCount();

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

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      // console.log("viewableItems", viewableItems);
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
          // if (__DEV__) {
          //   console.log(
          //     `[Feed/Android] Primary post: ${prevId} → ${newVisibleId}`,
          //   );
          // }
          trackPostViewRef.current.mutate(newVisibleId);
        }
        return newVisibleId;
      });
    },
    [],
  );

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: VIEWABILITY_CONFIG,
      onViewableItemsChanged,
    },
  ]);

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

  // ✅ FIX: renderItem only depends on stable references.
  // visiblePostId / visibleFeedIndex / isScreenFocused are passed as props
  // to PostItem, but we read them from state (not refs) via extraData trigger.
  // The key insight: renderItem identity must stay stable so FlatList doesn't
  // re-render ALL cells.  PostWrapper's memo comparator handles the fine-grained
  // checks for which individual cells actually need re-rendering.
  const renderItem = useCallback(
    ({ item: id, index: feedIndex }: { item: number; index: number }) => {
      const nextId = getNextPostId(id);

      return (
        <PostItem
          id={id}
          feedIndex={feedIndex}
          visibleFeedIndex={visibleFeedIndexRef.current}
          nextId={nextId}
          visiblePostId={visiblePostIdRef.current}
          isScreenFocused={isScreenFocusedRef.current}
          openComments={openComments}
        />
      );
    },
    [openComments, getNextPostId],
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
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        // ✅ removeClippedSubviews intentionally omitted — on Android it causes
        // blank cells and black flashes with SurfaceView-backed VideoViews.
        windowSize={5}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
        updateCellsBatchingPeriod={100}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        // extraData triggers re-render of visible cells when visibility changes
        extraData={`${visiblePostId}-${visibleFeedIndex}-${isScreenFocused}`}
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
