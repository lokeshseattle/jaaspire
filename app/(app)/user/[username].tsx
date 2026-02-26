import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import Post from "@/src/components/home/posts/post";
import { useGetUserFeedQuery } from "@/src/features/post/post.hooks";
import { FlashList } from "@shopify/flash-list";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

const UserProfile = () => {
  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  // Comments hook
  const { bottomSheetRef, selectedPostId, openComments, onDismiss } = useCommentsSheet();

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => setIsScreenFocused(false);
    }, [])
  );

  const { username } = useLocalSearchParams<{ username: string }>();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isSuccess, refetch, isRefetching } =
    useGetUserFeedQuery(username);
  const posts = isSuccess ? data.pages.flatMap((page) => page.data.posts) : [];

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setVisiblePostId(viewableItems[0].item.id);
    }
  }).current;


  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <Post
            {...item}
            isVisible={visiblePostId === item.id && isScreenFocused}
            onPressComments={() => openComments(item.id)}
          />
        )}
        // ListHeaderComponent={<Stories />}
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
};

export default UserProfile;
