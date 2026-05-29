import { useCommentsSheet } from "@/hooks/use-comment-sheet";
import { useShareSheet } from "@/hooks/use-share-sheet";
import { useTrackPostView } from "@/src/features/post/post.hooks";
import { videoManager } from "@/src/lib/video-manager";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ViewToken, ViewabilityConfig } from "react-native";

type UseFeedControllerOptions = {
  postIds: number[];
  isTabActive?: boolean;
  viewabilityConfig?: ViewabilityConfig;
  onScreenBlur?: () => void;
};

const DEFAULT_VIEWABILITY: ViewabilityConfig = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 100,
};
const STRICT_OFFSCREEN_VIEWABILITY: ViewabilityConfig = {
  itemVisiblePercentThreshold: 1,
  minimumViewTime: 0,
};

export function useFeedController({
  postIds,
  isTabActive = true,
  viewabilityConfig = DEFAULT_VIEWABILITY,
  onScreenBlur,
}: UseFeedControllerOptions) {
  const [visiblePostId, setVisiblePostId] = useState<number | null>(null);
  const [isScreenFocused, setIsScreenFocused] = useState(true);

  const visiblePostIdRef = useRef<number | null>(null);
  const visibleFeedIndexRef = useRef<number>(-1);
  const isScreenFocusedRef = useRef(true);

  const trackPostView = useTrackPostView();
  const trackPostViewRef = useRef(trackPostView);
  trackPostViewRef.current = trackPostView;

  const commentsSheet = useCommentsSheet();
  const shareSheet = useShareSheet();

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
        videoManager.pauseAll();
        onScreenBlur?.();
      };
    }, [onScreenBlur]),
  );

  useEffect(() => {
    if (!isTabActive) {
      setVisiblePostId(null);
      videoManager.pauseAll();
    }
  }, [isTabActive]);

  const effectiveVisiblePostId = isTabActive ? visiblePostId : null;
  const effectiveIsScreenFocused = isTabActive && isScreenFocused;

  const visibleFeedIndex = useMemo(() => {
    if (effectiveVisiblePostId == null) return -1;
    return postIds.indexOf(effectiveVisiblePostId);
  }, [effectiveVisiblePostId, postIds]);

  visiblePostIdRef.current = effectiveVisiblePostId;
  visibleFeedIndexRef.current = visibleFeedIndex;
  isScreenFocusedRef.current = effectiveIsScreenFocused;

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
          trackPostViewRef.current.mutate(newVisibleId);
        }
        return newVisibleId;
      });
    },
    [isTabActive],
  );

  const onViewableItemsChangedRef = useRef(onViewableItemsChanged);
  onViewableItemsChangedRef.current = onViewableItemsChanged;

  const onStrictVisibilityChanged = useCallback(
    ({ changed }: { changed: ViewToken[] }) => {
      for (const token of changed) {
        if (token.isViewable) continue;
        const postId = typeof token.item === "number" ? token.item : null;
        if (postId == null) continue;
        videoManager.seekToStart(postId);
      }
    },
    [],
  );

  const onStrictVisibilityChangedRef = useRef(onStrictVisibilityChanged);
  onStrictVisibilityChangedRef.current = onStrictVisibilityChanged;

  const viewabilityConfigCallbackPairs = useRef([
    {
      viewabilityConfig,
      onViewableItemsChanged: (info: {
        viewableItems: ViewToken[];
        changed: ViewToken[];
      }) => onViewableItemsChangedRef.current(info),
    },
    {
      viewabilityConfig: STRICT_OFFSCREEN_VIEWABILITY,
      onViewableItemsChanged: (info: {
        viewableItems: ViewToken[];
        changed: ViewToken[];
      }) => onStrictVisibilityChangedRef.current(info),
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

  return {
    visiblePostId,
    visiblePostIdRef,
    visibleFeedIndex,
    visibleFeedIndexRef,
    isScreenFocused: effectiveIsScreenFocused,
    isScreenFocusedRef,
    viewabilityConfigCallbackPairs,
    getNextPostId,
    commentsSheet,
    shareSheet,
    extraData: useMemo(
      () => ({
        visiblePostId: effectiveVisiblePostId,
        isScreenFocused: effectiveIsScreenFocused,
      }),
      [effectiveVisiblePostId, effectiveIsScreenFocused],
    ),
  };
}
