import { FeedContainer } from "@/src/components/feed/FeedContainer";
import { useFeedController } from "@/src/components/feed/use-feed-controller";
import {
  useGetSinglePost,
} from "@/src/features/post/post.hooks";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  ViewabilityConfig,
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
  const controller = useFeedController({
    postIds,
    viewabilityConfig: VIEWABILITY_CONFIG,
  });

  useEffect(() => {
    if (commentOpen === "true" && postId) {
      setTimeout(() => controller.commentsSheet.openComments(Number(postId)), 100);
    }
  }, [commentOpen, postId, controller.commentsSheet]);

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
      <FeedContainer
        controller={controller}
        postIds={postIds}
        onRefresh={async () => undefined}
        isRefreshing={false}
        onEndReached={handleEndReached}
        isFetchingNextPage={isFetchingNextPage}
        flatListProps={{
          ListFooterComponent: ListFooter,
          removeClippedSubviews: true,
          windowSize: 5,
          maxToRenderPerBatch: 3,
          initialNumToRender: 3,
          updateCellsBatchingPeriod: 100,
        }}
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
