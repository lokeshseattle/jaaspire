import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/feed/PostItem";
import { SharePostBottomSheet } from "@/src/components/share/SharePostBottomSheet";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  ListRenderItemInfo,
  StyleSheet,
  View,
} from "react-native";
import { useFeedController } from "./use-feed-controller";

type FeedContainerProps = {
  controller: ReturnType<typeof useFeedController>;
  postIds: number[];
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  flatListRef?: React.RefObject<FlatList<number> | null>;
  flatListProps?: Partial<React.ComponentProps<typeof FlatList<number>>>;
};

export function FeedContainer({
  controller,
  postIds,
  ListHeaderComponent,
  ListEmptyComponent,
  onRefresh,
  isRefreshing,
  onEndReached,
  isFetchingNextPage,
  flatListRef,
  flatListProps,
}: FeedContainerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  const renderItem = ({ item: id, index }: ListRenderItemInfo<number>) => {
    const nextId = controller.getNextPostId(id);

    // console.log("visibleFeedIndex", controller.visibleFeedIndexRef.current);
    return (
      <PostItem
        id={id}
        feedIndex={index}
        visibleFeedIndex={controller.visibleFeedIndexRef.current}
        nextId={nextId}
        visiblePostId={controller.visiblePostIdRef.current}
        isScreenFocused={controller.isScreenFocusedRef.current}
        openComments={controller.commentsSheet.openComments}
        openShare={controller.shareSheet.openShare}
      />
    );
  };

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={flatListRef}
        data={postIds}
        keyExtractor={(item) => item.toString()}
        renderItem={renderItem}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent ?? undefined}
        ListFooterComponent={ListFooter}
        viewabilityConfigCallbackPairs={
          controller.viewabilityConfigCallbackPairs.current
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        onRefresh={onRefresh}
        refreshing={isRefreshing}
        extraData={controller.extraData}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        updateCellsBatchingPeriod={50}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        showsVerticalScrollIndicator={false}
        {...flatListProps}
      />

      <CommentsBottomSheet
        bottomSheetRef={controller.commentsSheet.bottomSheetRef}
        postId={controller.commentsSheet.selectedPostId}
        onDismiss={controller.commentsSheet.onDismiss}
      />
      <SharePostBottomSheet
        bottomSheetRef={controller.shareSheet.bottomSheetRef}
        postId={controller.shareSheet.selectedPostId}
        onDismiss={controller.shareSheet.onDismiss}
      />
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { flex: 1 },
    loader: {
      padding: theme.spacing.xl,
    },
  });
