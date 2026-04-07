import { useManagedVideoPlayer } from "@/hooks/use-video-player";
import { Colors } from "@/src/constants/theme";
import type { Post } from "@/src/services/api/api.types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView } from "expo-video";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
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

// ─── Types ───────────────────────────────────────────────────────────────────

export type PostMediaViewer = Post["viewer"];

interface Props {
  postId: number;
  type: string;
  media: string;
  thumbnail?: string;
  price?: number;
  fullDuration?: number | string | null;
  viewer?: PostMediaViewer;
  isExclusive?: boolean;
  /** True when this post is the primary viewable item on the feed (only one plays video). */
  isFocused: boolean;
  /** Within ±2 of primary post — mount player + VideoView (paused) for preload. */
  inVideoWindow: boolean;
  isLiked: boolean;
  onLike: () => void;
  nextPostId?: number;
  nextPostUrl?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DOUBLE_TAP_DELAY = 300;
const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const MAX_MEDIA_HEIGHT = SCREEN_HEIGHT * 0.75;
const MIN_MEDIA_HEIGHT = Math.min(440, Math.max(450, SCREEN_HEIGHT * 0.42));

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ─── Utilities ───────────────────────────────────────────────────────────────

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

/** Normalizes API duration (number, numeric string, or "20s") to seconds. */
function parseDuration(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value === "string") {
    const n = Number.parseFloat(value.replace(/[^\d.]/g, ""));
    return n > 0 ? n : null;
  }
  return null;
}

// ─── Error Boundary ───────────────────────────────────────────────────────────

type ErrorBoundaryState = { hasError: boolean };

class PostMediaErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn(
      "[PostMedia] Error boundary caught:",
      error,
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorFallback}>
          <Text style={styles.errorFallbackText}>Something went wrong!</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Shared Sub-Components ────────────────────────────────────────────────────

interface PaywallContentProps {
  price: number;
  isExclusive: boolean;
  onPay: () => void;
  onWatchAgain?: () => void;
}

function PaywallContent({
  price,
  isExclusive,
  onPay,
  onWatchAgain,
}: PaywallContentProps) {
  const hintText =
    price > 1
      ? "One-time purchase · Instant access"
      : isExclusive
        ? "Subscribe for access"
        : "Unlock for full access";

  return (
    <View style={styles.paywallContent}>
      <LinearGradient
        pointerEvents="none"
        colors={Colors.gradient as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.lockBadge}
      >
        <Ionicons name="lock-closed" size={28} color="#fff" />
      </LinearGradient>

      <Text style={styles.paywallTitle}>Exclusive Content</Text>
      <Text style={styles.paywallSubtitle}>
        Unlock this post and get access to premium content from this creator.
      </Text>

      {price > 0 && (
        <View style={styles.priceBadge}>
          <Ionicons name="pricetag" size={14} color={Colors.gradient[2]} />
          <Text style={styles.priceText}>${price.toFixed(2)}</Text>
        </View>
      )}

      <Pressable
        onPress={onPay}
        style={({ pressed }) => [
          styles.payButton,
          pressed && styles.payButtonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Pay to unlock"
      >
        <LinearGradient
          pointerEvents="none"
          colors={Colors.gradient as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.payButtonGradient}
        >
          <Ionicons name="flash" size={16} color="#fff" />
          <Text style={styles.payButtonText}>Unlock Now</Text>
        </LinearGradient>
      </Pressable>

      {onWatchAgain && (
        <Pressable
          onPress={onWatchAgain}
          style={({ pressed }) => [
            styles.watchAgainButton,
            pressed && styles.watchAgainButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Watch preview again"
        >
          <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.95)" />
          <Text style={styles.watchAgainText}>Watch again</Text>
        </Pressable>
      )}

      <Text style={styles.paywallHint}>{hintText}</Text>
    </View>
  );
}

interface ImagePaywallProps {
  price: number;
  isExclusive: boolean;
  containerHeight: number;
  onPay: () => void;
}

function ImagePaywall({
  price,
  isExclusive,
  containerHeight,
  onPay,
}: ImagePaywallProps) {
  return (
    <LinearGradient
      colors={["#1a1040", "#0f0d2b"]}
      style={[styles.paidImagePlaceholder, { height: containerHeight }]}
    >
      <View style={styles.paywallBlobTop} />
      <View style={styles.paywallBlobBottom} />
      <PaywallContent price={price} isExclusive={isExclusive} onPay={onPay} />
    </LinearGradient>
  );
}

interface VideoLockedPaywallProps {
  price: number;
  isExclusive: boolean;
  thumbnail?: string;
  onPay: () => void;
  onImageLoad: (e: any) => void;
}

function VideoLockedPaywall({
  price,
  isExclusive,
  thumbnail,
  onPay,
  onImageLoad,
}: VideoLockedPaywallProps) {
  return (
    <>
      {thumbnail ? (
        <Image
          source={{ uri: thumbnail }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="disk"
          onLoad={onImageLoad}
        />
      ) : (
        <View
          style={[StyleSheet.absoluteFill, styles.media]}
          accessibilityElementsHidden
        />
      )}
      <LinearGradient
        colors={["#1a1040", "#0f0d2b"]}
        style={styles.videoLockedFullOverlay}
      >
        <View style={styles.paywallBlobTop} />
        <View style={styles.paywallBlobBottom} />
        <PaywallContent price={price} isExclusive={isExclusive} onPay={onPay} />
      </LinearGradient>
    </>
  );
}

interface VideoPreviewEndedOverlayProps {
  price: number;
  isExclusive: boolean;
  onPay: () => void;
  onWatchAgain: () => void;
}

function VideoPreviewEndedOverlay({
  price,
  isExclusive,
  onPay,
  onWatchAgain,
}: VideoPreviewEndedOverlayProps) {
  return (
    <LinearGradient
      colors={["rgba(15,13,43,0.85)", "rgba(26,16,64,0.95)"]}
      style={styles.videoPaywallOverlay}
    >
      <PaywallContent
        price={price}
        isExclusive={isExclusive}
        onPay={onPay}
        onWatchAgain={onWatchAgain}
      />
    </LinearGradient>
  );
}

// ─── Main Component (focused post — full interactive video) ──────────────────

function PostMediaInnerMain({
  postId,
  type,
  media,
  thumbnail,
  price = 0,
  fullDuration = null,
  viewer,
  isExclusive = false,
  isFocused,
  inVideoWindow,
  isLiked,
  onLike,
  nextPostId,
  nextPostUrl,
}: Props) {
  // ── Refs ───────────────────────────────────────────────────────────────────
  const isFocusedRef = useRef(isFocused);
  const isLongPressingRef = useRef(false);
  isFocusedRef.current = isFocused;

  // ── Tap / double-tap tracking ──────────────────────────────────────────────
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Animation shared values ────────────────────────────────────────────────
  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const muteOpacity = useSharedValue(0);
  const progress = useSharedValue(0);
  const maxProgressRatio = useSharedValue(1);
  const progressBarWidth = useSharedValue(0);
  const isScrubbing = useSharedValue(false);

  // ── Mute icon timer ────────────────────────────────────────────────────────
  const muteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Access control ─────────────────────────────────────────────────────────
  const canView = useMemo(
    () => viewerCanViewPostMedia(viewer, price, isExclusive),
    [
      viewer?.is_owner,
      viewer?.has_subscription,
      viewer?.has_purchased,
      price,
      isExclusive,
    ],
  );

  const parsedDuration = parseDuration(fullDuration);

  // ── Preview-ended state ────────────────────────────────────────────────────
  const [previewEnded, setPreviewEnded] = useState(false);
  const previewEndedRef = useRef(false);

  const isPaidVideo =
    !canView && type === "video" && (price > 0 || isExclusive);
  const showVideoBlockPaywall = !canView && type === "video" && !isPaidVideo;
  // To this — pass null explicitly and make sure your hook early-returns cleanly when url is null:
  const videoUrlForPlayer =
    type === "video" && inVideoWindow && media && (canView || isPaidVideo)
      ? media
      : null;

  // ── Video player ───────────────────────────────────────────────────────────
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
    postId,
    videoUrlForPlayer,
    isFocused && !previewEnded,
    nextPostUrl,
    nextPostId,
  );

  // ── Poster crossfade: shared value driven by onFirstFrameRender ──────────
  const firstFrameRendered = useRef(false);
  const posterOpacity = useSharedValue(1);

  useEffect(() => {
    if (!isReady) {
      firstFrameRendered.current = false;
      posterOpacity.value = 1;
    }
  }, [isReady]);

  useEffect(() => {
    const shouldHide = firstFrameRendered.current && isFocused;
    posterOpacity.value = shouldHide ? withTiming(0, { duration: 150 }) : 1;
  }, [isFocused, isPlaying]);

  const handleFirstFrameRender = useCallback(() => {
    firstFrameRendered.current = true;
    if (isFocusedRef.current) {
      posterOpacity.value = withTiming(0, { duration: 150 });
    }
  }, []);

  const posterAnimatedStyle = useAnimatedStyle(() => ({
    opacity: posterOpacity.value,
  }));

  // ── Aspect ratio ───────────────────────────────────────────────────────────
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  // ─── Animated styles ───────────────────────────────────────────────────────

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const animatedMuteStyle = useAnimatedStyle(() => ({
    opacity: muteOpacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * progressBarWidth.value - 5 },
      { scale: withTiming(isScrubbing.value ? 1.4 : 0.8) },
    ],
    opacity: withTiming(isScrubbing.value ? 1 : 0),
  }));

  const progressBarAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isScrubbing.value ? 1 : muteOpacity.value,
  }));

  const lockedSegmentStyle = useAnimatedStyle(() => {
    const ratio = maxProgressRatio.value;
    return {
      left: `${ratio * 100}%`,
      width: `${(1 - ratio) * 100}%`,
      opacity: ratio < 1 ? 1 : 0,
    };
  });

  // ─── Seek logic ────────────────────────────────────────────────────────────

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
      }
    },
    [player, isPaidVideo, parsedDuration, pause, progress],
  );

  // ─── Gesture handlers ──────────────────────────────────────────────────────

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
      runOnJS(seekTo)(clamped);
    });

  const panGesture = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .onBegin(() => {
      isScrubbing.value = true;
    })
    .onUpdate((e) => {
      const w = progressBarWidth.value;
      if (w <= 0) return;
      const raw = Math.max(0, Math.min(e.x / w, 1));
      progress.value =
        maxProgressRatio.value < 1
          ? Math.min(raw, maxProgressRatio.value)
          : raw;
    })
    .onEnd(() => {
      runOnJS(seekTo)(progress.value);
    })
    .onFinalize(() => {
      isScrubbing.value = false;
    });

  const barGesture = Gesture.Simultaneous(tapSeekGesture, panGesture);

  // ─── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!player || !isFocused) return;

    try {
      (player as any).timeUpdateEventInterval = 0.25;
    } catch {
      /* property may not exist on older builds */
    }

    const sub = player.addListener(
      "timeUpdate" as any,
      ({ currentTime }: { currentTime: number }) => {
        if (isScrubbing.value || !player.duration) return;

        if (isPaidVideo && parsedDuration) {
          const cap = player.duration;
          maxProgressRatio.value = cap / parsedDuration;

          if (currentTime >= cap - 0.1) {
            pause();
            progress.value = cap / parsedDuration;
            if (!previewEndedRef.current) {
              previewEndedRef.current = true;
              setPreviewEnded(true);
            }
          } else {
            progress.value = currentTime / parsedDuration;
            // if (previewEndedRef.current) {
            //   previewEndedRef.current = false;
            //   setPreviewEnded(false);
            // }
          }
        } else {
          progress.value = currentTime / player.duration;
        }
      },
    );

    return () => sub.remove();
  }, [player, isFocused, isPaidVideo, parsedDuration, pause]);

  // Disable looping for paid previews
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

  // Derive aspect ratio from video track once ready
  useEffect(() => {
    if (
      type === "video" &&
      inVideoWindow &&
      isReady &&
      player?.videoTrack?.size
    ) {
      const { width, height } = player.videoTrack.size;
      if (width && height) setAspectRatio(width / height);
    }
  }, [type, inVideoWindow, isReady, player]);

  // Reset preview state when post scrolls off screen
  useEffect(() => {
    if (!isFocused && previewEndedRef.current) {
      previewEndedRef.current = false;
      setPreviewEnded(false);
    }
  }, [isFocused]);

  // ─── UI event handlers ─────────────────────────────────────────────────────

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
  }, []);

  const showMuteIcon = useCallback(() => {
    muteOpacity.value = withTiming(1, { duration: 200 });
    if (muteTimerRef.current) clearTimeout(muteTimerRef.current);
    muteTimerRef.current = setTimeout(() => {
      muteOpacity.value = withTiming(0, { duration: 500 });
    }, 1000);
  }, []);

  const handleDoubleTap = useCallback(() => {
    triggerHeartAnimation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLiked) onLike();
  }, [isLiked, onLike, triggerHeartAnimation]);

  const handleSingleTap = useCallback(() => {
    if (type === "video") showMuteIcon();
  }, [type, showMuteIcon]);

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
    isLongPressingRef.current = true; // ← add this
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    if (type === "video" && isPlaying) {
      pause?.();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [type, isPlaying, pause]);

  const handleLongPressOut = useCallback(() => {
    if (!isLongPressingRef.current) return; // ← guard
    isLongPressingRef.current = false; // ← reset
    if (type === "video" && isFocused && !previewEnded) play?.();
  }, [type, isFocused, play, previewEnded]);

  const handleMutePress = useCallback(() => {
    toggleMute?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showMuteIcon();
  }, [toggleMute, showMuteIcon]);

  const handlePayPress = useCallback(() => {
    Alert.alert("Coming Soon");
  }, []);

  const handleWatchAgain = useCallback(() => {
    previewEndedRef.current = false;
    setPreviewEnded(false);
    progress.value = 0;

    // Mark poster as "already rendered" so the poster-visibility effects
    // (which check firstFrameRendered.current) don't keep it at opacity 1.
    firstFrameRendered.current = true;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (player) {
      player.currentTime = 0;

      // Delay so the seek settles and React state (previewEnded=false)
      // has propagated. Then:
      //  • Call player.play() directly — the hook's play() bails out if
      //    the status isn't "readyToPlay" (which can happen mid-seek).
      //  • Force the poster to hide — the isReady effect may have
      //    reset firstFrameRendered during the seek transient.
      setTimeout(() => {
        firstFrameRendered.current = true; // re-set in case isReady effect cleared it
        posterOpacity.value = withTiming(0, { duration: 150 });
        try {
          player.play();
        } catch {
          /* native object may be gone */
        }
      }, 150);
    }
  }, [player, progress, posterOpacity]);

  const handleImageLoad = useCallback((e: any) => {
    if (e.source?.width && e.source?.height) {
      const ratio = e.source.width / e.source.height;
      setAspectRatio((prev) => (prev === ratio ? prev : ratio)); // ← no re-render if same value
    }
  }, []);

  // ─── Derived display flags ─────────────────────────────────────────────────

  const viewerSeesImagePaywall = !canView && type === "image";

  if (!media && !viewerSeesImagePaywall && !isPaidVideo) return null;

  // ✅ FIX: mount VideoView whenever we have a player and are in the video
  // window — not just when focused.  This lets ±2 neighbors keep their
  // VideoView connected (paused) so the first frame is already decoded
  // when focus arrives.  `isFocused` only controls play/pause.
  //
  // Use a sticky ref so that once the VideoView has mounted (isReady=true),
  // it stays mounted even during brief "loading" hiccups caused by seeks.
  // Un-mounting / re-mounting the VideoView on Android causes a stuck-frame.
  const videoViewMountedRef = useRef(false);
  if (isReady && player) videoViewMountedRef.current = true;
  if (!player) videoViewMountedRef.current = false;
  const showVideoView =
    isFocused && player !== null && (isReady || videoViewMountedRef.current);
  const showLoadingOverlay =
    type === "video" && isFocused && (isBuffering || !isReady);
  const showPremiumBadge = price > 0 || isExclusive;

  const containerHeight = useMemo(() => {
    const calculatedHeight = aspectRatio
      ? SCREEN_WIDTH / aspectRatio
      : SCREEN_WIDTH;
    return Math.max(
      MIN_MEDIA_HEIGHT,
      Math.min(calculatedHeight, MAX_MEDIA_HEIGHT),
    );
  }, [aspectRatio]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Pressable
        onPress={handleTap}
        onLongPress={handleLongPressIn}
        onPressOut={handleLongPressOut}
        delayLongPress={200}
      >
        <View style={[styles.media, { height: containerHeight }]}>
          {showVideoBlockPaywall ? (
            <VideoLockedPaywall
              price={price}
              isExclusive={isExclusive}
              thumbnail={thumbnail}
              onPay={handlePayPress}
              onImageLoad={handleImageLoad}
            />
          ) : (
            <>
              {/* ✅ FIX: VideoView mounts for ALL posts in ±2 window (not just focused).
                    This keeps the decoder connected so the first frame is already rendered
                    when the post becomes focused — eliminating the black flash.

                    surfaceType="textureView" prevents the SurfaceView z-ordering black flash.
                    useExoShutter={false} prevents ExoPlayer's default black shutter layer.
                    onFirstFrameRender replaces the timer-based poster hide. */}
              {showVideoView && player && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <VideoView
                    style={StyleSheet.absoluteFill}
                    player={player}
                    contentFit="contain"
                    nativeControls={false}
                    allowsPictureInPicture={false}
                    // allowsFullscreen={false}
                    fullscreenOptions={{
                      enable: false,
                    }}
                    // surfaceType="textureView"
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
                    contentFit="contain"
                    cachePolicy="disk"
                    transition={0}
                    onLoad={handleImageLoad}
                  />
                </Animated.View>
              ) : (
                <Animated.View
                  style={[
                    StyleSheet.absoluteFill,
                    styles.videoPosterFallback,
                    posterAnimatedStyle,
                  ]}
                  pointerEvents="none"
                />
              )}

              {showLoadingOverlay && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator color="white" size="large" />
                </View>
              )}

              {/* Progress bar + controls only for focused post */}
              {showVideoView && player && isFocused && (
                <GestureDetector gesture={barGesture}>
                  <Animated.View
                    style={[styles.progressContainer, progressBarAnimatedStyle]}
                    hitSlop={{ top: 10, bottom: 10 }}
                    onLayout={(e) => {
                      progressBarWidth.value = e.nativeEvent.layout.width;
                    }}
                  >
                    <Animated.View
                      style={[styles.progressFill, progressStyle]}
                    />
                    <Animated.View
                      style={[styles.progressLockedSegment, lockedSegmentStyle]}
                    />
                    <Animated.View style={[styles.thumb, thumbAnimatedStyle]} />
                  </Animated.View>
                </GestureDetector>
              )}

              {isFocused && (
                <AnimatedPressable
                  onPress={handleMutePress}
                  style={[styles.muteButton, animatedMuteStyle]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={18}
                    color="white"
                  />
                </AnimatedPressable>
              )}
            </>
          )}
        </View>
      </Pressable>

      {/* Preview-ended paywall — rendered OUTSIDE the Pressable so its
          Pressable buttons (Watch Again / Unlock Now) are directly tappable
          instead of being swallowed by the parent Pressable's onPress. */}
      {previewEnded && isPaidVideo && isFocused && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { height: containerHeight, zIndex: 20 },
          ]}
          // Don't set pointerEvents="box-none" here — we WANT the overlay
          // backdrop to block taps from reaching the video Pressable beneath.
        >
          <VideoPreviewEndedOverlay
            price={price}
            isExclusive={isExclusive}
            onPay={handlePayPress}
            onWatchAgain={handleWatchAgain}
          />
        </View>
      )}

      {/* Heart animation overlay */}
      <Animated.View
        style={[styles.heartContainer, heartAnimatedStyle]}
        pointerEvents="none"
      >
        <Ionicons
          name="heart"
          size={120}
          color="#ff3040"
          style={styles.heartIcon}
        />
      </Animated.View>

      {showPremiumBadge && (
        <View
          style={styles.premiumBadge}
          pointerEvents="none"
          accessible
          accessibilityRole="image"
          accessibilityLabel={
            price > 0 && isExclusive
              ? "Premium paid exclusive content"
              : price > 0
                ? "Premium paid content"
                : "Premium exclusive content"
          }
        >
          <Ionicons name="heart" size={18} color="#f5c542" />
        </View>
      )}
    </View>
  );
}

const PostMediaInnerMainMemo = memo(PostMediaInnerMain);

// ─── Public export (wrapped in error boundary) ────────────────────────────────

const PostMediaImage = memo(function PostMediaImage({
  media,
  price = 0,
  viewer,
  isExclusive = false,
  onLike,
  isLiked,
}: Props) {
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canView = useMemo(
    () => viewerCanViewPostMedia(viewer, price, isExclusive),
    [viewer, price, isExclusive],
  );

  const viewerSeesImagePaywall = !canView;

  const heartScale = useSharedValue(0);
  const heartOpacity = useSharedValue(0);

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }));

  const triggerHeartAnimation = useCallback(() => {
    heartScale.value = 0.6;
    heartOpacity.value = 1;
    heartScale.value = withSpring(1.2);
    heartOpacity.value = withTiming(0, { duration: 600 });
  }, []);

  const handleDoubleTap = useCallback(() => {
    triggerHeartAnimation();
    if (!isLiked) onLike();
  }, [isLiked, onLike]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const diff = now - lastTapRef.current;

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }

    if (diff < DOUBLE_TAP_DELAY) {
      lastTapRef.current = 0;
      handleDoubleTap();
    } else {
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {}, DOUBLE_TAP_DELAY);
    }
  }, [handleDoubleTap]);

  if (!media && !viewerSeesImagePaywall) return null;

  return (
    <View style={styles.container}>
      {viewerSeesImagePaywall ? (
        <ImagePaywall
          price={price}
          isExclusive={isExclusive}
          containerHeight={MIN_MEDIA_HEIGHT}
          onPay={() => {}}
        />
      ) : (
        <Pressable onPress={handleTap}>
          <Image
            source={{ uri: media }}
            style={styles.imageMedia}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
        </Pressable>
      )}

      <Animated.View
        style={[styles.heartContainer, heartAnimatedStyle]}
        pointerEvents="none"
      >
        <Ionicons name="heart" size={120} color="#ff3040" />
      </Animated.View>
    </View>
  );
});

function PostMedia(props: Props) {
  return (
    <PostMediaErrorBoundary>
      {props.type === "image" ? (
        <PostMediaImage {...props} />
      ) : (
        <PostMediaInnerMainMemo {...props} />
      )}
    </PostMediaErrorBoundary>
  );
}

export default memo(PostMedia);

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  premiumBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 12,
    padding: 6,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(245, 197, 66, 0.55)",
    // elevation removed — creates expensive bitmap layer on Android during scroll
  },
  errorFallback: {
    width: "100%",
    minHeight: 200,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  errorFallbackText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
  },
  media: {
    width: "100%",
    backgroundColor: "#000",
    overflow: "hidden",
  },
  videoPosterFallback: {
    backgroundColor: "#1c1c1e",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  thumb: {
    position: "absolute",
    top: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  playIndicator: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  muteButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    padding: 8,
    borderRadius: 20,
  },
  heartContainer: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -60,
    marginTop: -60,
    justifyContent: "center",
    alignItems: "center",
  },
  heartIcon: {
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  progressContainer: {
    position: "absolute",
    bottom: 5,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
  },
  progressLockedSegment: {
    position: "absolute",
    top: 0,
    height: "100%",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  videoPaywallOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  videoLockedFullOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  paidImagePlaceholder: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    paddingVertical: 24,
    paddingHorizontal: 12,
  },
  paywallBlobTop: {
    position: "absolute",
    top: -60,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.gradient[0],
    opacity: 0.25,
  },
  paywallBlobBottom: {
    position: "absolute",
    bottom: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.gradient[2],
    opacity: 0.15,
  },
  paywallContent: {
    alignItems: "center",
    width: "100%",
    maxWidth: SCREEN_WIDTH,
    paddingHorizontal: 32,
    paddingVertical: 8,
    gap: 12,
    flexShrink: 1,
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
    elevation: 2,
  },
  paywallTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  paywallSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 18,
  },
  priceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 2,
  },
  priceText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  payButton: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 6,
    elevation: 2,
  },
  payButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  payButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  watchAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  watchAgainButtonPressed: {
    opacity: 0.85,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  watchAgainText: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.95)",
  },
  paywallHint: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    marginTop: 2,
  },
  imageMedia: {
    width: SCREEN_WIDTH,
    height: undefined, // let aspectRatio drive it
    aspectRatio: 4 / 5, // safe default (portrait); adjust to your typical content
    backgroundColor: "#111", // dark but not pure black so it's clearly a placeholder
  },
});
