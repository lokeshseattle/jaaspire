import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { useShareSheet } from "@/hooks/use-share-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import ReelItem from "@/src/components/reels/ReelItem";
import { SharePostBottomSheet } from "@/src/components/share/SharePostBottomSheet";
import { useTrackPostView } from "@/src/features/post/post.hooks";
import { usePostStore } from "@/src/features/post/post.store";
import {
  type ReelsFeed,
  useGetReelsQuery,
} from "@/src/features/reels/reels.hooks";
import { videoManager } from "@/src/lib/video-manager";
import type { Post } from "@/src/services/api/api.types";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "expo-router";
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
  itemVisiblePercentThreshold: 80,
  minimumViewTime: 200,
};

const PRELOAD_RADIUS = 1;

/** Full-bleed reel canvas (not theme.background — avoids white bars in light mode). */
const REELS_CANVAS = "#000";
/** Reels tab is always dark chrome; muted text/icons on black (ignores light app theme). */
const REELS_ON_DARK_MUTED = "rgba(255,255,255,0.55)";
const REELS_ON_DARK_TEXT = "rgba(255,255,255,0.72)";

/** Top row min height (label row) + `paddingBottom` on the tab bar. */
const FEED_TABS_ROW_HEIGHT = 44;
const FEED_TABS_CHROME_HEIGHT = FEED_TABS_ROW_HEIGHT + 10;

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
  reelHeight: number;
  reelWidth: number;
  safeTopInset: number;
  isFocused: boolean;
  inReelWindow: boolean;
  isScreenFocused: boolean;
  nextPostId: number | undefined;
  openComments: (postId: number) => void;
  openShare: (postId: number) => void;
};

const ReelRow = memo(function ReelRow({
  id,
  reelHeight,
  reelWidth,
  safeTopInset,
  isFocused,
  inReelWindow,
  isScreenFocused,
  nextPostId,
  openComments,
  openShare,
}: ReelRowProps) {
  const rowStyles = useMemo(() => createReelsStyles(), []);

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
          { height: reelHeight, width: reelWidth },
        ]}
      >
        <ActivityIndicator color={REELS_ON_DARK_MUTED} />
      </View>
    );
  }

  return (
    <View style={{ width: reelWidth, height: reelHeight }}>
      <ReelItem
        post={post}
        itemHeight={reelHeight}
        itemWidth={reelWidth}
        safeTopInset={safeTopInset}
        isFocused={isFocused}
        isScreenFocused={isScreenFocused}
        inReelWindow={inReelWindow}
        nextPost={nextPost}
        onOpenComments={() => openComments(id)}
        onOpenShare={() => openShare(id)}
      />
    </View>
  );
});

export default function ReelsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createReelsStyles(), []);

  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [feedTab, setFeedTab] = useState<ReelsFeed>("explore");

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  }, []);

  const screen = Dimensions.get("screen");
  /** Full-bleed viewport width/height (feed tabs overlay video; height not reduced by tab row). */
  const reelWidth = viewport.w > 0 ? viewport.w : screen.width;
  const reelHeightRaw =
    viewport.h > 0
      ? viewport.h
      : Math.max(1, screen.height - tabBarHeight);
  /** Page height aligned with device pixels so snap, `getItemLayout`, and rows stay consistent. */
  const reelHeight = PixelRatio.roundToNearestPixel(reelHeightRaw);

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
  } = useGetReelsQuery(feedTab);

  const postIds = useMemo(
    () => data?.pages.flatMap((page) => page.data.posts) ?? [],
    [data?.pages],
  );

  const postIdsRef = useRef(postIds);
  postIdsRef.current = postIds;
  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;

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
  const prevFeedTabRef = useRef<ReelsFeed | null>(null);

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
          reelHeight={reelHeight}
          reelWidth={reelWidth}
          safeTopInset={insets.top + FEED_TABS_CHROME_HEIGHT}
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
      reelHeight,
      reelWidth,
      insets.top,
      isScreenFocused,
      focusedIndex,
      openComments,
      openShare,
    ],
  );

  const keyExtractor = useCallback((id: number) => String(id), []);

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: reelHeight,
      offset: reelHeight * index,
      index,
    }),
    [reelHeight],
  );

  const flatListRef = useRef<FlatList<number>>(null);

  useLayoutEffect(() => {
    if (postIds.length === 0 || !pendingFeedRestoreRef.current) return;

    pendingFeedRestoreRef.current = false;

    const saved = indicesRef.current[feedTab];
    const safeIdx = Math.min(Math.max(saved, 0), postIds.length - 1);
    setFocusedIndex(safeIdx);
    indicesRef.current[feedTab] = safeIdx;

    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: safeIdx * reelHeight,
        animated: false,
      });
    });
  }, [feedTab, postIds.length, reelHeight]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      if (reelHeight <= 0) return;
      const nearest = Math.round(y / reelHeight);
      const target = nearest * reelHeight;
      if (Math.abs(y - target) > 0.5) {
        flatListRef.current?.scrollToOffset({
          offset: Math.max(0, target),
          animated: false,
        });
      }
    },
    [reelHeight],
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
          color={REELS_ON_DARK_MUTED}
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
            minHeight: reelHeight,
            width: reelWidth,
            backgroundColor: REELS_CANVAS,
          },
        ]}
      >
        <Text style={styles.errorText}>
          {feedTab === "following"
            ? "No reels from people you follow yet"
            : "No reels yet"}
        </Text>
      </View>
    ) : null;

  if (isError) {
    return (
      <View style={styles.reelsOuter}>
        <View style={[styles.centered, styles.reelsViewportFlex]}>
          <Text style={styles.errorText}>Couldn&apos;t load reels</Text>
        </View>
        {feedTabsHeader}
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

  return (
    <View style={styles.reelsOuter}>
      <View
        style={[styles.reelsViewportFlex, { backgroundColor: REELS_CANVAS }]}
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
              backgroundColor: REELS_CANVAS,
            }}
            onMomentumScrollEnd={onMomentumScrollEnd}
            ListEmptyComponent={listEmpty}
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            disableIntervalMomentum
            snapToAlignment="start"
            snapToInterval={reelHeight}
            removeClippedSubviews
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

function createReelsStyles() {
  return StyleSheet.create({
    reelsOuter: {
      flex: 1,
      backgroundColor: REELS_CANVAS,
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
    reelsViewportFlex: {
      flex: 1,
      overflow: "hidden",
    },
    reelsScreenRoot: {
      backgroundColor: REELS_CANVAS,
      overflow: "visible",
    },
    container: {
      flex: 1,
      backgroundColor: REELS_CANVAS,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: REELS_CANVAS,
    },
    placeholder: {
      flex: 1,
      backgroundColor: REELS_CANVAS,
      alignItems: "center",
      justifyContent: "center",
    },
    footerLoader: {
      paddingVertical: 24,
    },
    errorText: {
      color: REELS_ON_DARK_TEXT,
      fontSize: 15,
    },
  });
}
