import { useManagedVideoPlayer } from "@/hooks/use-video-player";
import ReportModal from "@/src/components/home/posts/ReportModal";
import StoryAvatar from "@/src/components/home/story/StoryAvatar";
import RichText from "@/src/components/ui/rich-text";
import {
  useBookmarkPostMutation,
  useDeletePostMutation,
  useToggleLikeMutation,
} from "@/src/features/post/post.hooks";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import type { PossibleErrorResponse, Post } from "@/src/services/api/api.types";
import { getMediaType } from "@/src/utils/helpers";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import Feather from "@expo/vector-icons/Feather";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { isAxiosError } from "axios";
import { VideoView, type VideoContentFit } from "expo-video";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  findNodeHandle,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DOUBLE_TAP_DELAY = 300;
/** Play / mute HUD visibility after single tap (ms). */
const FLICK_TOOLS_HIDE_MS = 1000;

/** Edge-to-edge flick surface — always black so letterboxing matches TikTok/IG (not theme.background). */
const FLICKS_CANVAS = "#000";

/** Overlay chrome on video: fixed light palette (avoid theme textPrimary = black on dark flicks). */
const FLICK_TEXT = "#FFFFFF";
const FLICK_TEXT_MUTED = "rgba(255,255,255,0.72)";
const FLICK_ACCENT = "#FF4D67";
const FLICK_PAYWALL_GRADIENT_DIM: [string, string] = [
  "rgba(24, 18, 38, 0.94)",
  "rgba(0, 0, 0, 0.92)",
];
const FLICK_PAYWALL_BADGE_GRADIENT: [string, string, string] = [
  "#4A3A6B",
  "#2A1F40",
  "#151018",
];
const FLICK_UI_SPACING = { sm: 8, md: 16, lg: 20, xl: 24 } as const;
const FLICK_UI_RADIUS = { pill: 999 } as const;

/** Right rail: glass circles + equal vertical gaps (like / comment / share / menu). */
const FLICK_ACTION_GLASS_SIZE = 48;
const FLICK_ACTION_GLASS_GAP = 12;
const FLICK_MENU_WIDTH = 188;
/** Horizontal space reserved beside the action rail so captions don’t slide under icons. */
const FLICK_CAPTION_RAIL_GUTTER = 64;

/**
 * Landscape videos: use cover only if center-crop still shows at least this fraction
 * of the source frame on the worst axis (otherwise contain + letterboxing).
 */
const FIT_COVER_THRESHOLD = 0.78;

/** Under object-fit:cover with scale s = max(W/vw,H/vh), visible fraction on each axis. */
function coverVisibleMinFrac(
  W: number,
  H: number,
  vw: number,
  vh: number,
): number {
  const s = Math.max(W / vw, H / vh);
  return Math.min(W / (vw * s), H / (vh * s));
}

function chooseContentFit(
  W: number,
  H: number,
  vw?: number | null,
  vh?: number | null,
): VideoContentFit {
  if (!vw || !vh || vw <= 0 || vh <= 0 || W <= 0 || H <= 0) return "cover";
  if (vw <= vh) return "cover";
  const visibleMin = coverVisibleMinFrac(W, H, vw, vh);
  return visibleMin >= FIT_COVER_THRESHOLD ? "cover" : "contain";
}

type PostMediaViewer = Post["viewer"];

function viewerCanViewPostMedia(
  viewer: PostMediaViewer | undefined,
  price: number,
  isExclusive: boolean,
): boolean {
  if (viewer?.is_owner === true) return true;
  if (price > 0 && !viewer?.has_purchased) return false;
  if (isExclusive && !viewer?.has_subscription) return false;
  return true;
}

function parseDuration(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(/[^\d.]/g, ""));
    return n > 0 ? n : null;
  }
  return null;
}

/** Display mm:ss (or h:mm:ss for long clips). */
function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type FlickItemProps = {
  post: Post;
  /** Visible viewport height (full window minus tab bar, including under status bar). */
  itemHeight: number;
  /** Visible viewport width (full window width). */
  itemWidth: number;
  /** Top safe inset — overlays only; video uses full item size. */
  safeTopInset: number;
  isFocused: boolean;
  isScreenFocused: boolean;
  inFlickWindow: boolean;
  nextPost?: Post | null;
  onOpenComments: () => void;
  onOpenShare: () => void;
  /**
   * When provided (feed context): the parent screen handles scroll-then-delete.
   * When absent (detail route): falls back to the local mutation + router.back().
   */
  onDeleteFlick?: (postId: number) => void;
};

function FlickItemInner({
  post,
  itemHeight,
  itemWidth,
  safeTopInset,
  isFocused,
  isScreenFocused,
  inFlickWindow,
  nextPost,
  onOpenComments,
  onOpenShare,
  onDeleteFlick,
}: FlickItemProps) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(itemHeight, safeTopInset, insets.bottom),
    [itemHeight, safeTopInset, insets.bottom],
  );

  const videoFrameSize = useMemo(
    () => ({ width: itemWidth, height: itemHeight }),
    [itemWidth, itemHeight],
  );
  const { data: profileData } = useGetProfile();
  const me = profileData?.data;

  const attachment = post.attachments[0];
  const media = attachment?.path ?? "";
  const thumbnail = attachment?.thumbnail;
  const fullDuration = attachment?.duration;
  const type = getMediaType(attachment?.type ?? "");

  const price = post.price ?? 0;
  const isExclusive = post.is_exclusive ?? false;
  const viewer = post.viewer;

  const canView = useMemo(
    () => viewerCanViewPostMedia(viewer, price, isExclusive),
    [viewer, price, isExclusive],
  );

  const isPaidVideo =
    !canView && type === "video" && (price > 0 || isExclusive);
  const showVideoBlockPaywall = !canView && type === "video" && !isPaidVideo;

  const parsedDuration = parseDuration(fullDuration);

  const [previewEnded, setPreviewEnded] = useState(false);
  const previewEndedRef = useRef(false);

  const videoUrlForPlayer =
    type === "video" && inFlickWindow && media && (canView || isPaidVideo)
      ? media
      : null;

  const nextVideoInfo = useMemo(() => {
    if (!nextPost?.attachments?.[0]) return null;
    const nextMedia = nextPost.attachments[0];
    if (getMediaType(nextMedia.type) !== "video") return null;
    return { postId: nextPost.id, url: nextMedia.path };
  }, [nextPost]);

  const focusForPlayback = isFocused && isScreenFocused && !previewEnded;

  const {
    player,
    isReady,
    isBuffering,
    isPlaying,
    isMuted,
    toggleMute,
    togglePlayPause,
    pause,
    play,
  } = useManagedVideoPlayer(
    post.id,
    videoUrlForPlayer,
    focusForPlayback,
    nextVideoInfo?.url,
    nextVideoInfo?.postId,
  );

  const progress = useSharedValue(0);
  const isScrubbing = useSharedValue(false);
  const progressBarWidth = useSharedValue(0);
  const maxProgressRatio = useSharedValue(1);

  const [timeUi, setTimeUi] = useState({ current: 0, total: 0 });

  /**
   * Persistent pause HUD is only shown after the user explicitly taps to pause.
   * Loop boundaries (loop=true → brief playing:false→true) and seekToStart on focus
   * would otherwise flicker the HUD into view, which we don't want.
   */
  const [userPaused, setUserPaused] = useState(false);
  useEffect(() => {
    setUserPaused(false);
  }, [post.id]);
  useEffect(() => {
    if (isPlaying && userPaused) setUserPaused(false);
  }, [isPlaying, userPaused]);
  useEffect(() => {
    if (!isFocused) setUserPaused(false);
  }, [isFocused]);

  const [videoSourceSize, setVideoSourceSize] = useState<{
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    if (!player) {
      setVideoSourceSize(null);
      return;
    }
    const sync = () => {
      try {
        const t = player.videoTrack;
        const w = t?.size?.width ?? 0;
        const h = t?.size?.height ?? 0;
        if (w > 0 && h > 0) {
          setVideoSourceSize((prev) =>
            prev?.w === w && prev?.h === h ? prev : { w, h },
          );
        }
      } catch {
        /* native player */
      }
    };
    sync();
    const sub = player.addListener("statusChange" as any, sync);
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (!player || !isReady) return;
    try {
      const t = player.videoTrack;
      const w = t?.size?.width ?? 0;
      const h = t?.size?.height ?? 0;
      if (w > 0 && h > 0) {
        setVideoSourceSize((prev) =>
          prev?.w === w && prev?.h === h ? prev : { w, h },
        );
      }
    } catch {
      /* native player */
    }
  }, [player, isReady]);

  const videoContentFit = useMemo(
    () =>
      chooseContentFit(
        itemWidth,
        itemHeight,
        videoSourceSize?.w,
        videoSourceSize?.h,
      ),
    [itemWidth, itemHeight, videoSourceSize?.w, videoSourceSize?.h],
  );

  const seekTo = useCallback(
    (value: number) => {
      if (!player?.duration) return;

      if (isPaidVideo && parsedDuration) {
        const cap = player.duration;
        const targetTime = Math.min(value * parsedDuration, cap);
        player.currentTime = targetTime;
        progress.value = targetTime / parsedDuration;

        const reachedEnd = targetTime >= cap - 0.08;
        if (reachedEnd) {
          pause();
          if (!previewEndedRef.current) {
            previewEndedRef.current = true;
            setPreviewEnded(true);
          }
        } else if (previewEndedRef.current) {
          previewEndedRef.current = false;
          setPreviewEnded(false);
        }
      } else {
        player.currentTime = value * player.duration;
        progress.value = value;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [player, isPaidVideo, parsedDuration, pause, progress],
  );

  const syncTimeLabelFromRatio = useCallback(
    (ratio: number) => {
      const total =
        isPaidVideo && parsedDuration
          ? parsedDuration
          : (player?.duration ?? 0);
      if (total <= 0) return;
      let cur = ratio * total;
      if (isPaidVideo && parsedDuration && player?.duration) {
        cur = Math.min(cur, player.duration);
      }
      setTimeUi({ current: cur, total });
    },
    [isPaidVideo, parsedDuration, player?.duration],
  );

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * progressBarWidth.value - 6 },
      { scale: withTiming(isScrubbing.value ? 1.35 : 1) },
    ],
  }));

  const lockedSegmentStyle = useAnimatedStyle(() => {
    const ratio = maxProgressRatio.value;
    return {
      left: `${ratio * 100}%`,
      width: `${(1 - ratio) * 100}%`,
      opacity: ratio < 1 ? 1 : 0,
    };
  });

  const tapSeekGesture = Gesture.Tap()
    .maxDistance(14)
    .onEnd((e) => {
      "worklet";
      const w = progressBarWidth.value;
      if (w <= 0) return;
      const raw = Math.max(0, Math.min(e.x / w, 1));
      const clamped =
        maxProgressRatio.value < 1
          ? Math.min(raw, maxProgressRatio.value)
          : raw;
      progress.value = clamped;
      runOnJS(syncTimeLabelFromRatio)(clamped);
      runOnJS(seekTo)(clamped);
    });

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-20, 20])
    .onBegin(() => {
      isScrubbing.value = true;
    })
    .onUpdate((e) => {
      const w = progressBarWidth.value;
      if (w <= 0) return;
      const raw = Math.max(0, Math.min(e.x / w, 1));
      const clamped =
        maxProgressRatio.value < 1
          ? Math.min(raw, maxProgressRatio.value)
          : raw;
      progress.value = clamped;
      runOnJS(syncTimeLabelFromRatio)(clamped);
    })
    .onEnd(() => {
      runOnJS(seekTo)(progress.value);
    })
    .onFinalize(() => {
      isScrubbing.value = false;
    });

  const seekBarGesture = Gesture.Simultaneous(tapSeekGesture, panGesture);

  useEffect(() => {
    progress.value = 0;
    maxProgressRatio.value = 1;
    setTimeUi({ current: 0, total: 0 });
  }, [post.id, progress, maxProgressRatio]);

  const isLiked = post.user_reaction === "love";
  const { mutate: toggleLike } = useToggleLikeMutation();
  const bookmarkPost = useBookmarkPostMutation();
  const deletePostMutation = useDeletePostMutation();

  const [flickMenuOpen, setFlickMenuOpen] = useState(false);
  const [flickReportOpen, setFlickReportOpen] = useState(false);
  const [flickMenuPos, setFlickMenuPos] = useState({ top: 0, left: 0 });
  const flickMenuBtnRef = useRef<View>(null);

  const closeFlickMenu = useCallback(() => setFlickMenuOpen(false), []);

  const openFlickMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const node = flickMenuBtnRef.current;
    if (!node) return;
    const handle = findNodeHandle(node);
    if (!handle) return;
    UIManager.measureInWindow(handle, (x, y, width, height) => {
      const screenW = Dimensions.get("window").width;
      const left = Math.min(
        Math.max(8, x + width - FLICK_MENU_WIDTH),
        screenW - FLICK_MENU_WIDTH - 8,
      );
      setFlickMenuPos({
        top: y + height + 6,
        left,
      });
      setFlickMenuOpen(true);
    });
  }, []);

  const onBookmarkFromMenu = useCallback(() => {
    closeFlickMenu();
    bookmarkPost.mutate({
      postId: post.id,
      action: post.is_bookmarked ? "remove" : "add",
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [bookmarkPost, closeFlickMenu, post.id, post.is_bookmarked]);

  const onReportFromMenu = useCallback(() => {
    closeFlickMenu();
    setFlickReportOpen(true);
  }, [closeFlickMenu]);

  const onDeleteFromMenu = useCallback(() => {
    closeFlickMenu();
    if (me?.id !== post.user?.id) return;
    Alert.alert("Delete post?", "This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          if (onDeleteFlick) {
            // Feed context: parent handles scroll-then-delete for smooth UX.
            onDeleteFlick(post.id);
          } else {
            // Detail route fallback: fire mutation directly then navigate back.
            deletePostMutation.mutate(post.id, {
              onSuccess: (data) => {
                Alert.alert("Deleted", data.message, [
                  {
                    text: "OK",
                    onPress: () => {
                      if (router.canGoBack()) router.back();
                    },
                  },
                ]);
              },
              onError: (err: unknown) => {
                const msg =
                  isAxiosError(err) && err.response?.data
                    ? (err.response.data as PossibleErrorResponse).message
                    : "Could not delete this post.";
                Alert.alert("Error", msg);
              },
            });
          }
        },
      },
    ]);
  }, [closeFlickMenu, deletePostMutation, me?.id, onDeleteFlick, post.id, post.user?.id]);

  /** While playing: brief flash after resume/mute. While user-paused: persistent HUD (see `playbackEverStarted` + isReady/!isBuffering). */
  const [playingHudFlash, setPlayingHudFlash] = useState(false);
  const playingHudFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearPlayingHudFlashTimer = useCallback(() => {
    if (playingHudFlashTimerRef.current != null) {
      clearTimeout(playingHudFlashTimerRef.current);
      playingHudFlashTimerRef.current = null;
    }
  }, []);

  /** During playback only: show HUD briefly then hide (after resume or while interacting with mute). */
  const schedulePlayingHudHide = useCallback(() => {
    clearPlayingHudFlashTimer();
    setPlayingHudFlash(true);
    playingHudFlashTimerRef.current = setTimeout(() => {
      setPlayingHudFlash(false);
      playingHudFlashTimerRef.current = null;
    }, FLICK_TOOLS_HIDE_MS);
  }, [clearPlayingHudFlashTimer]);

  useEffect(
    () => () => clearPlayingHudFlashTimer(),
    [clearPlayingHudFlashTimer],
  );

  useEffect(() => {
    if (!isFocused) {
      clearPlayingHudFlashTimer();
      setPlayingHudFlash(false);
    }
  }, [isFocused, clearPlayingHudFlashTimer]);

  useEffect(() => {
    if (!isPlaying) {
      clearPlayingHudFlashTimer();
      setPlayingHudFlash(false);
    }
  }, [isPlaying, clearPlayingHudFlashTimer]);

  const handleMuteFromHud = useCallback(() => {
    toggleMute();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      schedulePlayingHudHide();
    }
  }, [toggleMute, isPlaying, schedulePlayingHudHide]);

  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressingRef = useRef(false);
  const isFocusedRef = useRef(isFocused);
  isFocusedRef.current = isFocused;

  const videoViewMountedRef = useRef(false);
  if (isReady && player) videoViewMountedRef.current = true;
  if (!player) videoViewMountedRef.current = false;

  const showVideoView =
    inFlickWindow &&
    player !== null &&
    (isReady || videoViewMountedRef.current);

  const firstFrameRendered = useRef(false);
  const posterOpacity = useSharedValue(1);

  useEffect(() => {
    if (!isReady) {
      firstFrameRendered.current = false;
      posterOpacity.value = 1;
    }
  }, [isReady, posterOpacity]);

  useEffect(() => {
    const shouldHide = firstFrameRendered.current && isFocused;
    posterOpacity.value = shouldHide ? withTiming(0, { duration: 150 }) : 1;
  }, [isFocused, isPlaying, posterOpacity]);

  const handleFirstFrameRender = useCallback(() => {
    firstFrameRendered.current = true;
    if (isFocusedRef.current) {
      posterOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [posterOpacity]);

  const posterAnimatedStyle = useAnimatedStyle(() => ({
    opacity: posterOpacity.value,
  }));

  useEffect(() => {
    if (!isFocused && previewEndedRef.current) {
      previewEndedRef.current = false;
      setPreviewEnded(false);
    }
  }, [isFocused]);

  useEffect(() => {
    if (!player || !isFocused || !isPaidVideo) return;
    try {
      player.loop = false;
    } catch {
      return;
    }
    const sub = player.addListener("playToEnd" as any, () => {
      pause();
      if (!previewEndedRef.current) {
        previewEndedRef.current = true;
        setPreviewEnded(true);
      }
    });
    return () => {
      sub.remove();
      try {
        player.loop = true;
      } catch {
        /* native object may be gone */
      }
    };
  }, [player, isFocused, isPaidVideo, pause]);

  useEffect(() => {
    if (!player || !isFocused) return;
    try {
      (player as any).timeUpdateEventInterval = 0.12;
    } catch {
      /* ignore */
    }
    const sub = player.addListener(
      "timeUpdate" as any,
      ({ currentTime }: { currentTime: number }) => {
        if (isScrubbing.value) return;
        if (!player.duration) return;

        if (isPaidVideo && parsedDuration) {
          const cap = player.duration;
          maxProgressRatio.value = cap / parsedDuration;

          if (currentTime >= cap - 0.1) {
            pause();
            progress.value = cap / parsedDuration;
            setTimeUi({ current: cap, total: parsedDuration });
            if (!previewEndedRef.current) {
              previewEndedRef.current = true;
              setPreviewEnded(true);
            }
          } else {
            progress.value = currentTime / parsedDuration;
            setTimeUi({
              current: currentTime,
              total: parsedDuration,
            });
          }
        } else {
          progress.value = currentTime / player.duration;
          setTimeUi({
            current: currentTime,
            total: player.duration,
          });
        }
      },
    );
    return () => sub.remove();
  }, [
    player,
    isFocused,
    isPaidVideo,
    parsedDuration,
    pause,
    isScrubbing,
    progress,
    maxProgressRatio,
  ]);

  const triggerHeartAnimation = useCallback(() => {
    heartScale.value = 0.6;
    heartOpacity.value = 1;
    heartScale.value = withSpring(
      1.3,
      { damping: 8, stiffness: 300, mass: 0.5 },
      (finished) => {
        if (finished)
          heartScale.value = withSpring(1, { damping: 10, stiffness: 250 });
      },
    );
    heartOpacity.value = withTiming(0, { duration: 600 }, undefined);
  }, [heartOpacity, heartScale]);

  const handleDoubleTap = useCallback(() => {
    triggerHeartAnimation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLiked) toggleLike(post.id);
  }, [isLiked, post.id, toggleLike, triggerHeartAnimation]);

  const handleSingleTap = useCallback(() => {
    const wasPaused = !isPlaying;
    togglePlayPause();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (wasPaused) {
      schedulePlayingHudHide();
    } else {
      setUserPaused(true);
    }
  }, [togglePlayPause, isPlaying, schedulePlayingHudHide]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      lastTapRef.current = 0;
      handleDoubleTap();
    } else {
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        handleSingleTap();
        singleTapTimerRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  }, [handleDoubleTap, handleSingleTap]);

  const handleLongPressIn = useCallback(() => {
    isLongPressingRef.current = true;
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    if (isPlaying) {
      pause();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [isPlaying, pause]);

  const handleLongPressOut = useCallback(() => {
    if (!isLongPressingRef.current) return;
    isLongPressingRef.current = false;
    if (isFocused && !previewEnded) play();
  }, [isFocused, play, previewEnded]);

  const handlePayPress = useCallback(() => {
    Alert.alert("Coming Soon");
  }, []);

  const handleWatchAgain = useCallback(() => {
    previewEndedRef.current = false;
    setPreviewEnded(false);
    progress.value = 0;
    firstFrameRendered.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (player) {
      try {
        player.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
    if (isFocused) play();
  }, [isFocused, play, player, progress]);

  const navigateToUser = useCallback(() => {
    const user = post.user;
    if (!user) return;
    if (user.id === me?.id) {
      router.push({ pathname: "/(app)/(tabs)/profile" });
      return;
    }
    router.push({
      pathname: "/user/[username]",
      params: { username: user.username },
    });
  }, [me?.id, post.user]);

  const loveCount = post.reactions.find((r) => r.name === "love")?.count ?? 0;

  const [captionExpanded, setCaptionExpanded] = useState(false);
  const captionMaxExpanded = itemHeight * 0.4;

  const user = post.user;
  if (!user) {
    return (
      <View style={[styles.root, { width: itemWidth, height: itemHeight }]}>
        <Text style={styles.fallbackText}>Post unavailable</Text>
      </View>
    );
  }

  if (type !== "video") {
    return (
      <View style={[styles.root, { width: itemWidth, height: itemHeight }]}>
        <Text style={styles.fallbackText}>Not a video</Text>
      </View>
    );
  }

  const captionSource = post.text ?? "";

  const frameW = videoFrameSize.width > 0 ? videoFrameSize.width : itemWidth;
  const frameH = videoFrameSize.height > 0 ? videoFrameSize.height : itemHeight;

  const showFlickHud =
    !showVideoBlockPaywall &&
    videoUrlForPlayer &&
    !previewEnded &&
    isFocused &&
    (playingHudFlash || (userPaused && !isPlaying));

  const seekTotalSeconds =
    isPaidVideo && parsedDuration != null && parsedDuration > 0
      ? parsedDuration
      : (player?.duration ?? 0);

  const showSeekBar =
    !showVideoBlockPaywall &&
    !!videoUrlForPlayer &&
    !previewEnded &&
    isFocused &&
    showVideoView &&
    !!player &&
    isReady &&
    seekTotalSeconds > 0;

  return (
    <View style={[styles.root, { width: itemWidth, height: itemHeight }]}>
      {showVideoBlockPaywall ? (
        <View style={StyleSheet.absoluteFill}>
          <FlickLockedPaywall
            thumbnail={thumbnail}
            price={price}
            isExclusive={isExclusive}
            onPay={handlePayPress}
          />
        </View>
      ) : (
        <View style={styles.mediaStage}>
          <View style={[styles.videoFrame, { width: frameW, height: frameH }]}>
            {showVideoView && player && (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <VideoView
                  style={StyleSheet.absoluteFill}
                  player={player}
                  contentFit={videoContentFit}
                  nativeControls={false}
                  allowsPictureInPicture={false}
                  fullscreenOptions={{ enable: false }}
                  useExoShutter={false}
                  onFirstFrameRender={handleFirstFrameRender}
                />
              </View>
            )}

            {thumbnail ? (
              <Animated.View
                style={[StyleSheet.absoluteFill, posterAnimatedStyle]}
                pointerEvents="none"
              >
                <Image
                  source={{ uri: thumbnail }}
                  style={StyleSheet.absoluteFill}
                  contentFit={videoContentFit}
                  cachePolicy="disk"
                  transition={0}
                />
              </Animated.View>
            ) : (
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.posterFallback,
                  posterAnimatedStyle,
                ]}
                pointerEvents="none"
              />
            )}

            {isFocused &&
              (isBuffering || !isReady) &&
              !showVideoBlockPaywall && (
                <View style={styles.loadingOverlay} pointerEvents="none">
                  <ActivityIndicator size="large" color={FLICK_TEXT} />
                </View>
              )}
          </View>
        </View>
      )}

      {/* Tap zone — fullscreen; overlays use higher z-index */}
      {!showVideoBlockPaywall && videoUrlForPlayer && (
        <Pressable
          style={styles.tapZone}
          onPress={handleTap}
          onLongPress={handleLongPressIn}
          onPressOut={handleLongPressOut}
          delayLongPress={200}
        />
      )}

      {showFlickHud && (
        <View style={styles.flickToolsOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.flickToolsCenterHit}
            onPress={() => {
              const wasPaused = !isPlaying;
              togglePlayPause();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (wasPaused) {
                schedulePlayingHudHide();
              } else {
                setUserPaused(true);
              }
            }}
            hitSlop={32}
          >
            <View style={styles.flickToolsPlayGlass}>
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={48}
                color="#fff"
                style={styles.flickToolsPlayIcon}
              />
            </View>
          </Pressable>
          <Pressable
            accessibilityLabel={isMuted ? "Unmute" : "Mute"}
            style={[styles.flickToolsMuteBtn, { bottom: 10, right: 10 }]}
            onPress={handleMuteFromHud}
            hitSlop={12}
          >
            <View style={styles.flickToolsVolumeGlass}>
              <Ionicons
                name={isMuted ? "volume-mute" : "volume-high"}
                size={26}
                color="#fff"
                style={styles.flickToolsHudIconShadow}
              />
            </View>
          </Pressable>
        </View>
      )}

      {previewEnded && isPaidVideo && isFocused && (
        <View
          style={[StyleSheet.absoluteFill, styles.previewEndWrap]}
          pointerEvents="box-none"
        >
          <LinearGradient
            colors={FLICK_PAYWALL_GRADIENT_DIM}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[StyleSheet.absoluteFill, styles.previewEndGradient]}
          >
            <FlickPaywallContent
              price={price}
              isExclusive={isExclusive}
              onPay={handlePayPress}
              onWatchAgain={handleWatchAgain}
            />
          </LinearGradient>
        </View>
      )}

      <Animated.View
        style={[styles.heartBurst, heartAnimatedStyle]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={120} color={FLICK_ACCENT} />
      </Animated.View>

      {/* Right actions — glass circles + equal gaps; menu opens bookmark / report */}
      <View style={styles.rightActions} pointerEvents="box-none">
        <View style={styles.actionColumn}>
          <Pressable
            style={styles.actionGlass}
            onPress={() => {
              toggleLike(post.id);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={8}
          >
            <FontAwesome
              name={isLiked ? "heart" : "heart-o"}
              size={24}
              color={isLiked ? FLICK_ACCENT : FLICK_TEXT}
            />
          </Pressable>
          {loveCount > 0 && <Text style={styles.actionCount}>{loveCount}</Text>}
        </View>

        <View style={styles.actionColumn}>
          <Pressable
            style={styles.actionGlass}
            onPress={() => {
              onOpenComments();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={8}
          >
            <Feather name="message-circle" size={24} color={FLICK_TEXT} />
          </Pressable>
          {post.comments_count > 0 && (
            <Text style={styles.actionCount}>{post.comments_count}</Text>
          )}
        </View>

        <View style={styles.actionColumn}>
          <Pressable
            style={styles.actionGlass}
            onPress={() => {
              onOpenShare();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={8}
          >
            <Feather name="send" size={22} color={FLICK_TEXT} />
          </Pressable>
        </View>

        <View style={styles.actionColumn}>
          <View ref={flickMenuBtnRef} collapsable={false}>
            <Pressable
              style={styles.actionGlass}
              onPress={openFlickMenu}
              hitSlop={8}
            >
              <Ionicons
                name="ellipsis-horizontal"
                size={22}
                color={FLICK_TEXT}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <Modal
        transparent
        visible={flickMenuOpen}
        animationType="fade"
        onRequestClose={closeFlickMenu}
      >
        <View style={styles.flickMenuModalRoot} pointerEvents="box-none">
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeFlickMenu}
            accessibilityLabel="Dismiss menu"
          />
          <View
            style={[
              styles.flickMenuCard,
              { top: flickMenuPos.top, left: flickMenuPos.left },
            ]}
            accessibilityViewIsModal
          >
            <TouchableOpacity
              style={styles.flickMenuRow}
              onPress={onBookmarkFromMenu}
              activeOpacity={0.7}
            >
              <Ionicons
                name={post.is_bookmarked ? "bookmark" : "bookmark-outline"}
                size={20}
                color={FLICK_TEXT}
              />
              <Text style={styles.flickMenuLabel}>
                {post.is_bookmarked ? "Saved" : "Bookmark"}
              </Text>
            </TouchableOpacity>
            {me?.id === user.id && (
              <>
                <View style={styles.flickMenuDivider} />
                <TouchableOpacity
                  style={styles.flickMenuRow}
                  onPress={onDeleteFromMenu}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF8A80" />
                  <Text
                    style={[
                      styles.flickMenuLabel,
                      styles.flickMenuLabelDanger,
                    ]}
                  >
                    Delete
                  </Text>
                </TouchableOpacity>
              </>
            )}
            <View style={styles.flickMenuDivider} />
            <TouchableOpacity
              style={styles.flickMenuRow}
              onPress={onReportFromMenu}
              activeOpacity={0.7}
            >
              <Ionicons name="flag-outline" size={20} color="#FF8A80" />
              <Text
                style={[styles.flickMenuLabel, styles.flickMenuLabelDanger]}
              >
                Report
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ReportModal
        visible={flickReportOpen}
        onClose={() => setFlickReportOpen(false)}
        postId={post.id}
        userId={user.id}
      />

      {/* Bottom: profile + caption (inset from action rail); full-width seek bar with horizontal padding */}
      <View
        style={[styles.bottomStack, { width: itemWidth }]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.bottomCaptionCluster,
            // Fixed width: `alignSelf` was `flex-start`, which shrink-wrapped to ~90px
            // despite `bottomStack` being full width (logs: bottomW 440 vs cluster w 90).
            // Reserve `marginRight` (rail) so title/handle use the remaining band.
            { width: Math.max(0, itemWidth - FLICK_CAPTION_RAIL_GUTTER) },
          ]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={navigateToUser}
            style={styles.bottomProfileRow}
            accessibilityRole="button"
            accessibilityLabel={`${user.name}, @${user.username}`}
          >
            <View style={styles.avatarCompactWrap}>
              <StoryAvatar
                username={user.username}
                hasStory={user.story_status?.has_stories ?? false}
                seen={user.story_status?.all_viewed ?? true}
                uri={user.avatar}
              />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.displayNameBottom} numberOfLines={1}>
                {user.name} {__DEV__ ? `POST_ID: ${post.id}` : ""}
              </Text>
              <Text style={styles.handleBottom} numberOfLines={1}>
                @{user.username}
              </Text>
            </View>
          </Pressable>

          {captionExpanded ? (
            <ScrollView
              style={{ maxHeight: captionMaxExpanded }}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <RichText style={styles.captionText}>{captionSource}</RichText>
              <Pressable onPress={() => setCaptionExpanded(false)}>
                <Text style={styles.moreText}>Show less</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <>
              <RichText style={styles.captionText} numberOfLines={2}>
                {captionSource}
              </RichText>
              {captionSource.replace(/<[^>]+>/g, "").trim().length > 90 && (
                <Pressable onPress={() => setCaptionExpanded(true)}>
                  <Text style={styles.moreText}>More</Text>
                </Pressable>
              )}
            </>
          )}
        </View>

        {showSeekBar && (
          <View style={styles.seekBarFullWidth} pointerEvents="box-none">
            <View style={styles.seekBlock}>
              <Text style={styles.seekTimeText}>
                {formatPlaybackTime(timeUi.current)} /{" "}
                {formatPlaybackTime(timeUi.total)}
              </Text>
              <GestureDetector gesture={seekBarGesture}>
                <View
                  style={styles.seekTrackWrap}
                  hitSlop={{ top: 14, bottom: 14 }}
                  onLayout={(e) => {
                    progressBarWidth.value = e.nativeEvent.layout.width;
                  }}
                >
                  <View style={styles.seekTrackInner}>
                    <Animated.View style={[styles.seekFill, progressStyle]} />
                    <Animated.View
                      style={[styles.seekLockedSegment, lockedSegmentStyle]}
                    />
                  </View>
                  <Animated.View
                    style={[styles.seekThumb, thumbAnimatedStyle]}
                  />
                </View>
              </GestureDetector>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function FlickLockedPaywall({
  thumbnail,
  price,
  isExclusive,
  onPay,
}: {
  thumbnail?: string;
  price: number;
  isExclusive: boolean;
  onPay: () => void;
}) {
  const locked = useMemo(() => createLockedPaywallStyles(), []);
  return (
    <View style={StyleSheet.absoluteFill}>
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: FLICKS_CANVAS }]}
        />
      )}
      <LinearGradient
        colors={FLICK_PAYWALL_GRADIENT_DIM}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, locked.gradientDim]}
      >
        <View style={locked.center}>
          <Ionicons name="lock-closed" size={48} color={FLICK_TEXT} />
          <Text style={locked.title}>Exclusive content</Text>
          <Pressable onPress={onPay} style={locked.unlockBtn}>
            <Text style={locked.unlockText}>Unlock</Text>
          </Pressable>
          {price > 0 && <Text style={locked.price}>${price.toFixed(2)}</Text>}
          {isExclusive && (
            <Text style={locked.hint}>Subscription required</Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

function FlickPaywallContent({
  price,
  isExclusive,
  onPay,
  onWatchAgain,
}: {
  price: number;
  isExclusive: boolean;
  onPay: () => void;
  onWatchAgain: () => void;
}) {
  const locked = useMemo(() => createLockedPaywallStyles(), []);
  return (
    <View style={locked.previewContent}>
      <LinearGradient
        colors={FLICK_PAYWALL_BADGE_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={locked.lockBadge}
      >
        <Ionicons name="lock-closed" size={28} color={FLICK_TEXT} />
      </LinearGradient>
      <Text style={locked.previewTitle}>Preview ended</Text>
      <Text style={locked.previewSub}>
        Unlock for full access to this flick.
      </Text>
      {price > 0 && <Text style={locked.price}>${price.toFixed(2)}</Text>}
      <Pressable onPress={onPay} style={locked.unlockBtn}>
        <Text style={locked.unlockText}>Unlock now</Text>
      </Pressable>
      <Pressable onPress={onWatchAgain} style={locked.watchAgain}>
        <Ionicons name="refresh" size={18} color={FLICK_TEXT} />
        <Text style={locked.watchAgainText}>Watch again</Text>
      </Pressable>
      {isExclusive && (
        <Text style={locked.hint}>Or subscribe for exclusive content</Text>
      )}
    </View>
  );
}

function createLockedPaywallStyles() {
  return StyleSheet.create({
    gradientDim: {
      opacity: 0.92,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: FLICK_UI_SPACING.xl,
    },
    title: {
      color: FLICK_TEXT,
      fontSize: 18,
      fontWeight: "700",
      marginTop: FLICK_UI_SPACING.md,
      textAlign: "center",
    },
    price: {
      color: FLICK_TEXT,
      fontSize: 16,
      marginTop: FLICK_UI_SPACING.sm,
      opacity: 0.95,
    },
    hint: {
      color: FLICK_TEXT_MUTED,
      fontSize: 13,
      marginTop: FLICK_UI_SPACING.sm,
    },
    unlockBtn: {
      marginTop: FLICK_UI_SPACING.lg,
      paddingHorizontal: FLICK_UI_SPACING.xl,
      paddingVertical: FLICK_UI_SPACING.md,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderRadius: FLICK_UI_RADIUS.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.35)",
    },
    unlockText: {
      color: FLICK_TEXT,
      fontWeight: "700",
      fontSize: 16,
    },
    previewContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: FLICK_UI_SPACING.xl,
    },
    lockBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: FLICK_UI_SPACING.md,
    },
    previewTitle: {
      color: FLICK_TEXT,
      fontSize: 20,
      fontWeight: "700",
    },
    previewSub: {
      color: FLICK_TEXT_MUTED,
      fontSize: 14,
      textAlign: "center",
      marginTop: FLICK_UI_SPACING.sm,
    },
    watchAgain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: FLICK_UI_SPACING.md,
    },
    watchAgainText: {
      color: FLICK_TEXT,
      fontSize: 15,
      fontWeight: "600",
    },
  });
}

/** Dark halo for text/icons on top of video (same in light/dark for legibility). */
const VIDEO_OVERLAY_HALO = "rgba(0,0,0,0.55)";
/** HUD play / mute circular glass pills */
const HUD_GLASS_FILL = "rgba(0,0,0,0.28)";
const HUD_GLASS_BORDER = "rgba(255,255,255,0.14)";

function createStyles(
  itemHeight: number,
  safeTopInset: number,
  bottomInset: number,
) {
  return StyleSheet.create({
    root: {
      position: "relative",
      backgroundColor: FLICKS_CANVAS,
    },
    mediaStage: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: FLICKS_CANVAS,
    },
    videoFrame: {
      overflow: "hidden",
      backgroundColor: FLICKS_CANVAS,
    },
    fallbackText: {
      color: FLICK_TEXT_MUTED,
      textAlign: "center",
      marginTop: itemHeight / 2 - 20,
    },
    posterFallback: {
      backgroundColor: FLICKS_CANVAS,
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: FLICKS_CANVAS,
      opacity: 0.35,
    },
    tapZone: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 4,
    },
    flickToolsOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 11,
    },
    flickToolsCenterHit: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    flickToolsPlayGlass: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: HUD_GLASS_FILL,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HUD_GLASS_BORDER,
      alignItems: "center",
      justifyContent: "center",
    },
    flickToolsVolumeGlass: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: HUD_GLASS_FILL,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HUD_GLASS_BORDER,
      alignItems: "center",
      justifyContent: "center",
    },
    flickToolsPlayIcon: {
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 8,
    },
    flickToolsMuteBtn: {
      position: "absolute",
      right: 14,
      zIndex: 12,
    },
    flickToolsHudIconShadow: {
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 6,
    },
    previewEndWrap: {
      zIndex: 15,
    },
    previewEndGradient: {
      opacity: 0.94,
    },
    heartBurst: {
      position: "absolute",
      left: 0,
      right: 0,
      top: itemHeight * 0.38,
      alignItems: "center",
      zIndex: 14,
    },
    bottomProfileRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: FLICK_UI_SPACING.sm,
      maxWidth: "100%",
    },
    avatarCompactWrap: {
      transform: [{ scale: 0.88 }],
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    profileText: {
      flex: 1,
      minWidth: 0,
    },
    displayNameBottom: {
      color: FLICK_TEXT,
      fontWeight: "700",
      fontSize: 14,
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    handleBottom: {
      color: FLICK_TEXT_MUTED,
      fontSize: 12,
      marginTop: 2,
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    rightActions: {
      position: "absolute",
      right: 8,
      bottom: itemHeight * 0.14,
      zIndex: 20,
      alignItems: "center",
      gap: FLICK_ACTION_GLASS_GAP,
    },
    actionColumn: {
      alignItems: "center",
      gap: 4,
    },
    actionGlass: {
      width: FLICK_ACTION_GLASS_SIZE,
      height: FLICK_ACTION_GLASS_SIZE,
      borderRadius: FLICK_ACTION_GLASS_SIZE / 2,
      backgroundColor: HUD_GLASS_FILL,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HUD_GLASS_BORDER,
      alignItems: "center",
      justifyContent: "center",
    },
    flickMenuModalRoot: {
      flex: 1,
    },
    flickMenuCard: {
      position: "absolute",
      width: FLICK_MENU_WIDTH,
      backgroundColor: "rgba(22,22,22,0.94)",
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: HUD_GLASS_BORDER,
      paddingVertical: 6,
      shadowColor: "#000",
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 24,
    },
    flickMenuRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    flickMenuDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: "rgba(255,255,255,0.12)",
      marginHorizontal: 12,
    },
    flickMenuLabel: {
      fontSize: 15,
      fontWeight: "500",
      color: FLICK_TEXT,
    },
    flickMenuLabelDanger: {
      color: "#FF8A80",
    },
    actionCount: {
      color: FLICK_TEXT,
      fontSize: 12,
      fontWeight: "600",
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    bottomStack: {
      position: "absolute",
      // backgroundColor: "red",
      left: 0,
      // Width is set inline to `itemWidth` so the bar stays full-bleed when list cells
      // are measured narrow (e.g. `removeClippedSubviews` / off-screen layout).
      bottom: Math.min(FLICK_UI_SPACING.sm, FLICK_UI_SPACING.md + bottomInset),
      zIndex: 21,
      gap: 10,
    },
    bottomCaptionCluster: {
      // backgroundColor: "blue",
      paddingHorizontal: FLICK_UI_SPACING.md,
      marginRight: FLICK_CAPTION_RAIL_GUTTER,
    },
    seekBarFullWidth: {
      width: "100%",
      paddingHorizontal: FLICK_UI_SPACING.md,
    },
    seekBlock: {
      width: "100%",
    },
    seekTimeText: {
      color: FLICK_TEXT,
      fontSize: 12,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
      marginBottom: 6,
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    seekTrackWrap: {
      height: 12,
      justifyContent: "center",
    },
    seekTrackInner: {
      height: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255,255,255,0.32)",
      overflow: "hidden",
    },
    seekFill: {
      height: "100%",
      backgroundColor: FLICK_TEXT,
      borderRadius: 3,
    },
    seekLockedSegment: {
      position: "absolute",
      top: 0,
      height: "100%",
      backgroundColor: "rgba(0,0,0,0.38)",
    },
    seekThumb: {
      position: "absolute",
      left: 0,
      top: "50%",
      marginTop: -6,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: FLICK_TEXT,
      shadowColor: "#000",
      shadowOpacity: 0.45,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 3,
    },
    captionText: {
      color: FLICK_TEXT,
      fontSize: 14,
      lineHeight: 20,
      textShadowColor: VIDEO_OVERLAY_HALO,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 3,
    },
    moreText: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: "600",
      color: FLICK_TEXT_MUTED,
    },
  });
}

export default memo(FlickItemInner);
