import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { useShareSheet } from "@/hooks/use-share-sheet";
import { CommentsBottomSheet } from "@/src/components/comments/CommentsBottomSheet";
import FlickItem from "@/src/components/flicks/FlickItem";
import { SharePostBottomSheet } from "@/src/components/share/SharePostBottomSheet";
import {
  fetchFlickById,
  useGetFlicksQuery,
  useGetUserFlicksQuery,
} from "@/src/features/flicks/flicks.hooks";
import { useTrackPostView } from "@/src/features/post/post.hooks";
import { usePostStore } from "@/src/features/post/post.store";
import { videoManager } from "@/src/lib/video-manager";
import type { Post } from "@/src/services/api/api.types";
import { useTheme } from "@/src/theme/ThemeProvider";
import { getMediaType } from "@/src/utils/helpers";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
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

/** Same glass recipe as FlickItem HUD pills — dark translucent + hairline border. */
const FLICK_BACK_GLASS_FILL = "rgba(0,0,0,0.48)";
const FLICK_BACK_GLASS_BORDER = "rgba(255,255,255,0.14)";

const FLICKS_CANVAS = "#000";
const FLICKS_ON_DARK_MUTED = "rgba(255,255,255,0.55)";
const FLICKS_ON_DARK_TEXT = "rgba(255,255,255,0.72)";

/** Fake input bar — always dark; opens comments sheet like the rail control. */
const COMMENT_BAR_FILL = "rgba(255,255,255,0.14)";
const COMMENT_BAR_BORDER = "rgba(255,255,255,0.20)";
const COMMENT_BAR_PLACEHOLDER = "rgba(255,255,255,0.42)";

/** Top band for overlay chrome — matches previous stack header row (~44pt) + touch target. */
const FLICK_TOP_CHROME = 44;

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
      />
    </View>
  );
});

function FlickBackGlassOverlay({
  topInset,
  onPress,
}: {
  topInset: number;
  onPress: () => void;
}) {
  return (
    <View style={flickBackGlassStyles.overlay} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={onPress}
        style={({ pressed }) => [
          flickBackGlassStyles.glassBtn,
          {
            top: topInset + 6,
            left: 12,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const flickBackGlassStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
    zIndex: 100,
    elevation: 100,
  },
  glassBtn: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: FLICK_BACK_GLASS_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FLICK_BACK_GLASS_BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
});

function FlickCommentInputBar({
  bottomInset,
  onPress,
}: {
  bottomInset: number;
  onPress: () => void;
}) {
  return (
    <View
      style={[
        flickCommentBarStyles.wrap,
        {
          paddingBottom: 20,
        },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a comment"
        onPress={onPress}
        style={({ pressed }) => [
          flickCommentBarStyles.field,
          { opacity: pressed ? 0.88 : 1 },
        ]}
      >
        <Text style={flickCommentBarStyles.placeholder}>Add a comment...</Text>
      </Pressable>
    </View>
  );
}

const flickCommentBarStyles = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  field: {
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: "center",
    backgroundColor: COMMENT_BAR_FILL,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COMMENT_BAR_BORDER,
  },
  placeholder: {
    fontSize: 16,
    color: COMMENT_BAR_PLACEHOLDER,
  },
});

export default function FeedFlickScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createFlicksStyles(), []);

  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    postId: string | string[];
    userId?: string | string[];
  }>();
  const rawPostId = params.postId;
  const rawUserId = params.userId;

  const postIdStr =
    typeof rawPostId === "string"
      ? rawPostId
      : Array.isArray(rawPostId)
        ? rawPostId[0]
        : undefined;
  const userIdStr =
    typeof rawUserId === "string"
      ? rawUserId
      : Array.isArray(rawUserId)
        ? rawUserId[0]
        : undefined;

  const routePostId = postIdStr != null ? Number(postIdStr) : NaN;
  const routeUserId = userIdStr != null ? Number(userIdStr) : undefined;
  const routeIdValid = Number.isFinite(routePostId) && routePostId > 0;
  const routeUserIdValid =
    routeUserId != null && Number.isFinite(routeUserId) && routeUserId > 0;

  const [anchorId, setAnchorId] = useState<number | null>(null);
  const [anchorLoading, setAnchorLoading] = useState(routeIdValid);
  const [anchorError, setAnchorError] = useState(false);

  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const onViewportLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setViewport({ w: width, h: height });
  }, []);

  const screen = Dimensions.get("screen");
  const flickWidth = viewport.w > 0 ? viewport.w : screen.width;
  const flickHeightRaw =
    viewport.h > 0 ? viewport.h : Math.max(1, screen.height);
  const flickHeight = PixelRatio.roundToNearestPixel(flickHeightRaw);

  const safeTopInset = insets.top + FLICK_TOP_CHROME;

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

  // Branch between user-scoped and explore queries based on userId presence
  const userQuery = useGetUserFlicksQuery(routeUserId, {
    instanceKey: routeIdValid ? routePostId : "__invalid__",
    extraExcludeIds: routeIdValid ? [routePostId] : [],
    enabled: routeIdValid && routeUserIdValid,
  });

  const exploreQuery = useGetFlicksQuery("explore", {
    instanceKey: routeIdValid ? routePostId : "__invalid__",
    extraExcludeIds: routeIdValid ? [routePostId] : [],
    enabled: routeIdValid && !routeUserIdValid,
  });

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError } =
    routeUserIdValid ? userQuery : exploreQuery;

  const feedPostIds = useMemo(
    () => data?.pages.flatMap((page) => page.data.posts) ?? [],
    [data?.pages],
  );

  const postIds = useMemo(() => {
    if (anchorId == null) return [];
    return [anchorId, ...feedPostIds.filter((id) => id !== anchorId)];
  }, [anchorId, feedPostIds]);

  const postIdsRef = useRef(postIds);
  postIdsRef.current = postIds;
  const focusedIndexRef = useRef(focusedIndex);
  focusedIndexRef.current = focusedIndex;

  useEffect(() => {
    if (!routeIdValid) return;

    let cancelled = false;
    setAnchorLoading(true);
    setAnchorError(false);

    fetchFlickById(routePostId)
      .then((post) => {
        if (cancelled) return;
        setAnchorId(post.id);
        setFocusedIndex(0);
      })
      .catch(() => {
        if (!cancelled) setAnchorError(true);
      })
      .finally(() => {
        if (!cancelled) setAnchorLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [routePostId, routeIdValid]);

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
          safeTopInset={safeTopInset}
          isFocused={isFocused}
          inFlickWindow={inWindow}
          isScreenFocused={isScreenFocused}
          nextPostId={nextPostId}
          openComments={openComments}
          openShare={openShare}
        />
      );
    },
    [
      postIds,
      flickHeight,
      flickWidth,
      safeTopInset,
      isScreenFocused,
      focusedIndex,
      openComments,
      openShare,
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

  useLayoutEffect(() => {
    if (anchorId == null) return;
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, [anchorId]);

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

  const listEmpty =
    !anchorLoading && anchorId != null && postIds.length === 0 ? (
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
        <Text style={styles.errorText}>No flicks</Text>
      </View>
    ) : null;

  const onBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)");
  }, []);

  const currentCommentPostId = useMemo(() => {
    if (postIds.length === 0) return null;
    const idx = Math.min(Math.max(focusedIndex, 0), postIds.length - 1);
    return postIds[idx];
  }, [postIds, focusedIndex]);

  const onCommentBarPress = useCallback(() => {
    if (currentCommentPostId == null) return;
    openComments(currentCommentPostId);
  }, [currentCommentPostId, openComments]);

  if (!routeIdValid || anchorError) {
    return (
      <View style={styles.flicksOuter}>
        <StatusBar style="light" />
        <FlickBackGlassOverlay topInset={insets.top} onPress={onBack} />
        <View style={[styles.centered, styles.flicksViewportFlex]}>
          <Text style={styles.errorText}>Couldn&apos;t open this flick</Text>
        </View>
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

  if (isError && postIds.length === 0 && !anchorLoading) {
    return (
      <View style={styles.flicksOuter}>
        <StatusBar style="light" />
        <FlickBackGlassOverlay topInset={insets.top} onPress={onBack} />
        <View style={[styles.centered, styles.flicksViewportFlex]}>
          <Text style={styles.errorText}>Couldn&apos;t load flicks</Text>
        </View>
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
      <StatusBar style="light" />
      <FlickBackGlassOverlay topInset={insets.top} onPress={onBack} />
      <View style={styles.flicksMainColumn}>
        <View
          style={[
            styles.flicksViewportFlex,
            { backgroundColor: FLICKS_CANVAS },
          ]}
          onLayout={onViewportLayout}
        >
          {anchorLoading && postIds.length === 0 ? (
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
              ListEmptyComponent={listEmpty}
              showsVerticalScrollIndicator={false}
              decelerationRate="fast"
              disableIntervalMomentum
              snapToAlignment="start"
              snapToInterval={flickHeight}
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

        {currentCommentPostId != null && !anchorLoading && (
          <FlickCommentInputBar
            bottomInset={insets.bottom}
            onPress={onCommentBarPress}
          />
        )}
      </View>

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
    flicksMainColumn: {
      flex: 1,
      flexDirection: "column",
    },
    flicksViewportFlex: {
      flex: 1,
      overflow: "hidden",
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
