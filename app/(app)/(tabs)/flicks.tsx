import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { useShareSheet } from "@/hooks/use-share-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import FlickItem from "@/src/components/flicks/FlickItem";
import { SharePostBottomSheet } from "@/src/components/share/SharePostBottomSheet";
import {
  type FlicksFeed,
  useGetFlicksQuery,
} from "@/src/features/flicks/flicks.hooks";
import {
  useDeletePostMutation,
  useTrackPostView,
} from "@/src/features/post/post.hooks";
import { usePostStore } from "@/src/features/post/post.store";
import { videoManager } from "@/src/lib/video-manager";
import type { Post, PossibleErrorResponse } from "@/src/services/api/api.types";
import { isAxiosError } from "axios";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
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
  itemVisiblePercentThreshold: 80,
  minimumViewTime: 200,
};

const PRELOAD_RADIUS = 1;

/** Full-bleed flick canvas (not theme.background — avoids white bars in light mode). */
const FLICKS_CANVAS = "#000";
/** Flicks tab is always dark chrome; muted text/icons on black (ignores light app theme). */
const FLICKS_ON_DARK_MUTED = "rgba(255,255,255,0.55)";
const FLICKS_ON_DARK_TEXT = "rgba(255,255,255,0.72)";

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
function flickPreloadTarget(post: Post | undefined): {
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
  openShare: (postId: number) => void;
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
  openShare,
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
        onOpenShare={() => openShare(id)}
        onDeleteFlick={onDeleteFlick}
      />
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
    refetch,
  } = useGetFlicksQuery(feedTab);

  const postIds = useMemo(
    () => data?.pages.flatMap((page) => page.data.posts) ?? [],
    [data?.pages],
  );

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
          const msg =
            isAxiosError(err) && err.response?.data
              ? (err.response.data as PossibleErrorResponse).message
              : "Could not delete this post.";
          Alert.alert("Error", msg);
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

    const p = flickPreloadTarget(prevPost);
    const n = flickPreloadTarget(nextPost);
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
      const prevIndex = focusedIndexRef.current;
      if (index < prevIndex) {
        const ids = postIdsRef.current;
        const id = ids[index];
        if (id != null) {
          videoManager.seekToStart(id);
        }
      }
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
          openShare={openShare}
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
      openShare,
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
    },
    [flickHeight],
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
