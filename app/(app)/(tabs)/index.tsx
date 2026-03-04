// app/(tabs)/index.tsx
import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper";
import Stories from "@/src/components/home/story";
import { useGetFeedQuery } from "@/src/features/post/post.hooks";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import { videoManager } from "@/src/lib/video-manager";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  View,
  ViewabilityConfig,
  ViewToken,
} from "react-native";

// Define viewability config outside component to prevent recreation
const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50, // Instagram-style: 50% visible triggers
  minimumViewTime: 100, // Reduced from 250ms for faster response
};

export default function Home() {
  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

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

  // Stable callback using useCallback + ref pattern for viewability
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) {
        setVisiblePostId(null);
        return;
      }

      // Find the most visible item (highest visibility percentage)
      // viewableItems are already sorted by index, but we want most visible
      let mostVisibleItem = viewableItems[0];

      // If multiple items are viewable, prefer the one closest to center
      // For simplicity, we take the first one that's at least 50% visible
      // (they all meet threshold, so first one is typically most centered)
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
        }
        return newVisibleId;
      });
    },
    []
  );

  // Use viewabilityConfigCallbackPairs for stable behavior
  // This prevents the "changing onViewableItemsChanged on the fly" warning
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
    () => (isFetchingNextPage ? <ActivityIndicator style={{ padding: 20 }} /> : null),
    [isFetchingNextPage]
  );

  const ListHeader = useMemo(() => <Stories />, []);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={postIds}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        // Use callback pairs instead of separate props (more stable)
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        // Pagination
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        // Pull to refresh
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        // Performance optimizations
        removeClippedSubviews={true} // Unmount off-screen views (Android)
        windowSize={5} // Render 5 screens worth of content (2 above, 2 below, 1 visible)
        maxToRenderPerBatch={3} // Render 3 items per batch
        initialNumToRender={3} // Initial render count
        updateCellsBatchingPeriod={50} // Batch updates every 50ms
        // Prevent content jumping when items load
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        // Optimize re-renders
        extraData={visiblePostId} // Re-render when visible post changes
      />

      <CommentsBottomSheet
        bottomSheetRef={bottomSheetRef}
        postId={selectedPostId}
        onDismiss={onDismiss}
      />
    </View>
  );
}