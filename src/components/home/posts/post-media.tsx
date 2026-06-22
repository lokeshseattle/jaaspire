import JaasiStar from "@/assets/svg/JaasiStar";
import { useManagedVideoPlayer } from "@/hooks/use-video-player";
import { PostHeartOverlay } from "@/src/components/home/posts/media/PostHeartOverlay";
import { VerticalVideoFrame } from "@/src/components/video/VerticalVideoFrame";
import { Colors } from "@/src/constants/theme";
import {
  canViewPostMedia,
  parseDuration,
} from "@/src/features/post/post.utils";
import { useVerticalVideoLayout } from "@/src/hooks/use-vertical-video-layout";
import { useVideoTrackSize } from "@/src/hooks/use-video-track-size";
import type { Post } from "@/src/services/api/api.types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  Component,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
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
  /** True when this post is the primary row in the feed (visible slot), independent of tab/screen focus. */
  isPrimaryFeedPost: boolean;
  /** Within ±2 of primary post — mount player + VideoView (paused) for preload. */
  inVideoWindow: boolean;
  isLiked: boolean;
  onLike: () => void;
  nextPostId?: number;
  nextPostUrl?: string;
  /** Opens wallet purchase confirmation (e.g. from parent `PaymentConfirmSheet`). */
  onRequestPurchase?: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DOUBLE_TAP_DELAY = 300;

// ─── Utilities ───────────────────────────────────────────────────────────────

/** mm:ss with zero-padded minutes (e.g. 00:03 / 03:00) for paid preview labels. */
function formatPreviewTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
    // console.warn(
    // "[PostMedia] Error boundary caught:",
    // error,
    // info.componentStack,
    // );
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
          <JaasiStar width={16} height={16} />
          <Text style={styles.priceText}>{price} Jaasi Stars</Text>
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
  isPrimaryFeedPost,
  inVideoWindow,
  isLiked,
  onLike,
  nextPostId,
  nextPostUrl,
  onRequestPurchase,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const maxMediaHeight = screenHeight * 0.75;
  const minMediaHeight = screenHeight * 0.65;

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
  const progress = useSharedValue(0);
  const maxProgressRatio = useSharedValue(1);

  // ── Access control ─────────────────────────────────────────────────────────
  const canView = useMemo(
    () => canViewPostMedia(viewer, price, isExclusive),
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
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);

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

  const trackSize = useVideoTrackSize(player, isReady);
  const videoLayout = useVerticalVideoLayout(screenWidth, minMediaHeight, {
    minHeight: minMediaHeight,
    maxHeight: minMediaHeight,
    sourceWidth: trackSize?.width,
    sourceHeight: trackSize?.height,
  });

  // ── Poster crossfade: shared value driven by onFirstFrameRender ──────────
  const firstFrameRendered = useRef(false);
  const posterOpacity = useSharedValue(1);

  useEffect(() => {
    setPreviewCurrentTime(0);
    previewEndedRef.current = false;
    setPreviewEnded(false);
  }, [postId]);

  useEffect(() => {
    if (!isReady) {
      firstFrameRendered.current = false;
      posterOpacity.value = 1;
    }
  }, [isReady, posterOpacity]);

  useEffect(() => {
    if (!canView) return;
    if (!previewEndedRef.current) return;

    previewEndedRef.current = false;
    setPreviewEnded(false);
    progress.value = 0;
  }, [canView, progress]);

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
        try {
          if (!player.duration) return;

          if (isPaidVideo && parsedDuration) {
            const cap = player.duration;
            maxProgressRatio.value = cap / parsedDuration;

            if (currentTime >= cap - 0.1) {
              pause();
              progress.value = cap / parsedDuration;
              setPreviewCurrentTime(cap);
              if (!previewEndedRef.current) {
                previewEndedRef.current = true;
                setPreviewEnded(true);
              }
            } else {
              progress.value = currentTime / parsedDuration;
              setPreviewCurrentTime(currentTime);
            }
          } else {
            progress.value = currentTime / player.duration;
          }
        } catch {
          /* player was released between resetAll() and effect cleanup */
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

  // Reset preview state when user scrolls to a different post — not on tab/screen blur.
  useEffect(() => {
    if (!isPrimaryFeedPost && previewEndedRef.current) {
      previewEndedRef.current = false;
      setPreviewEnded(false);
      setPreviewCurrentTime(0);
    }
  }, [isPrimaryFeedPost]);

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

  const handleDoubleTap = useCallback(() => {
    triggerHeartAnimation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLiked) onLike();
  }, [isLiked, onLike, triggerHeartAnimation]);

  const handleSingleTap = useCallback(() => {
    if (type !== "video") return;
    if (!canView) return;
    router.push(`/(app)/flick/${postId}`);
  }, [type, postId, canView]);

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
  }, [toggleMute]);

  const handlePayPress = useCallback(() => {
    // console.log("handlePayPress");
    if (onRequestPurchase) {
      onRequestPurchase();
      return;
    }
    Alert.alert("Coming Soon");
  }, [onRequestPurchase]);

  const handleWatchAgain = useCallback(() => {
    previewEndedRef.current = false;
    setPreviewEnded(false);
    setPreviewCurrentTime(0);
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

  // VideoView only while `isReady`: if we keep the surface mounted when the
  // native player drops out of ready (tab/stack churn, pool eviction), the
  // sticky layer stays opaque black on top of the poster.
  const showVideoView = isFocused && player !== null && isReady;
  const showLoadingOverlay =
    type === "video" && isFocused && (isBuffering || !isReady);
  const showPremiumBadge = price > 0 || isExclusive;
  const showPaidPreviewTime =
    isPaidVideo &&
    isFocused &&
    parsedDuration != null &&
    parsedDuration > 0 &&
    !previewEnded;

  const containerHeight = useMemo(() => {
    if (type === "video") {
      return minMediaHeight;
    }
    const calculatedHeight = aspectRatio
      ? screenWidth / aspectRatio
      : screenWidth;
    return Math.max(minMediaHeight, Math.min(calculatedHeight, maxMediaHeight));
  }, [type, aspectRatio, screenWidth, minMediaHeight, maxMediaHeight]);

  if (!media && !viewerSeesImagePaywall && !isPaidVideo) return null;

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
              <VerticalVideoFrame
                fillParent
                frameWidth={videoLayout.frameWidth}
                frameHeight={videoLayout.frameHeight}
                contentFit={videoLayout.contentFit}
                player={player}
                showVideo={showVideoView}
                thumbnail={thumbnail}
                posterAnimatedStyle={posterAnimatedStyle}
                onFirstFrameRender={handleFirstFrameRender}
                onPosterLoad={handleImageLoad}
                posterFallbackStyle={styles.videoPosterFallback}
              >
                {showLoadingOverlay && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="white" size="large" />
                  </View>
                )}
              </VerticalVideoFrame>

              {isFocused &&
                type === "video" &&
                (canView || isPaidVideo) &&
                !previewEnded && (
                <Pressable
                  onPress={handleMutePress}
                  style={styles.muteButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={isMuted ? "Unmute" : "Mute"}
                >
                  <Ionicons
                    name={isMuted ? "volume-mute" : "volume-high"}
                    size={18}
                    color="white"
                  />
                </Pressable>
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
      <PostHeartOverlay animatedStyle={heartAnimatedStyle} showShadow />

      {showPremiumBadge && (
        <View
          style={styles.premiumBadge}
          pointerEvents="none"
          accessible
          accessibilityRole="text"
          accessibilityLabel={
            showPaidPreviewTime && parsedDuration
              ? `Premium preview ${formatPreviewTime(previewCurrentTime)} of ${formatPreviewTime(parsedDuration)}`
              : price > 0 && isExclusive
                ? "Premium paid exclusive content"
                : price > 0
                  ? "Premium paid content"
                  : "Premium exclusive content"
          }
        >
          <Ionicons name="heart" size={16} color="#f5c542" />
          {showPaidPreviewTime && parsedDuration != null && (
            <Text style={styles.previewTimeText}>
              {formatPreviewTime(previewCurrentTime)} /{" "}
              {formatPreviewTime(parsedDuration)}
            </Text>
          )}
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
  onRequestPurchase,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const minMediaHeight = screenHeight * 0.55;

  const [sourceSize, setSourceSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const imageLayout = useVerticalVideoLayout(screenWidth, minMediaHeight, {
    minHeight: minMediaHeight,
    maxHeight: minMediaHeight,
    sourceWidth: sourceSize?.width,
    sourceHeight: sourceSize?.height,
  });

  const handleImageLoad = useCallback((event: unknown) => {
    const source = (event as { source?: { width?: number; height?: number } })
      ?.source;
    const width = source?.width;
    const height = source?.height;
    if (width && height) {
      setSourceSize((prev) =>
        prev?.width === width && prev?.height === height
          ? prev
          : { width, height },
      );
    }
  }, []);

  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canView = useMemo(
    () => canViewPostMedia(viewer, price, isExclusive),
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

  const handlePayPress = useCallback(() => {
    if (onRequestPurchase) {
      onRequestPurchase();
      return;
    }
    Alert.alert("Coming Soon");
  }, [onRequestPurchase]);

  if (!media && !viewerSeesImagePaywall) return null;

  return (
    <View style={styles.container}>
      {viewerSeesImagePaywall ? (
        <ImagePaywall
          price={price}
          isExclusive={isExclusive}
          containerHeight={minMediaHeight}
          onPay={handlePayPress}
        />
      ) : (
        <Pressable onPress={handleTap}>
          <View style={[styles.media, { height: minMediaHeight }]}>
            <VerticalVideoFrame
              fillParent
              frameWidth={imageLayout.frameWidth}
              frameHeight={imageLayout.frameHeight}
              contentFit={imageLayout.contentFit}
              thumbnail={media}
              onPosterLoad={handleImageLoad}
              posterFallbackStyle={styles.videoPosterFallback}
            />
          </View>
        </Pressable>
      )}

      <PostHeartOverlay animatedStyle={heartAnimatedStyle} />
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(245, 197, 66, 0.55)",
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
    // backgroundColor: "rgba(0, 0, 0, 0.3)",
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
  previewTimeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    letterSpacing: 0.2,
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
    maxWidth: "100%",
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
});
