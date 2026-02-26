// app/(tabs)/index.tsx
import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import Post from "@/src/components/home/posts/post";
import Stories from "@/src/components/home/story";
import { useGetUserFeedQuery } from "@/src/features/post/post.hooks";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import type { Post as TPOST } from "@/src/services/api/api.types";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Home() {
  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  // Comments hook
  const { bottomSheetRef, selectedPostId, openComments, onDismiss } = useCommentsSheet();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isSuccess, refetch, isRefetching } =
    useGetUserFeedQuery("style_insider");

  const { refetch: storyRefetch } = useGetAllStories();

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, [])
  );



  const handleRefresh = async () => {
    await refetch();
    await storyRefetch();
  };

  const posts = isSuccess ? data.pages.flatMap((page) => page.data.posts) : [];

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setVisiblePostId(viewableItems[0].item.id);
    }
  }).current;

  return (
    <View style={{ flex: 1 }}>
      <FlashList<TPOST>
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Post
            {...item}
            isVisible={visiblePostId === item.id && isScreenFocused}
            onPressComments={() => openComments(item.id)}
          />
        )}
        ListHeaderComponent={<Stories />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 100, minimumViewTime: 250 }}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        onRefresh={handleRefresh}
        refreshing={isRefetching}
        onEndReachedThreshold={0.5}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
        drawDistance={1000}
      />

      <CommentsBottomSheet
        bottomSheetRef={bottomSheetRef}
        postId={selectedPostId}
        onDismiss={onDismiss}
      />
    </View>
  );
}