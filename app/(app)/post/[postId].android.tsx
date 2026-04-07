import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper.android";
import {
    useGetSinglePost,
    useTrackPostView,
} from "@/src/features/post/post.hooks";
import { videoManager } from "@/src/lib/video-manager";
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

const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 160,
};

const PostScreen = () => {
  const { postId } = useLocalSearchParams<{ postId: string }>();

  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  const visiblePostIdRef = useRef<number | null>(null);
  const visibleFeedIndexRef = useRef<number>(-1);
  const isScreenFocusedRef = useRef(true);

  const trackPostView = useTrackPostView();
  const trackPostViewRef = useRef(trackPostView);
  trackPostViewRef.current = trackPostView;

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
  const recommendedPostIds = useMemo(
    () => data?.recommendedIds ?? [],
    [data?.recommendedIds],
  );

  const postIds = useMemo(() => {
    const list = [];
    if (mainPostId != null) list.push(mainPostId);
    list.push(...recommendedPostIds);
    return list;
  }, [mainPostId, recommendedPostIds]);

  const visibleFeedIndex = useMemo(() => {
    if (visiblePostId == null) return -1;
    return postIds.indexOf(visiblePostId);
  }, [visiblePostId, postIds]);

  visiblePostIdRef.current = visiblePostId;
  visibleFeedIndexRef.current = visibleFeedIndex;
  isScreenFocusedRef.current = isScreenFocused;

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      if (mainPostId && visiblePostId === null) {
        setVisiblePostId(mainPostId);
      }
      return () => {
        setIsScreenFocused(false);
        videoManager.pauseAll();
      };
    }, [mainPostId, visiblePostId]),
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) {
        if (mainPostId) {
          setVisiblePostId(mainPostId);
        }
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
          trackPostViewRef.current.mutate(newVisibleId);
        }
        return newVisibleId;
      });
    },
    [mainPostId],
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
      if (
        currentIndex === -1 ||
        currentIndex >= postIds.length - 1
      ) {
        return undefined;
      }
      return postIds[currentIndex + 1];
    },
    [postIds],
  );

  const renderItem = useCallback(
    ({ item: id }: { item: number }) => {
      const nextId = getNextPostId(id);
      const feedIndex = postIds.indexOf(id);

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
    [openComments, getNextPostId, postIds],
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

  const ListHeader = useMemo(() => {
    if (!mainPostId) return null;

    const nextId = recommendedPostIds[0];
    const feedIndex = postIds.indexOf(mainPostId);

    return (
      <PostItem
        id={mainPostId}
        feedIndex={feedIndex}
        visibleFeedIndex={visibleFeedIndex}
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
    visibleFeedIndex,
    openComments,
    postIds,
  ]);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        windowSize={5}
        maxToRenderPerBatch={2}
        initialNumToRender={2}
        updateCellsBatchingPeriod={100}
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
