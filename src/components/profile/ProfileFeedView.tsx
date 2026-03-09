// src/components/profile/ProfileFeedView.tsx
import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper";
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

const VIEWABILITY_CONFIG: ViewabilityConfig = {
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
};

interface ProfileFeedViewProps {
    postIds: number[];
    ListHeaderComponent: React.ReactElement;
    onRefresh: () => Promise<void>;
    isRefreshing: boolean;
    onEndReached: () => void;
    isFetchingNextPage: boolean;
    isTabActive: boolean; // Important: controls video playback
}

export function ProfileFeedView({
    postIds,
    ListHeaderComponent,
    onRefresh,
    isRefreshing,
    onEndReached,
    isFetchingNextPage,
    isTabActive,
}: ProfileFeedViewProps) {
    const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
    const [isScreenFocused, setIsScreenFocused] = useState(true);
    const flatListRef = useRef<FlatList>(null);

    // Comments hook
    const { bottomSheetRef, selectedPostId, openComments, onDismiss } =
        useCommentsSheet();

    // Track screen focus
    useFocusEffect(
        useCallback(() => {
            setIsScreenFocused(true);
            return () => {
                setIsScreenFocused(false);
                videoManager.pauseAll();
            };
        }, [])
    );

    // Pause videos when tab becomes inactive
    useMemo(() => {
        if (!isTabActive) {
            videoManager.pauseAll();
            setVisiblePostId(null);
        }
    }, [isTabActive]);

    // Viewability handler
    const onViewableItemsChanged = useCallback(
        ({ viewableItems }: { viewableItems: ViewToken[] }) => {
            if (!isTabActive || viewableItems.length === 0) {
                setVisiblePostId(null);
                return;
            }

            const mostVisibleItem = viewableItems.find((item) => item.isViewable);
            if (mostVisibleItem) {
                setVisiblePostId(mostVisibleItem.item as number);
            }
        },
        [isTabActive]
    );

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

    // Effective visible post (only when tab is active)
    const effectiveVisiblePostId = isTabActive ? visiblePostId : null;
    const effectiveScreenFocused = isTabActive && isScreenFocused;

    const renderItem = useCallback(
        ({ item: id }: { item: number }) => {
            const nextId = getNextPostId(id);
            return (
                <PostItem
                    id={id}
                    nextId={nextId}
                    visiblePostId={effectiveVisiblePostId}
                    isScreenFocused={effectiveScreenFocused}
                    openComments={openComments}
                />
            );
        },
        [effectiveVisiblePostId, effectiveScreenFocused, openComments, getNextPostId]
    );

    const keyExtractor = useCallback((item: number) => `feed-${item}`, []);

    const ListFooter = useMemo(
        () =>
            isFetchingNextPage ? (
                <ActivityIndicator style={{ padding: 20 }} />
            ) : null,
        [isFetchingNextPage]
    );

    return (
        <View style={{ flex: 1 }}>
            <FlatList
                ref={flatListRef}
                data={postIds}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                ListHeaderComponent={ListHeaderComponent}
                ListFooterComponent={ListFooter}
                viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
                onEndReached={onEndReached}
                onEndReachedThreshold={0.5}
                onRefresh={onRefresh}
                refreshing={isRefreshing}
                // Performance optimizations
                removeClippedSubviews={true}
                windowSize={5}
                maxToRenderPerBatch={3}
                initialNumToRender={3}
                updateCellsBatchingPeriod={50}
                maintainVisibleContentPosition={{
                    minIndexForVisible: 0,
                }}
                showsVerticalScrollIndicator={false}
            />

            <CommentsBottomSheet
                bottomSheetRef={bottomSheetRef}
                postId={selectedPostId}
                onDismiss={onDismiss}
            />
        </View>
    );
}