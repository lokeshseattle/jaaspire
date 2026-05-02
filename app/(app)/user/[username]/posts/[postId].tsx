import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { useShareSheet } from "@/hooks/use-share-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper";
import { SharePostBottomSheet } from "@/src/components/share/SharePostBottomSheet";
import {
  useGetSinglePost,
  useTrackPostView,
} from "@/src/features/post/post.hooks";
import { videoManager } from "@/src/lib/video-manager";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const UserPostScreen = () => {
  const { postId, commentOpen } = useLocalSearchParams<{
    postId: string;
    username: string;
    commentOpen: "true" | "false";
  }>();

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
    bottomSheetRef: shareBottomSheetRef,
    selectedPostId: selectedSharePostId,
    openShare,
    onDismiss: onShareDismiss,
  } = useShareSheet();

  useEffect(() => {
    if (commentOpen === "true" && postId) {
      setTimeout(() => openComments(Number(postId)), 100);
    }
  }, [commentOpen, postId, openComments]);

  const {
    data,
    isLoading,
    isSuccess,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useGetSinglePost(postId, "user");

  const mainPostId = data?.mainPostId;
  const recommendedPostIds = useMemo(
    () => data?.recommendedIds ?? [],
    [data?.recommendedIds],
  );

  /** Single FlatList feed: anchor post at index 0, then recommendations (deduped). */
  const postIds = useMemo(() => {
    if (mainPostId == null) return [];
    const seen = new Set<number>([mainPostId]);
    const out: number[] = [mainPostId];
    for (const id of recommendedPostIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }, [mainPostId, recommendedPostIds]);

  const visibleFeedIndex = useMemo(() => {
    if (visiblePostId == null) return -1;
    return postIds.indexOf(visiblePostId);
  }, [visiblePostId, postIds]);

  visiblePostIdRef.current = visiblePostId;
  visibleFeedIndexRef.current = visibleFeedIndex;
  isScreenFocusedRef.current = isScreenFocused;

  useEffect(() => {
    setVisiblePostId(null);
  }, [postId]);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      setVisiblePostId((v) =>
        mainPostId != null && v == null ? mainPostId : v,
      );
      return () => {
        setIsScreenFocused(false);
        videoManager.pauseAll();
      };
    }, [mainPostId]),
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) {
        const fallback = postIds[0];
        if (fallback != null) setVisiblePostId(fallback);
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
          trackPostViewRef.current.mutate(newVisibleId);
        }
        return newVisibleId;
      });
    },
    [postIds],
  );

  const onViewableItemsChangedRef = useRef(onViewableItemsChanged);
  onViewableItemsChangedRef.current = onViewableItemsChanged;

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: VIEWABILITY_CONFIG,
      onViewableItemsChanged: (info: {
        viewableItems: ViewToken[];
        changed: ViewToken[];
      }) => onViewableItemsChangedRef.current(info),
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

  const renderItem = useCallback(
    ({ item: id, index }: { item: number; index: number }) => {
      const nextId = getNextPostId(id);
      return (
        <PostItem
          id={id}
          feedIndex={index}
          visibleFeedIndex={visibleFeedIndexRef.current}
          nextId={nextId}
          visiblePostId={visiblePostIdRef.current}
          isScreenFocused={isScreenFocusedRef.current}
          openComments={openComments}
          openShare={openShare}
        />
      );
    },
    [openComments, openShare, getNextPostId],
  );

  const keyExtractor = useCallback((item: number) => String(item), []);

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

  /**
   * Bundle visiblePostId + isScreenFocused into extraData so FlatList re-renders
   * cells when EITHER changes. Without isScreenFocused here, focus toggles
   * (post → flick → post) don't propagate to PostWrapper, leaving PostMedia's
   * `isFocused` prop stale: video can't auto-resume after pauseAll, and the
   * VideoView stays mounted causing surface conflicts (black frame).
   */
  const flatListExtraData = useMemo(
    () => ({ visiblePostId, isScreenFocused }),
    [visiblePostId, isScreenFocused],
  );

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
        data={postIds}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListFooterComponent={ListFooter}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        updateCellsBatchingPeriod={100}
        extraData={flatListExtraData}
      />

      <CommentsBottomSheet
        bottomSheetRef={bottomSheetRef}
        postId={selectedPostId}
        onDismiss={onDismiss}
      />
      <SharePostBottomSheet
        bottomSheetRef={shareBottomSheetRef}
        postId={selectedSharePostId}
        onDismiss={onShareDismiss}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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

export default UserPostScreen;
