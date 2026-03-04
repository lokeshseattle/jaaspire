import React, { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Text, View } from 'react-native'
// import { useGetPostQuery } from '@/src/features/post/post.hooks'
import { useCommentsSheet } from '@/hooks/use-comment-sheet'
import { CommentsBottomSheet } from '@/src/components/comments/CommentsBottomSheet'
import PostItem from '@/src/components/home/posts/PostWrapper'
import { useGetSinglePost } from '@/src/features/post/post.hooks'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'

const PostScreen = () => {
    const { postId } = useLocalSearchParams<{ postId: string }>()

    const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
    const [isScreenFocused, setIsScreenFocused] = useState(true);

    const { bottomSheetRef, selectedPostId, openComments, onDismiss } = useCommentsSheet();

    console.log("postId single", postId)
    // const {data, isLoading} = useGetPostQuery(Number(postId))
    const { data, isLoading, isSuccess, hasNextPage, isFetchingNextPage, fetchNextPage } = useGetSinglePost(postId)


    useFocusEffect(
        useCallback(() => {
            setIsScreenFocused(true);
            return () => setIsScreenFocused(false);
        }, [])
    );

    const mainPostId = data?.mainPostId
    const recommendedPostsIds = data && data.recommendedIds

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setVisiblePostId(viewableItems[0].item);
        }
    }).current;

    if (isLoading) return <Text>Loading...</Text>
    if (!isSuccess) return <Text>Error</Text>

    return (
        <View style={{ flex: 1 }}>
            {recommendedPostsIds && mainPostId && <FlatList
                data={recommendedPostsIds}
                keyExtractor={item => item.toString()}
                renderItem={({ item: id }) => (
                    <PostItem
                        id={id}
                        visiblePostId={visiblePostId}
                        isScreenFocused={isScreenFocused}
                        openComments={openComments}
                    />)}
                ListHeaderComponent={<PostItem
                    id={mainPostId}
                    visiblePostId={visiblePostId}
                    isScreenFocused={isScreenFocused}
                    openComments={openComments} />}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ itemVisiblePercentThreshold: 100, minimumViewTime: 250 }}
                onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
                // onRefresh={handleRefresh}
                // refreshing={isRefetching}
                onEndReachedThreshold={0.5}
                ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
            // drawDistance={1000}
            />}

            <CommentsBottomSheet
                bottomSheetRef={bottomSheetRef}
                postId={selectedPostId}
                onDismiss={onDismiss}
            />
        </View>
    )
}

export default PostScreen