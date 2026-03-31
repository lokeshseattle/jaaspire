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

export type PostMediaViewer = Post["viewer"];

/** Whether the current user may see full media (no paywall / preview lock). */
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

interface Props {
  postId: number;
  type: string;
  media: string;
  thumbnail?: string;
  /** When > 0, drives paid preview timeline when user cannot view full video. */
  price?: number;
  /** Full content duration in seconds (from API). Drives the progress bar length for paid videos. */
  fullDuration?: number | string | null;
  /** API viewer flags: owner always sees full media; exclusive needs subscription; price above 1 needs purchase. */
  viewer?: PostMediaViewer;
  /** Subscriber-only post from API. */
  isExclusive?: boolean;
  isVisible: boolean;
  isLiked: boolean;
  onLike: () => void;
  nextPostId?: number; // For preloading
  nextPostUrl?: string; // For preloading
}

// Double-tap detection window (ms)
const DOUBLE_TAP_DELAY = 300;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
const MAX_MEDIA_HEIGHT = SCREEN_HEIGHT * 0.75;
/** Min box height so paywall / lock UI is not clipped; wide media letterboxes inside via contain. */
const MIN_MEDIA_HEIGHT = Math.min(440, Math.max(450, SCREEN_HEIGHT * 0.42));

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

function PostMediaInner({
  postId,
  type,
  media,
  thumbnail,
  price = 0,
  fullDuration = null,
  viewer,
  isExclusive = false,
  isVisible,
  isLiked,
  onLike,
  nextPostId,
  nextPostUrl,
}: Props) {
  // Refs for tap handling
  const lastTapRef = useRef<number>(0);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation values for heart
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  // Animation values for mute icon
  const muteOpacity = useSharedValue(0);
  const muteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const animatedMuteStyle = useAnimatedStyle(() => ({
    opacity: muteOpacity.value,
  }));

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
  const isPaidVideo = !canView && type === "video" && price > 0;

  console.log({ isPaidVideo, canView, postId });

  const showVideoBlockPaywall = !canView && type === "video" && !isPaidVideo;

  const videoUrlForPlayer =
    type === "video" && media && (canView || isPaidVideo) ? media : null;

  // Video player hook - now with preloading support
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
    isVisible,
    nextPostUrl, // Pass for preloading
    nextPostId, // Pass for preloading
  );

  // console.log("isPaidVideo", isPaidVideo, postId);
  const [previewEnded, setPreviewEnded] = useState(false);
  const previewEndedRef = useRef(false);

  // Dynamic Aspect Ratio
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const progress = useSharedValue(0);
  const maxProgressRatio = useSharedValue(1);

  const seekTo = useCallback(
    (value: number) => {
      if (!player?.duration) return;
      if (isPaidVideo && parsedDuration) {
        const cap = player.duration;
        const t = Math.min(value * parsedDuration, cap);
        player.currentTime = t;
        progress.value = t / parsedDuration;
        const epsilon = 0.08;
        const atEnd = t >= cap - epsilon;
        if (atEnd) {
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

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (isScrubbing.value || !player.duration) return;

      if (isPaidVideo && parsedDuration) {
        const cap = player.duration;
        maxProgressRatio.value = cap / parsedDuration;

        if (player.currentTime >= cap - 0.1) {
          pause();
          player.currentTime = cap;
          progress.value = cap / parsedDuration;
          if (!previewEndedRef.current) {
            previewEndedRef.current = true;
            setPreviewEnded(true);
          }
        } else {
          progress.value = player.currentTime / parsedDuration;
          if (previewEndedRef.current) {
            previewEndedRef.current = false;
            setPreviewEnded(false);
          }
        }
      } else {
        progress.value = player.currentTime / player.duration;
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player, isPaidVideo, parsedDuration, pause]);

  // Paid preview must not loop — global manager sets loop=true on all players.
  useEffect(() => {
    if (!player || !isPaidVideo) return;
    let previousLoop = true;
    try {
      previousLoop = player.loop;
      player.loop = false;
    } catch {
      return;
    }
    return () => {
      try {
        player.loop = previousLoop;
      } catch {
        /* native object may be gone */
      }
    };
  }, [player, isPaidVideo]);

  const progressBarWidth = useSharedValue(0);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));
  const isScrubbing = useSharedValue(false);
  // const thumbStyle = useAnimatedStyle(() => ({
  //   transform: [
  //     {
  //       translateX: progress.value * progressBarWidth.value - 5,
  //     },
  //   ],
  // }));

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: progress.value * progressBarWidth.value - 5,
      },
      {
        scale: withTiming(isScrubbing.value ? 1.4 : 0.8),
      },
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

  const tapSeekGesture = Gesture.Tap()
    .maxDistance(14)
    .onEnd((e) => {
      "worklet";
      const w = progressBarWidth.value;
      if (w <= 0) return;
      const raw = Math.max(0, Math.min(e.x / w, 1));
      const p =
        maxProgressRatio.value < 1
          ? Math.min(raw, maxProgressRatio.value)
          : raw;
      progress.value = p;
      runOnJS(seekTo)(p);
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

  useEffect(() => {
    if (type === "video" && isReady && player?.videoTrack?.size) {
      const { width, height } = player.videoTrack.size;
      if (width && height) {
        setAspectRatio(width / height);
      }
    }
  }, [type, isReady, player]);

  const handleImageLoad = useCallback((e: any) => {
    if (e.source?.width && e.source?.height) {
      setAspectRatio(e.source.width / e.source.height);
    }
  }, []);

  // Heart animation
  const triggerHeartAnimation = useCallback(() => {
    scale.value = 0.6;
    opacity.value = 1;
    scale.value = withSpring(
      1.3,
      { damping: 8, stiffness: 300, mass: 0.5 },
      (finished) => {
        if (finished) {
          scale.value = withSpring(1, { damping: 10, stiffness: 250 });
        }
      },
    );
    // Fade out after delay
    opacity.value = withTiming(0, { duration: 600 }, undefined);
  }, []);

  // Double-tap handler (like)
  const handleDoubleTap = useCallback(() => {
    triggerHeartAnimation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isLiked) {
      onLike();
    }
  }, [isLiked, onLike, triggerHeartAnimation]);

  const showMuteIcon = useCallback(() => {
    muteOpacity.value = withTiming(1, { duration: 200 });
    if (muteTimerRef.current) {
      clearTimeout(muteTimerRef.current);
    }
    muteTimerRef.current = setTimeout(() => {
      muteOpacity.value = withTiming(0, { duration: 500 });
    }, 1000);
  }, []);

  // Single-tap handler (show mute icon for video, nothing for image)
  const handleSingleTap = useCallback(() => {
    if (type === "video") {
      showMuteIcon();
    }
  }, [type, showMuteIcon]);

  // Unified tap handler with debounce to distinguish single vs double
  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;

    // Clear any pending single-tap action
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (timeSinceLastTap < DOUBLE_TAP_DELAY) {
      // Double tap detected
      lastTapRef.current = 0; // Reset to prevent triple-tap issues
      handleDoubleTap();
    } else {
      // Potential single tap - wait to see if another tap comes
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        handleSingleTap();
        singleTapTimerRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  }, [handleDoubleTap, handleSingleTap]);

  // Long press handlers (pause video while held)
  const handleLongPressIn = useCallback(() => {
    // Cancel any pending single-tap action when long press starts
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (type === "video" && isPlaying) {
      pause();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [type, isPlaying, pause]);

  useEffect(() => {
    if (!isVisible && previewEndedRef.current) {
      previewEndedRef.current = false;
      setPreviewEnded(false);
    }
  }, [isVisible]);

  const handleLongPressOut = useCallback(() => {
    if (type === "video" && isVisible && !previewEnded) {
      play();
    }
  }, [type, isVisible, play, previewEnded]);

  // Mute button handler - stop propagation to prevent tap handler
  const handleMutePress = useCallback(() => {
    toggleMute();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showMuteIcon();
  }, [toggleMute, showMuteIcon]);

  const handlePayPress = useCallback(() => {
    Alert.alert("Coming Soon");
  }, []);

  const handleWatchAgain = useCallback(() => {
    previewEndedRef.current = false;
    setPreviewEnded(false);
    if (player) {
      player.currentTime = 0;
      progress.value = 0;
    }
    if (isVisible) {
      play();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [player, play, isVisible, progress]);

  const viewerSeesImagePaywall = !canView && type === "image";
  if (!media && !viewerSeesImagePaywall && !isPaidVideo) return null;

  // Determine if we should show the video player
  // Show VideoView as soon as player exists (not gated on isReady)
  // VideoView handles its own loading state internally
  const showVideoView = player !== null;

  // Show loading overlay when buffering or not ready
  const showLoadingOverlay = type === "video" && (isBuffering || !isReady);

  const calculatedHeight = aspectRatio
    ? SCREEN_WIDTH / aspectRatio
    : SCREEN_WIDTH;
  const containerHeight = Math.max(
    MIN_MEDIA_HEIGHT,
    Math.min(calculatedHeight, MAX_MEDIA_HEIGHT),
  );

  const showImagePaywall = viewerSeesImagePaywall;

  const showPremiumBadge = price > 0 || isExclusive;

  return (
    <View style={styles.container}>
      {type === "image" ? (
        showImagePaywall ? (
          <LinearGradient
            colors={["#1a1040", "#0f0d2b"]}
            style={[styles.paidImagePlaceholder, { height: containerHeight }]}
          >
            {/* Decorative blobs */}
            <View style={styles.paywallBlobTop} />
            <View style={styles.paywallBlobBottom} />

            <View style={styles.paywallContent}>
              {/* Lock badge */}
              <LinearGradient
                colors={Colors.gradient as [string, string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.lockBadge}
              >
                <Ionicons name="lock-closed" size={28} color="#fff" />
              </LinearGradient>

              <Text style={styles.paywallTitle}>Exclusive Content</Text>
              <Text style={styles.paywallSubtitle}>
                Unlock this post and get access to premium content from this
                creator.
              </Text>

              {/* Price badge — hide when no PPV price */}
              {price > 0 ? (
                <View style={styles.priceBadge}>
                  <Ionicons
                    name="pricetag"
                    size={14}
                    color={Colors.gradient[2]}
                  />
                  <Text style={styles.priceText}>${price.toFixed(2)}</Text>
                </View>
              ) : null}

              {/* CTA button */}
              <Pressable
                onPress={handlePayPress}
                style={({ pressed }) => [
                  styles.payButton,
                  pressed && styles.payButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Pay to unlock"
              >
                <LinearGradient
                  colors={Colors.gradient as [string, string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.payButtonGradient}
                >
                  <Ionicons name="flash" size={16} color="#fff" />
                  <Text style={styles.payButtonText}>Unlock Now</Text>
                </LinearGradient>
              </Pressable>

              <Text style={styles.paywallHint}>
                {price > 1
                  ? "One-time purchase · Instant access"
                  : isExclusive
                    ? "Subscribe for access"
                    : "Unlock for full access"}
              </Text>
            </View>
          </LinearGradient>
        ) : (
          <Pressable onPress={handleTap}>
            <Image
              source={{ uri: media }}
              style={[styles.media, { height: containerHeight }]}
              contentFit="contain"
              cachePolicy="disk"
              transition={200}
              onLoad={handleImageLoad}
            />
          </Pressable>
        )
      ) : (
        <Pressable
          onPress={handleTap}
          onLongPress={handleLongPressIn}
          onPressOut={handleLongPressOut}
          delayLongPress={200}
        >
          <View style={[styles.media, { height: containerHeight }]}>
            {showVideoBlockPaywall ? (
              <>
                {thumbnail ? (
                  <Image
                    source={{ uri: thumbnail }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    cachePolicy="disk"
                    onLoad={handleImageLoad}
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
                  <View style={styles.paywallContent}>
                    <LinearGradient
                      colors={Colors.gradient as [string, string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.lockBadge}
                    >
                      <Ionicons name="lock-closed" size={28} color="#fff" />
                    </LinearGradient>

                    <Text style={styles.paywallTitle}>
                      Exclusive Content hai
                    </Text>
                    <Text style={styles.paywallSubtitle}>
                      Unlock this post and get access to premium content from
                      this creator.
                    </Text>

                    {price > 0 ? (
                      <View style={styles.priceBadge}>
                        <Ionicons
                          name="pricetag"
                          size={14}
                          color={Colors.gradient[2]}
                        />
                        <Text style={styles.priceText}>
                          ${price.toFixed(2)}
                        </Text>
                      </View>
                    ) : null}

                    <Pressable
                      onPress={handlePayPress}
                      style={({ pressed }) => [
                        styles.payButton,
                        pressed && styles.payButtonPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel="Pay to unlock"
                    >
                      <LinearGradient
                        colors={Colors.gradient as [string, string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.payButtonGradient}
                      >
                        <Ionicons name="flash" size={16} color="#fff" />
                        <Text style={styles.payButtonText}>Unlock Now</Text>
                      </LinearGradient>
                    </Pressable>

                    <Text style={styles.paywallHint}>
                      {price > 1
                        ? "One-time purchase · Instant access"
                        : isExclusive
                          ? "Subscribe for access"
                          : "Unlock for full access"}
                    </Text>
                  </View>
                </LinearGradient>
              </>
            ) : (
              <>
                {/* Thumbnail as background while loading */}
                {thumbnail && (
                  <Image
                    source={{ uri: thumbnail }}
                    style={[
                      StyleSheet.absoluteFill,
                      // Hide thumbnail once video is ready and playing
                      { opacity: isReady && isPlaying ? 0 : 1 },
                    ]}
                    contentFit="contain"
                    cachePolicy="disk"
                  />
                )}

                {/* Video player - render as soon as player exists */}
                {showVideoView && (
                  <View style={{ flex: 1 }}>
                    <VideoView
                      style={StyleSheet.absoluteFill}
                      player={player}
                      contentFit="contain"
                      nativeControls={false}
                      allowsPictureInPicture={false}
                      allowsFullscreen={false}
                    />

                    <GestureDetector gesture={barGesture}>
                      <Animated.View
                        style={[
                          styles.progressContainer,
                          progressBarAnimatedStyle,
                        ]}
                        hitSlop={{ top: 10, bottom: 10 }}
                        onLayout={(e) => {
                          progressBarWidth.value = e.nativeEvent.layout.width;
                        }}
                      >
                        <Animated.View
                          style={[styles.progressFill, progressStyle]}
                        />
                        <Animated.View
                          style={[
                            styles.progressLockedSegment,
                            lockedSegmentStyle,
                          ]}
                        />

                        <Animated.View
                          style={[styles.thumb, thumbAnimatedStyle]}
                        />
                      </Animated.View>
                    </GestureDetector>
                  </View>
                )}

                {/* Loading overlay */}
                {showLoadingOverlay && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator color="white" size="large" />
                  </View>
                )}

                {/* Video paywall overlay — shown when preview ends on paid videos */}
                {previewEnded && isPaidVideo && (
                  <LinearGradient
                    colors={["rgba(15,13,43,0.85)", "rgba(26,16,64,0.95)"]}
                    style={styles.videoPaywallOverlay}
                  >
                    <View style={styles.paywallContent}>
                      <LinearGradient
                        colors={Colors.gradient as [string, string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.lockBadge}
                      >
                        <Ionicons name="lock-closed" size={28} color="#fff" />
                      </LinearGradient>

                      <Text style={styles.paywallTitle}>Exclusive Content</Text>
                      <Text style={styles.paywallSubtitle}>
                        Unlock this post and get access to premium content from
                        this creator.
                      </Text>

                      {price > 0 ? (
                        <View style={styles.priceBadge}>
                          <Ionicons
                            name="pricetag"
                            size={14}
                            color={Colors.gradient[2]}
                          />
                          <Text style={styles.priceText}>
                            ${price.toFixed(2)}
                          </Text>
                        </View>
                      ) : null}

                      <Pressable
                        onPress={handlePayPress}
                        style={({ pressed }) => [
                          styles.payButton,
                          pressed && styles.payButtonPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Pay to unlock"
                      >
                        <LinearGradient
                          colors={Colors.gradient as [string, string, string]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.payButtonGradient}
                        >
                          <Ionicons name="flash" size={16} color="#fff" />
                          <Text style={styles.payButtonText}>Unlock Now</Text>
                        </LinearGradient>
                      </Pressable>

                      <Pressable
                        onPress={handleWatchAgain}
                        style={({ pressed }) => [
                          styles.watchAgainButton,
                          pressed && styles.watchAgainButtonPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Watch preview again"
                      >
                        <Ionicons
                          name="refresh"
                          size={18}
                          color="rgba(255,255,255,0.95)"
                        />
                        <Text style={styles.watchAgainText}>Watch again</Text>
                      </Pressable>

                      <Text style={styles.paywallHint}>
                        {price > 1
                          ? "One-time purchase · Instant access"
                          : isExclusive
                            ? "Subscribe for access"
                            : "Unlock for full access"}
                      </Text>
                    </View>
                  </LinearGradient>
                )}

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
              </>
            )}
          </View>
        </Pressable>
      )}

      {/* Heart overlay for double-tap like */}
      <Animated.View
        style={[styles.heartContainer, animatedStyle]}
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

function PostMedia(props: Props) {
  return (
    <PostMediaErrorBoundary>
      <PostMediaInner {...props} />
    </PostMediaErrorBoundary>
  );
}

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
    shadowColor: "#f5c542",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 6,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  thumb: {
    position: "absolute",
    top: -2, // center vertically over 3px bar
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
    // Shadow for visibility on light backgrounds
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
    shadowColor: Colors.gradient[0],
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
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
    shadowColor: Colors.gradient[1],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
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

export default memo(PostMedia);
