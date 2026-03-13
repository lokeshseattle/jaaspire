// app/(tabs)/index.tsx
import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper";
import Stories from "@/src/components/home/story";
import { useGetFeedQuery, useTrackPostView } from "@/src/features/post/post.hooks";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import { videoManager } from "@/src/lib/video-manager";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
  ViewabilityConfig,
  ViewToken,
} from "react-native";

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
  const navigation = useNavigation();

  // Track scroll position
  const handleScroll = useCallback((event: any) => {
    scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

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
    [data?.pages]
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
    }, [])
  );

  const handleRefresh = async () => {
    await Promise.all([refetch(), storyRefetch()]);
  };

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
    []
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
    [postIds]
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
    [visiblePostId, isScreenFocused, openComments, getNextPostId]
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
    [isFetchingNextPage, styles.loader, theme.colors.textSecondary]
  );

  const ListHeader = useMemo(() => <Stories />, []);

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
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
    loader: {
      padding: theme.spacing.xl,
    },
  });