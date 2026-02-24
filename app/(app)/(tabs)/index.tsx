import { useAuth } from "@/src/features/auth/auth.hooks";

import Post from "@/src/components/home/posts/post";
import Stories from "@/src/components/home/story";
import { useGetFeedQuery } from "@/src/features/post/post.hooks";
import { useGetAllStories } from "@/src/features/story/story.hooks";
import type { Post as TPOST } from "@/src/services/api/api.types";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator } from "react-native";

export default function Home() {
  const { logout } = useAuth();
  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      // Screen focused
      setIsScreenFocused(true);

      return () => {
        // Screen unfocused
        setIsScreenFocused(false);
      };
    }, []),
  );

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isSuccess,
    refetch,
    isRefetching,
  } = useGetFeedQuery();

  const { refetch: storyrRefetch } = useGetAllStories();

  const handleRefresh = async () => {
    await refetch();
    await storyrRefetch();
  };

  const posts = isSuccess ? data.pages.flatMap((page) => page.data.posts) : [];

  // console.log({ isFetchingNextPage });

  const viewabilityConfig = {
    itemVisiblePercentThreshold: 80,
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setVisiblePostId(viewableItems[0].item.id);
    }
  }).current;

  return (
    <FlashList<TPOST>
      data={posts}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <Post
          {...item}
          isVisible={visiblePostId === item.id && isScreenFocused}
        />
      )}
      ListHeaderComponent={<Stories />}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{
        itemVisiblePercentThreshold: 100,
        minimumViewTime: 250,
      }}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
      onRefresh={handleRefresh}
      refreshing={isRefetching}
      onEndReachedThreshold={0.5}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
      drawDistance={1000}
    />
  );
}
