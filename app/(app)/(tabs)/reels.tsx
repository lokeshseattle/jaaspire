import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { useShareSheet } from "@/hooks/use-share-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import ReelItem from "@/src/components/reels/ReelItem";
import { SharePostBottomSheet } from "@/src/components/share/SharePostBottomSheet";
import { useTrackPostView } from "@/src/features/post/post.hooks";
import { usePostStore } from "@/src/features/post/post.store";
import { useGetReelsQuery } from "@/src/features/reels/reels.hooks";
import { videoManager } from "@/src/lib/video-manager";
import type { Post } from "@/src/services/api/api.types";
import type { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
import { useFocusEffect } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  Text,
  View,
  ViewabilityConfig,
  ViewToken,
} from "react-native";
import { useShallow } from "zustand/react/shallow";

const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 80,
  minimumViewTime: 200,
};

const PRELOAD_RADIUS = 1;

function viewerCanViewPostMedia(
  viewer: Post["viewer"] | undefined,
  price: number,
  isExclusive: boolean,
): boolean {
  if (viewer?.is_owner === true) return true;
  if (price > 0 && !viewer?.has_purchased) return false;
  if (isExclusive && !viewer?.has_subscription) return false;
  return true;
}

/** URL eligible for decoder preload (full access or timed preview). */
function reelPreloadTarget(post: Post | undefined): {
  postId: number;
  url: string;
} | null {
  if (!post?.attachments?.[0]) return null;
  const a = post.attachments[0];
  if (getMediaType(a.type) !== "video" || !a.path) return null;
  const price = post.price ?? 0;
  const isExclusive = post.is_exclusive ?? false;
  const canView = viewerCanViewPostMedia(post.viewer, price, isExclusive);
  const isPaidVideo = !canView && (price > 0 || isExclusive);
  if (canView || isPaidVideo) return { postId: post.id, url: a.path };
  return null;
}

type ReelRowProps = {
  id: number;
  listHeight: number;
  isFocused: boolean;
  inReelWindow: boolean;
  isScreenFocused: boolean;
  nextPostId: number | undefined;
  openComments: (postId: number) => void;
  openShare: (postId: number) => void;
};

const ReelRow = memo(function ReelRow({
  id,
  listHeight,
  isFocused,
  inReelWindow,
  isScreenFocused,
  nextPostId,
  openComments,
  openShare,
}: ReelRowProps) {
  const { theme } = useTheme();
  const rowStyles = useMemo(() => createReelsStyles(theme), [theme]);

  const post = usePostStore(useShallow((s) => s.posts[id]));
  const nextPost = usePostStore(
    useShallow((s) =>
      nextPostId != null ? (s.posts[nextPostId] ?? null) : null,
    ),
  );

  if (!post) {
    return (
      <View
        style={[
          rowStyles.placeholder,
          listHeight > 0 ? { height: listHeight } : undefined,
        ]}
      >
        <ActivityIndicator color={theme.colors.textSecondary} />
      </View>
    );
  }

  return (
    <ReelItem
      post={post}
      itemHeight={listHeight > 0 ? listHeight : 400}
      isFocused={isFocused}
      isScreenFocused={isScreenFocused}
      inReelWindow={inReelWindow}
      nextPost={nextPost}
      onOpenComments={() => openComments(id)}
      onOpenShare={() => openShare(id)}
    />
  );
});

export default function ReelsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createReelsStyles(theme), [theme]);

  const [listHeight, setListHeight] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  const postsMap = usePostStore((s) => s.posts);

  const { bottomSheetRef, selectedPostId, openComments, onDismiss } =
    useCommentsSheet();
  const {
    bottomSheetRef: shareBottomSheetRef,
    selectedPostId: selectedSharePostId,
    openShare,
    onDismiss: onShareDismiss,
  } = useShareSheet();

  const trackPostView = useTrackPostView();
  const trackPostViewRef = useRef(trackPostView);
  trackPostViewRef.current = trackPostView;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useGetReelsQuery();

  const postIds = useMemo(
    () => data?.pages.flatMap((page) => page.data.posts) ?? [],
    [data?.pages],
  );

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
        videoManager.pauseAll();
      };
    }, []),
  );

  useEffect(() => {
    if (postIds.length === 0) return;
    const idx = Math.min(focusedIndex, postIds.length - 1);
    const id = postIds[idx];
    if (id != null) {
      trackPostViewRef.current.mutate(id);
    }
  }, [focusedIndex, postIds]);

  useEffect(() => {
    if (postIds.length === 0 || focusedIndex < 0) return;

    const prevId = postIds[focusedIndex - 1];
    const nextId = postIds[focusedIndex + 1];

    const prevPost = prevId != null ? postsMap[prevId] : undefined;
    const nextPost = nextId != null ? postsMap[nextId] : undefined;

    const p = reelPreloadTarget(prevPost);
    const n = reelPreloadTarget(nextPost);
    if (p) videoManager.preload(p.postId, p.url);
    if (n) videoManager.preload(n.postId, n.url);
  }, [focusedIndex, postIds, postsMap]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length === 0) return;

      let token = viewableItems[0];
      for (const item of viewableItems) {
        if (item.isViewable) {
          token = item;
          break;
        }
      }
      const index = token.index;
      if (index == null || index < 0) return;
      setFocusedIndex(index);
    },
    [],
  );

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: VIEWABILITY_CONFIG,
      onViewableItemsChanged,
    },
  ]);

  const renderItem = useCallback(
    ({ item: id, index }: ListRenderItemInfo<number>) => {
      const nextPostId = postIds[index + 1];
      const isFocused = index === focusedIndex;
      const inWindow = Math.abs(index - focusedIndex) <= PRELOAD_RADIUS;
      return (
        <ReelRow
          id={id}
          listHeight={listHeight}
          isFocused={isFocused}
          inReelWindow={inWindow}
          isScreenFocused={isScreenFocused}
          nextPostId={nextPostId}
          openComments={openComments}
          openShare={openShare}
        />
      );
    },
    [
      postIds,
      listHeight,
      isScreenFocused,
      focusedIndex,
      openComments,
      openShare,
    ],
  );

  const keyExtractor = useCallback((id: number) => String(id), []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: listHeight,
      offset: listHeight * index,
      index,
    }),
    [listHeight],
  );

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const footer = useMemo(
    () =>
      isFetchingNextPage ? (
        <ActivityIndicator
          style={styles.footerLoader}
          color={theme.colors.textSecondary}
        />
      ) : null,
    [isFetchingNextPage, styles.footerLoader, theme.colors.textSecondary],
  );

  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Couldn&apos;t load reels</Text>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && Math.abs(h - listHeight) > 1) {
          setListHeight(h);
        }
      }}
    >
      {isLoading && postIds.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={postIds}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={
            !isLoading ? (
              <View style={[styles.centered, { minHeight: listHeight || 400 }]}>
                <Text style={styles.errorText}>No reels yet</Text>
              </View>
            ) : null
          }
          pagingEnabled
          showsVerticalScrollIndicator={false}
          decelerationRate="fast"
          snapToAlignment="start"
          snapToInterval={listHeight > 0 ? listHeight : undefined}
          removeClippedSubviews
          windowSize={3}
          maxToRenderPerBatch={1}
          initialNumToRender={1}
          updateCellsBatchingPeriod={100}
          getItemLayout={listHeight > 0 ? getItemLayout : undefined}
          viewabilityConfigCallbackPairs={
            viewabilityConfigCallbackPairs.current
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.55}
          ListFooterComponent={footer}
          contentContainerStyle={
            listHeight > 0 ? { paddingBottom: 0 } : { flexGrow: 1 }
          }
        />
      )}

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
}

function createReelsStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
    },
    placeholder: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: "center",
      justifyContent: "center",
    },
    footerLoader: {
      paddingVertical: theme.spacing.xl,
    },
    errorText: {
      color: theme.colors.textSecondary,
      fontSize: 15,
    },
  });
}
