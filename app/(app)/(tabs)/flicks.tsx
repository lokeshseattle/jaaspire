import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import { useFeedController } from "@/src/components/feed/use-feed-controller";
import FlickItem from "@/src/components/flicks/FlickItem";
import FlickItemErrorBoundary from "@/src/components/flicks/FlickItemErrorBoundary";
import {
    flickActiveIndexFromOffset,
    FLICKS_PRELOAD_RADIUS,
    flickScrollDirection,
    type FlickScrollDirection,
    prefetchFlickThumbnails,
    resetFlickOnFocusChange,
    seekOffWindowFlicks,
    syncFlickVideoPool,
} from "@/src/features/flicks/flicks-feed-video";
import {
    type FlicksFeed,
    useGetFlicksQuery,
} from "@/src/features/flicks/flicks.hooks";
import {
    useDeletePostMutation,
    useTrackPostView,
} from "@/src/features/post/post.hooks";
import { usePostStore } from "@/src/features/post/post.store";
import { syncSystemVolumeFromDevice } from "@/src/lib/system-volume-unmute-sync";
import { videoManager } from "@/src/lib/video-manager";
import { getApiErrorMessage } from "@/src/services/api/api.error";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "expo-router";
import {
    memo,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    type LayoutChangeEvent,
    ListRenderItemInfo,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    PixelRatio,
    Pressable,
    StyleSheet,
    Text,
    View,
    ViewabilityConfig,
    ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";

const VIEWABILITY_CONFIG: ViewabilityConfig = {
  itemVisiblePercentThreshold: 60,
  minimumViewTime: 0,
};
const STRICT_OFFSCREEN_VIEWABILITY: ViewabilityConfig = {
  itemVisiblePercentThreshold: 1,
  minimumViewTime: 0,
};

/** Full-bleed flick canvas (not theme.background — avoids white bars in light mode). */
const FLICKS_CANVAS = "#000";
/** Flicks tab is always dark chrome; muted text/icons on black (ignores light app theme). */
const FLICKS_ON_DARK_MUTED = "rgba(255,255,255,0.55)";
const FLICKS_ON_DARK_TEXT = "rgba(255,255,255,0.72)";

/** Top row min height (label row) + `paddingBottom` on the tab bar. */
const FEED_TABS_ROW_HEIGHT = 44;
const FEED_TABS_CHROME_HEIGHT = FEED_TABS_ROW_HEIGHT + 10;

type FlickRowProps = {
  id: number;
  flickHeight: number;
  flickWidth: number;
  safeTopInset: number;
  isFocused: boolean;
  inFlickWindow: boolean;
  isScreenFocused: boolean;
  nextPostId: number | undefined;
  openComments: (postId: number) => void;
  onDeleteFlick: (postId: number) => void;
};

const FlickRow = memo(function FlickRow({
  id,
  flickHeight,
  flickWidth,
  safeTopInset,
  isFocused,
  inFlickWindow,
  isScreenFocused,
  nextPostId,
  openComments,
  onDeleteFlick,
}: FlickRowProps) {
  const rowStyles = useMemo(() => createFlicksStyles(), []);

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
          { height: flickHeight, width: flickWidth },
        ]}
      >
        <ActivityIndicator color={FLICKS_ON_DARK_MUTED} />
      </View>
    );
  }

  return (
    <View style={{ width: flickWidth, height: flickHeight }}>
      <FlickItemErrorBoundary
        key={id}
        postId={id}
        width={flickWidth}
        height={flickHeight}
      >
        <FlickItem
          post={post}
          itemHeight={flickHeight}
          itemWidth={flickWidth}
          safeTopInset={safeTopInset}
          isFocused={isFocused}
          isScreenFocused={isScreenFocused}
          inFlickWindow={inFlickWindow}
          nextPost={nextPost}
          onOpenComments={() => openComments(id)}
          onDeleteFlick={onDeleteFlick}
        />
      </FlickItemErrorBoundary>
    </View>
  );
});

export default function FlicksScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useMemo(() => createFlicksStyles(), []);

  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [feedTab, setFeedTab] = useState<FlicksFeed>("explore");

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  }, []);

  const screen = Dimensions.get("screen");
  /** Full-bleed viewport width/height (feed tabs overlay video; height not reduced by tab row). */
  const flickWidth = viewport.w > 0 ? viewport.w : screen.width;
  const flickHeightRaw =
    viewport.h > 0 ? viewport.h : Math.max(1, screen.height - tabBarHeight);
  /** Page height aligned with device pixels so snap, `getItemLayout`, and rows stay consistent. */
  const flickHeight = PixelRatio.roundToNearestPixel(flickHeightRaw);

  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const scrollDirectionRef = useRef<FlickScrollDirection>("none");
  const scrollOffsetRef = useRef(0);

  const postsMap = usePostStore((s) => s.posts);

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
    refetch,
  } = useGetFlicksQuery(feedTab);

  const postIds = useMemo(
    () => data?.pages.flatMap((page) => page.data.posts) ?? [],
    [data?.pages],
  );

  const controller = useFeedController({
    postIds,
    viewabilityConfig: VIEWABILITY_CONFIG,
  });
  const openComments = controller.commentsSheet.openComments;

  const postIdsRef = useRef(postIds);
  postIdsRef.current = postIds;
  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;

  const deletePostMutation = useDeletePostMutation();
  const deletePostMutationRef = useRef(deletePostMutation);
  deletePostMutationRef.current = deletePostMutation;

  /**
   * Scroll-first-then-delete: scroll to the next reel (or previous if at the end),
   * wait for the animation to settle, then fire the delete mutation.
   * This avoids the visual jump that would occur if the item disappeared while still visible.
   */
  const handleDeleteFlick = useCallback((postId: number) => {
    const ids = postIdsRef.current;
    const currentIdx = focusedIndexRef.current;

    const isLast = currentIdx >= ids.length - 1;
    const targetIndex = isLast ? currentIdx - 1 : currentIdx + 1;

    const doDelete = () => {
      deletePostMutationRef.current.mutate(postId, {
        onError: (err: unknown) => {
          Alert.alert(
            "Error",
            getApiErrorMessage(err, "Could not delete this post."),
          );
        },
      });
    };

    if (targetIndex < 0) {
      doDelete();
      return;
    }

    flatListRef.current?.scrollToIndex({ index: targetIndex, animated: true });
    setTimeout(doDelete, 350);
  }, []);

  /** Clamp focusedIndex so it never exceeds the list bounds after a deletion. */
  useEffect(() => {
    if (postIds.length === 0) return;
    if (focusedIndex >= postIds.length) {
      setFocusedIndex(postIds.length - 1);
    }
  }, [postIds.length, focusedIndex]);

  /** Last focused row index per feed (session memory when switching Following / Explore). */
  const indicesRef = useRef<{ following: number; explore: number }>({
    following: 0,
    explore: 0,
  });

  useEffect(() => {
    indicesRef.current[feedTab] = focusedIndex;
  }, [focusedIndex]);

  /** After a feed tab switch: release all native players, then restore scroll once `postIds` is ready. */
  const pendingFeedRestoreRef = useRef(false);
  const prevFeedTabRef = useRef<FlicksFeed | null>(null);

  useLayoutEffect(() => {
    if (prevFeedTabRef.current === null) {
      prevFeedTabRef.current = feedTab;
      return;
    }
    if (prevFeedTabRef.current === feedTab) return;

    prevFeedTabRef.current = feedTab;
    videoManager.releaseAll();
    pendingFeedRestoreRef.current = true;
  }, [feedTab]);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      syncSystemVolumeFromDevice();
      const ids = postIdsRef.current;
      const idx = focusedIndexRef.current;
      if (ids.length > 0) {
        const id = ids[Math.min(Math.max(idx, 0), ids.length - 1)];
        videoManager.seekToStart(id);
      }
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
    syncFlickVideoPool({
      postIds,
      focusedIndex,
      postsMap,
      scrollDirection: scrollDirectionRef.current,
    });
    prefetchFlickThumbnails({
      postIds,
      focusedIndex,
      postsMap,
      scrollDirection: scrollDirectionRef.current,
    });
  }, [focusedIndex, postIds, postsMap]);

  const applyFocusedIndexFromScroll = useCallback(
    (offsetY: number, direction: FlickScrollDirection) => {
      const ids = postIdsRef.current;
      if (ids.length === 0 || flickHeight <= 0) return;
      const index = flickActiveIndexFromOffset(
        offsetY,
        flickHeight,
        ids.length,
        direction,
      );
      const prevIndex = focusedIndexRef.current;
      if (index === prevIndex) return;
      resetFlickOnFocusChange(ids, prevIndex, index);
      setFocusedIndex(index);
    },
    [flickHeight],
  );

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
      if (index !== focusedIndexRef.current) {
        const ids = postIdsRef.current;
        resetFlickOnFocusChange(ids, focusedIndexRef.current, index);
        setFocusedIndex(index);
      }
    },
    [],
  );

  const onStrictVisibilityChanged = useCallback(
    ({ changed }: { changed: ViewToken[] }) => {
      const ids = postIdsRef.current;
      const focusIdx = focusedIndexRef.current;
      for (const token of changed) {
        if (token.isViewable) continue;
        const id = typeof token.item === "number" ? token.item : null;
        if (id == null) continue;
        seekOffWindowFlicks(id, ids, focusIdx);
      }
    },
    [],
  );

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig: VIEWABILITY_CONFIG,
      onViewableItemsChanged,
    },
    {
      viewabilityConfig: STRICT_OFFSCREEN_VIEWABILITY,
      onViewableItemsChanged: onStrictVisibilityChanged,
    },
  ]);

  const renderItem = useCallback(
    ({ item: id, index }: ListRenderItemInfo<number>) => {
      const nextPostId = postIds[index + 1];
      const isFocused = index === focusedIndex;
      const inWindow = Math.abs(index - focusedIndex) <= FLICKS_PRELOAD_RADIUS;
      return (
        <FlickRow
          id={id}
          flickHeight={flickHeight}
          flickWidth={flickWidth}
          safeTopInset={insets.top + FEED_TABS_CHROME_HEIGHT}
          isFocused={isFocused}
          inFlickWindow={inWindow}
          isScreenFocused={isScreenFocused}
          nextPostId={nextPostId}
          openComments={openComments}
          onDeleteFlick={handleDeleteFlick}
        />
      );
    },
    [
      postIds,
      flickHeight,
      flickWidth,
      insets.top,
      isScreenFocused,
      focusedIndex,
      openComments,
      handleDeleteFlick,
    ],
  );

  const keyExtractor = useCallback((id: number) => String(id), []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: flickHeight,
      offset: flickHeight * index,
      index,
    }),
    [flickHeight],
  );

  const flatListRef = useRef<FlatList<number>>(null);

  const handleTabRepressRefresh = useCallback(() => {
    setFocusedIndex(0);
    indicesRef.current[feedTab] = 0;
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    void refetch();
  }, [feedTab, refetch]);

  useEffect(() => {
    const unsubscribe = navigation.addListener("tabPress" as any, () => {
      if (navigation.isFocused()) {
        handleTabRepressRefresh();
      }
    });
    return unsubscribe;
  }, [navigation, handleTabRepressRefresh]);

  useLayoutEffect(() => {
    if (postIds.length === 0 || !pendingFeedRestoreRef.current) return;

    pendingFeedRestoreRef.current = false;

    const saved = indicesRef.current[feedTab];
    const safeIdx = Math.min(Math.max(saved, 0), postIds.length - 1);
    setFocusedIndex(safeIdx);
    indicesRef.current[feedTab] = safeIdx;

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: safeIdx * flickHeight,
        animated: false,
      });
    });
  }, [feedTab, postIds.length, flickHeight]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      scrollDirectionRef.current = flickScrollDirection(
        scrollOffsetRef.current,
        y,
      );
      scrollOffsetRef.current = y;

      if (flickHeight <= 0) return;
      applyFocusedIndexFromScroll(y, scrollDirectionRef.current);
    },
    [flickHeight, applyFocusedIndexFromScroll],
  );

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (flickHeight <= 0) return;
      const nearest = Math.round(y / flickHeight);
      const target = nearest * flickHeight;
      if (Math.abs(y - target) > 0.5) {
        flatListRef.current?.scrollToOffset({
          offset: Math.max(0, target),
          animated: false,
        });
      }
      applyFocusedIndexFromScroll(target, "none");
    },
    [flickHeight, applyFocusedIndexFromScroll],
  );

  const onScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      flatListRef.current?.scrollToOffset({
        offset: info.index * flickHeight,
        animated: true,
      });
    },
    [flickHeight],
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
          color={FLICKS_ON_DARK_MUTED}
        />
      ) : null,
    [isFetchingNextPage, styles.footerLoader],
  );

  const feedTabsHeader = (
    <View
      pointerEvents="box-none"
      style={[
        styles.feedTabsOverlay,
        styles.feedTabsRow,
        {
          paddingTop: insets.top,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => setFeedTab("following")}
        style={styles.feedTabHit}
      >
        <Text
          style={
            feedTab === "following"
              ? styles.feedTabLabelActive
              : styles.feedTabLabelInactive
          }
        >
          Following
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        hitSlop={12}
        onPress={() => setFeedTab("explore")}
        style={styles.feedTabHit}
      >
        <Text
          style={
            feedTab === "explore"
              ? styles.feedTabLabelActive
              : styles.feedTabLabelInactive
          }
        >
          Explore
        </Text>
      </Pressable>
    </View>
  );

  const listEmpty =
    !isLoading && postIds.length === 0 ? (
      <View
        style={[
          styles.centered,
          {
            minHeight: flickHeight,
            width: flickWidth,
            backgroundColor: FLICKS_CANVAS,
          },
        ]}
      >
        <Text style={styles.errorText}>
          {feedTab === "following"
            ? "No flicks from people you follow yet"
            : "No flicks yet"}
        </Text>
      </View>
    ) : null;

  if (isError && postIds.length === 0) {
    return (
      <View style={styles.flicksOuter}>
        <View style={[styles.centered, styles.flicksViewportFlex]}>
          <Text style={styles.errorText}>Couldn&apos;t load flicks</Text>
        </View>
        {feedTabsHeader}
        <CommentsBottomSheet
          bottomSheetRef={controller.commentsSheet.bottomSheetRef}
          postId={controller.commentsSheet.selectedPostId}
          onDismiss={controller.commentsSheet.onDismiss}
        />
      </View>
    );
  }

  return (
    <View style={styles.flicksOuter}>
      <View
        style={[styles.flicksViewportFlex, { backgroundColor: FLICKS_CANVAS }]}
        onLayout={onViewportLayout}
      >
        {isLoading && postIds.length === 0 ? (
          <View style={[styles.centered, { width: "100%", height: "100%" }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={postIds}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: FLICKS_CANVAS,
            }}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={onMomentumScrollEnd}
            onScrollToIndexFailed={onScrollToIndexFailed}
            ListEmptyComponent={listEmpty}
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            disableIntervalMomentum
            snapToAlignment="start"
            snapToInterval={flickHeight}
            removeClippedSubviews={false}
            windowSize={3}
            maxToRenderPerBatch={1}
            initialNumToRender={1}
            updateCellsBatchingPeriod={100}
            getItemLayout={getItemLayout}
            viewabilityConfigCallbackPairs={
              viewabilityConfigCallbackPairs.current
            }
            onEndReached={onEndReached}
            onEndReachedThreshold={0.55}
            ListFooterComponent={footer}
            contentContainerStyle={{ paddingBottom: 0 }}
          />
        )}
      </View>
      {feedTabsHeader}

      <CommentsBottomSheet
        bottomSheetRef={controller.commentsSheet.bottomSheetRef}
        postId={controller.commentsSheet.selectedPostId}
        onDismiss={controller.commentsSheet.onDismiss}
      />
    </View>
  );
}

function createFlicksStyles() {
  return StyleSheet.create({
    flicksOuter: {
      flex: 1,
      backgroundColor: FLICKS_CANVAS,
    },
    feedTabsOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      elevation: 10,
      backgroundColor: "transparent",
    },
    feedTabsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      minHeight: FEED_TABS_ROW_HEIGHT,
      paddingBottom: 10,
      backgroundColor: "transparent",
    },
    feedTabHit: {
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    feedTabLabelActive: {
      color: "#FFFFFF",
      fontSize: 17,
      fontWeight: "600",
    },
    feedTabLabelInactive: {
      color: "rgba(255,255,255,0.58)",
      fontSize: 17,
      fontWeight: "500",
    },
    flicksViewportFlex: {
      flex: 1,
      overflow: "hidden",
    },
    flicksScreenRoot: {
      backgroundColor: FLICKS_CANVAS,
      overflow: "visible",
    },
    container: {
      flex: 1,
      backgroundColor: FLICKS_CANVAS,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: FLICKS_CANVAS,
    },
    placeholder: {
      flex: 1,
      backgroundColor: FLICKS_CANVAS,
      alignItems: "center",
      justifyContent: "center",
    },
    footerLoader: {
      paddingVertical: 24,
    },
    errorText: {
      color: FLICKS_ON_DARK_TEXT,
      fontSize: 15,
    },
  });
}
