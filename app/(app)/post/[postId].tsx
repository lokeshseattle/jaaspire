// app/(app)/explore/[postId].tsx

import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper.old";
import {
  useGetSinglePost,
  useTrackPostView,
} from "@/src/features/post/post.hooks";
import { videoManager } from "@/src/lib/video-manager.old";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  ViewabilityConfig,
  ViewToken,
} from "react-native";

// Define viewability config outside component to prevent recreation
const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50, // Instagram-style: 50% visible triggers
  minimumViewTime: 100, // Reduced from 250ms for faster response
};

const PostScreen = () => {
  const { postId } = useLocalSearchParams<{
    postId: string;
  }>();
  // const isCommentOpen = commentOpen === "true";
  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const trackPostView = useTrackPostView();

  // Comments hook
  const { bottomSheetRef, selectedPostId, openComments, onDismiss } =
    useCommentsSheet();

  const {
    data,
    isLoading,
    isSuccess,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useGetSinglePost(postId);

  const mainPostId = data?.mainPostId;

  // Flatten all recommended post IDs from paginated data
  const recommendedPostIds = useMemo(
    () => data?.recommendedIds ?? [],
    [data?.recommendedIds],
  );

  // Track screen focus for pausing videos when navigating away
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      // Set main post as visible on initial mount
      if (mainPostId && visiblePostId === null) {
        setVisiblePostId(mainPostId);
      }
      return () => {
        setIsScreenFocused(false);
        // Pause all videos when screen loses focus
        videoManager.pauseAll();
      };
    }, [mainPostId]),
  );

  // useLayoutEffect(() => {
  //     navigation.setOptions({
  //         // headerTransparent: true,
  //         headerTitle: "Go",
  //         headerLeft: () => (
  //             <Pressable onPress={router.back}>
  //                 <Ionicons name="close" size={24} color="white" />
  //             </Pressable>
  //         ),
  //     })
  // }, [navigation])

  // Stable callback using useCallback + ref pattern for viewability
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) {
        // When no FlatList items visible, main post (header) is likely visible
        if (mainPostId) {
          setVisiblePostId(mainPostId);
        }
        return;
      }

      // Find the most visible item (highest visibility percentage)
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
    [mainPostId],
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
      // If current is main post, next is first recommended
      if (currentId === mainPostId) {
        return recommendedPostIds[0];
      }

      // Otherwise find in recommended list
      const currentIndex = recommendedPostIds.indexOf(currentId);
      if (
        currentIndex === -1 ||
        currentIndex >= recommendedPostIds.length - 1
      ) {
        return undefined;
      }
      return recommendedPostIds[currentIndex + 1];
    },
    [mainPostId, recommendedPostIds],
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
      isFetchingNextPage ? <ActivityIndicator style={styles.loader} /> : null,
    [isFetchingNextPage],
  );

  // Main post as header - with preloading for first recommended
  const ListHeader = useMemo(() => {
    if (!mainPostId) return null;

    const nextId = recommendedPostIds[0];

    return (
      <PostItem
        id={mainPostId}
        nextId={nextId}
        visiblePostId={visiblePostId}
        isScreenFocused={isScreenFocused}
        openComments={openComments}
      />
    );
  }, [
    mainPostId,
    recommendedPostIds,
    visiblePostId,
    isScreenFocused,
    openComments,
  ]);

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Error state
  if (!isSuccess || !mainPostId) {
    return (
      <View style={styles.centerContainer}>
        <Text>Error loading post</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={recommendedPostIds}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        // Use callback pairs instead of separate props (more stable)
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        // Pagination
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        // Performance optimizations
        // removeClippedSubviews={true}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        updateCellsBatchingPeriod={50}
        // Prevent content jumping when items load
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        // Optimize re-renders
        extraData={visiblePostId}
      />

      <CommentsBottomSheet
        bottomSheetRef={bottomSheetRef}
        postId={selectedPostId}
        onDismiss={onDismiss}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loader: {
    padding: 20,
  },
});

export default PostScreen;
