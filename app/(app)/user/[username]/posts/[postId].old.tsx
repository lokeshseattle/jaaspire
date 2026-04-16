import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { useShareSheet } from "@/hooks/use-share-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import { SharePostBottomSheet } from "@/src/components/share/SharePostBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper.old";
import {
    useGetSinglePost,
    useTrackPostView,
} from "@/src/features/post/post.hooks";
import { videoManager } from "@/src/lib/video-manager.old";
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
  minimumViewTime: 100,
};

const UserPostScreen = () => {
  const { postId, commentOpen } = useLocalSearchParams<{
    postId: string;
    username: string;
    commentOpen: "true" | "false";
  }>();

  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const trackPostView = useTrackPostView();

  const { bottomSheetRef, selectedPostId, openComments, onDismiss } =
    useCommentsSheet();
  const {
    bottomSheetRef: shareBottomSheetRef,
    selectedPostId: selectedSharePostId,
    openShare,
    onDismiss: onShareDismiss,
  } = useShareSheet();

  // useFocusEffect(
  useEffect(() => {
    console.log("👁️ commentOpen: ", commentOpen);
    console.log("👁️ postId: ", postId);
    if (commentOpen === "true" && postId) {
      setTimeout(() => openComments(Number(postId)), 1000);
    }
  }, [commentOpen, postId, openComments]);
  // );

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
    }, [mainPostId]),
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
          trackPostView.mutate(newVisibleId);
        }
        return newVisibleId;
      });
    },
    [mainPostId, trackPostView],
  );

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: VIEWABILITY_CONFIG,
      onViewableItemsChanged,
    },
  ]);

  const getNextPostId = useCallback(
    (currentId: number): number | undefined => {
      if (currentId === mainPostId) {
        return recommendedPostIds[0];
      }

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
          openShare={openShare}
        />
      );
    },
    [visiblePostId, isScreenFocused, openComments, openShare, getNextPostId],
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

    return (
      <PostItem
        id={mainPostId}
        nextId={nextId}
        visiblePostId={visiblePostId}
        isScreenFocused={isScreenFocused}
        openComments={openComments}
        openShare={openShare}
      />
    );
  }, [
    mainPostId,
    recommendedPostIds,
    visiblePostId,
    isScreenFocused,
    openComments,
    openShare,
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
      <SharePostBottomSheet
        bottomSheetRef={shareBottomSheetRef}
        postId={selectedSharePostId}
        onDismiss={onShareDismiss}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
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
