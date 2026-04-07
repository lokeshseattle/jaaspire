// src/components/profile/ProfileFeedView.tsx
// Feed list behavior aligned with app/(app)/(tabs)/index.tsx (home).
import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/home/posts/PostWrapper.old";
import { useTrackPostView } from "@/src/features/post/post.hooks";
import { videoManager } from "@/src/lib/video-manager.old";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    View,
    ViewabilityConfig,
    ViewToken,
} from "react-native";

// Match home feed — see app/(app)/(tabs)/index.tsx
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
  /** When false, videos pause and viewability is ignored (e.g. inactive profile tab). */
  isTabActive: boolean;
  ListEmptyComponent?: React.ReactElement | null;
}

export function ProfileFeedView({
  postIds,
  ListHeaderComponent,
  onRefresh,
  isRefreshing,
  onEndReached,
  isFetchingNextPage,
  isTabActive,
  ListEmptyComponent,
}: ProfileFeedViewProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createListStyles(theme), [theme]);

  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const flatListRef = useRef<FlatList<number>>(null);

  const trackPostView = useTrackPostView();

  const { bottomSheetRef, selectedPostId, openComments, onDismiss } =
    useCommentsSheet();

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
    if (!isTabActive) {
      videoManager.pauseAll();
      setVisiblePostId(null);
    }
  }, [isTabActive]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!isTabActive) {
        setVisiblePostId(null);
        return;
      }

      if (viewableItems.length === 0) {
        setVisiblePostId(null);
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
    [isTabActive, trackPostView],
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
    [
      effectiveVisiblePostId,
      effectiveScreenFocused,
      openComments,
      getNextPostId,
    ],
  );

  const keyExtractor = useCallback((item: number) => item.toString(), []);

  const ListFooter = useMemo(
    () =>
      isFetchingNextPage ? (
        <ActivityIndicator
          style={styles.loader}
          color={theme.colors.textSecondary}
        />
      ) : null,
    [isFetchingNextPage, styles.loader, theme.colors.textSecondary],
  );

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={flatListRef}
        data={postIds}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent ?? undefined}
        ListFooterComponent={ListFooter}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        onRefresh={onRefresh}
        refreshing={isRefreshing}
        extraData={visiblePostId}
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

const createListStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    loader: {
      padding: theme.spacing.xl,
    },
  });
