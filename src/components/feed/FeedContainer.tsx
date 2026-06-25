import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import PostItem from "@/src/components/feed/PostItem";
import { SharePostBottomSheet } from "@/src/components/share/SharePostBottomSheet";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useMemo } from "react";
import {
  ActivityIndicator,
  ListRenderItemInfo,
  RefreshControl,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { useFeedController } from "./use-feed-controller";

type AnimatedFeedFlatList = typeof Animated.FlatList<number>;
type AnimatedFeedFlatListProps = React.ComponentProps<AnimatedFeedFlatList>;
type AnimatedFeedFlatListRef = React.ComponentRef<AnimatedFeedFlatList>;

type FeedContainerProps = {
  controller: ReturnType<typeof useFeedController>;
  postIds: number[];
  ListHeaderComponent?: React.ReactElement;
  ListEmptyComponent?: React.ReactElement | null;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  flatListRef?: React.RefObject<AnimatedFeedFlatListRef | null>;
  flatListProps?: Partial<AnimatedFeedFlatListProps>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Pushes the pull-to-refresh spinner below an overlay header (e.g. home tab). */
  refreshProgressViewOffset?: number;
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
  contentContainerStyle,
  refreshProgressViewOffset,
}: FeedContainerProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const refreshControl = useMemo(() => {
    if (refreshProgressViewOffset == null) return undefined;
    return (
      <RefreshControl
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        progressViewOffset={refreshProgressViewOffset}
        tintColor={theme.colors.primary}
        colors={[theme.colors.primary]}
      />
    );
  }, [
    refreshProgressViewOffset,
    isRefreshing,
    onRefresh,
    theme.colors.primary,
  ]);

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
      <Animated.FlatList
        ref={flatListRef}
        data={postIds}
        keyExtractor={(item) => item.toString()}
        renderItem={renderItem}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent ?? undefined}
        ListFooterComponent={ListFooter}
        contentContainerStyle={contentContainerStyle}
        viewabilityConfigCallbackPairs={
          controller.viewabilityConfigCallbackPairs.current
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        {...(refreshControl
          ? { refreshControl }
          : { onRefresh, refreshing: isRefreshing })}
        extraData={controller.extraData}
        removeClippedSubviews
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={3}
        updateCellsBatchingPeriod={50}
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
